import "./src/loadEnv";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import crypto from "crypto";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import { verifyWebhook } from "@clerk/express/webhooks";
// Drizzle and DB imports
import { db } from "./src/db/index";
import {
  users, workspaces, accounts, allocationRules, transactions,
  invoices, catalogItems, pricingCalculations, contacts,
  staff, staffReceipts, cmsConfigs, analytics, appErrors,
  subscriptionPlans, subscriptions, paymentTransactions
} from "./src/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { withCache, invalidateCache, buildCacheKey, rateLimit } from "./src/lib/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireAuthMiddleware = () => {
  return (req: any, res: any, next: any) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.auth = { userId: auth.userId };
    next();
  };
};

// Helper to safely parse JSON strings
function safeParse(str: string | null | undefined) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Register Clerk Auth Middleware (excludes webhook route and health check)
  app.use(clerkMiddleware({
    excludedRoutes: ['/api/webhooks/clerk', '/api/health']
  } as any));

  // ============================================
  // HEALTH CHECK ENDPOINT
  // ============================================
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ============================================
  // CLERK WEBHOOK ENDPOINT (Complete Event Handling)
  // ============================================
  // NOTE: Use express.raw() for webhook route - verification requires raw body bytes
  app.post("/api/webhooks/clerk", express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      // Verify webhook signature
      const evt = await verifyWebhook(req, {
        signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET
      });

      console.log(`Received Clerk webhook: ${evt.type}`);

      // ==================== USER EVENTS ====================
      if (evt.type === "user.created") {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses?.[0]?.email_address || "";
        const displayName = first_name || last_name
          ? `${first_name || ""} ${last_name || ""}`.trim()
          : email.split("@")[0] || "User";

        const [existing] = await db.select().from(users).where(eq(users.uid, id));
        if (!existing) {
          await db.insert(users).values({
            uid: id,
            email,
            displayName,
            createdAt: new Date().toISOString(),
            role: "User",
            subscription: JSON.stringify({ plan: "Free", status: "Active" }),
            preferences: JSON.stringify({ timeFormat: "12h", dateFormat: "yyyy-MM-dd" })
          });
          console.log(`✅ Created user in Turso: ${id} (${email})`);
        } else {
          console.log(`ℹ️  User already exists in Turso: ${id}`);
        }
      }

      if (evt.type === "user.updated") {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;
        const email = email_addresses?.[0]?.email_address || "";
        const displayName = first_name || last_name
          ? `${first_name || ""} ${last_name || ""}`.trim()
          : email.split("@")[0] || "User";

        const [existing] = await db.select().from(users).where(eq(users.uid, id));
        if (existing) {
          await db.update(users)
            .set({
              email,
              displayName,
              photoURL: image_url,
              lastSeen: new Date().toISOString()
            })
            .where(eq(users.uid, id));
          console.log(`✅ Updated user in Turso: ${id} (${email})`);
        }
      }

      if (evt.type === "user.deleted") {
        const { id } = evt.data;
        await db.delete(users).where(eq(users.uid, id));
        console.log(`✅ Deleted user from Turso: ${id}`);
      }

      // ==================== SESSION EVENTS ====================
      if (evt.type === "session.created") {
        const { user_id } = evt.data;
        await db.update(users)
          .set({ lastSeen: new Date().toISOString() })
          .where(eq(users.uid, user_id));
        console.log(`✅ User logged in: ${user_id}`);
      }

      if (evt.type === "session.ended" || evt.type === "session.revoked") {
        const { user_id } = evt.data as any;
        await db.update(users)
          .set({ lastSeen: new Date().toISOString() })
          .where(eq(users.uid, user_id));
        console.log(`✅ User logged out: ${user_id}`);
      }


      // ==================== SUBSCRIPTION EVENTS ====================
      if (evt.type === "subscription.created") {
        const { user_id, status, plan_id } = evt.data as any;
        const [existing] = await db.select().from(users).where(eq(users.uid, user_id));
        if (existing) {
          const currentSubscription = safeParse(existing.subscription) || { plan: "Free", status: "Active" };
          await db.update(users)
            .set({
              subscription: JSON.stringify({
                ...currentSubscription,
                plan: plan_id || "Pro",
                status: status || "Active"
              })
            })
            .where(eq(users.uid, user_id));
          console.log(`✅ Subscription created for user ${user_id}: ${plan_id}`);
        }
      }

      if (evt.type === "subscription.updated") {
        const { user_id, status, plan_id } = evt.data as any;
        const [existing] = await db.select().from(users).where(eq(users.uid, user_id));
        if (existing) {
          const currentSubscription = safeParse(existing.subscription) || { plan: "Free", status: "Active" };
          await db.update(users)
            .set({
              subscription: JSON.stringify({
                ...currentSubscription,
                plan: plan_id || currentSubscription.plan,
                status: status || currentSubscription.status
              })
            })
            .where(eq(users.uid, user_id));
          console.log(`✅ Subscription updated for user ${user_id}: ${plan_id}`);
        }
      }

      if (evt.type === "subscription.active") {
        const { user_id, plan_id } = evt.data as any;
        const [existing] = await db.select().from(users).where(eq(users.uid, user_id));
        if (existing) {
          const currentSubscription = safeParse(existing.subscription) || { plan: "Free", status: "Active" };
          await db.update(users)
            .set({
              subscription: JSON.stringify({
                ...currentSubscription,
                plan: plan_id || currentSubscription.plan,
                status: "Active"
              })
            })
            .where(eq(users.uid, user_id));
          console.log(`✅ Subscription activated for user ${user_id}: ${plan_id}`);
        }
      }

      if (evt.type === "subscription.pastDue") {
        const { user_id } = evt.data as any;
        const [existing] = await db.select().from(users).where(eq(users.uid, user_id));
        if (existing) {
          const currentSubscription = safeParse(existing.subscription) || { plan: "Free", status: "Active" };
          await db.update(users)
            .set({
              subscription: JSON.stringify({
                ...currentSubscription,
                status: "PastDue"
              })
            })
            .where(eq(users.uid, user_id));
          console.log(`⚠️  Subscription past due for user ${user_id}`);
        }
      }

      // ==================== EMAIL EVENTS ====================
      if (evt.type === "email.created") {
        const { user_id, email_address, verification } = evt.data as any;
        console.log(`✅ Email created for user ${user_id}: ${email_address} (verified: ${verification?.status})`);
        // Future: Track email verification status for analytics
      }

      // ==================== SMS EVENTS ====================
      if (evt.type === "sms.created") {
        const { user_id, phone_number, verification } = evt.data as any;
        console.log(`✅ SMS created for user ${user_id}: ${phone_number} (verified: ${verification?.status})`);
        // Future: Track phone verification status for analytics
      }

      res.send('Webhook received');
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(400).send('Error verifying webhook');
    }
  });

  // ==================== PAYSTACK HELPERS ====================

  function verifyPaystackSignature(req: any): boolean {
    const signature = req.headers["x-paystack-signature"];
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) return false;
    const hash = crypto.createHmac("sha512", secret).update(JSON.stringify(req.body)).digest("hex");
    return hash === signature;
  }

  async function upsertSubscription(userId: string, planName: string, status: string, reference: string, amount: number, currency: string) {
    const [existingTxn] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference));
    if (existingTxn) return;

    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, planName));
    if (!plan) return;

    const now = new Date().toISOString();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const [existingSub] = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "Active")))
      .orderBy(desc(subscriptions.createdAt)).limit(1);

    let subId: string;
    if (existingSub) {
      await db.update(subscriptions)
        .set({ planId: plan.id, status, expiryDate: expiryDate.toISOString(), updatedAt: now })
        .where(eq(subscriptions.id, existingSub.id));
      subId = existingSub.id;
    } else {
      subId = crypto.randomUUID();
      await db.insert(subscriptions).values({
        id: subId, userId, planId: plan.id, status,
        startDate: now, expiryDate: expiryDate.toISOString(),
        createdAt: now, updatedAt: now,
      });
    }

    await db.insert(paymentTransactions).values({
      id: crypto.randomUUID(), userId, subscriptionId: subId,
      reference, amount, currency, status, planName, createdAt: now,
    });

    const [user] = await db.select().from(users).where(eq(users.uid, userId));
    const currentSub = safeParse(user?.subscription) || { plan: "Free", status: "Active" };
    await db.update(users)
      .set({ subscription: JSON.stringify({ ...currentSub, plan: planName, status: "Active", expiryDate: expiryDate.toISOString() }) })
      .where(eq(users.uid, userId));

    return plan;
  }

  // Paystack Webhook Endpoint
  app.post("/api/paystack/webhook", async (req, res) => {
    if (!verifyPaystackSignature(req)) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    if (event.event !== "charge.success") {
      return res.send("Event ignored");
    }

    const { reference, amount, currency, metadata, customer } = event.data || {};
    if (!reference || !customer?.email) {
      return res.status(400).send("Missing reference or customer email");
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.email, customer.email));
      if (!user) return res.status(404).send("User not found");

      const raw = typeof metadata === "string" ? safeParse(metadata) : metadata;
      const planName = raw?.plan || "Pro";
      await upsertSubscription(user.uid, planName, "Active", reference, amount, currency);
      console.log(`✅ Subscription activated via webhook: ${user.email} → ${planName}`);
      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Paystack webhook error:", error);
      res.status(500).send("Internal error");
    }
  });

  // Paystack Verify Payment (called by frontend after callback)
  app.post("/api/paystack/verify-payment", requireAuthMiddleware(), async (req: any, res) => {
    const { reference } = req.body;
    const userId = req.auth.userId;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!reference) return res.status(400).json({ error: "Missing reference" });
    if (!secretKey) return res.status(500).json({ error: "PAYSTACK_SECRET_KEY not configured" });

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const result = await response.json();

      if (result.status && result.data?.status === "success") {
        const { amount, currency, metadata } = result.data;
        const raw = typeof metadata === "string" ? safeParse(metadata) : metadata;
        const planName = raw?.plan || "Pro";

        // Verify paid amount matches expected plan price
        const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, planName));
        if (plan && amount !== plan.price) {
          console.warn(`⚠️ Amount mismatch for ${planName}: expected ${plan.price}, got ${amount}`);
        }

        await upsertSubscription(userId, planName, "Active", reference, amount, currency);
        return res.json({ status: true, plan: planName });
      }
      res.json({ status: false, message: result.data?.gateway_response || "Verification failed" });
    } catch (error) {
      console.error("Paystack verify-payment error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Paystack Integration Endpoint
  app.post("/api/paystack/initialize", async (req, res) => {
    const { email, amount, plan } = req.body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" });
    }

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amount * 100, // Paystack expects amount in kobo/cents
          callback_url: `${req.protocol}://${req.get("host")}/payment/callback`,
          metadata: {
            plan,
          }
        }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Paystack initialization error:", error);
      res.status(500).json({ error: "Failed to initialize transaction" });
    }
  });

  // Paystack Verification Endpoint
  app.get("/api/paystack/verify/:reference", async (req, res) => {
    const { reference } = req.params;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" });
    }

    try {
      const result = await withCache(
        buildCacheKey("paystack", "verify", reference), 300,
        async () => {
          const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${secretKey}` },
          });
          return response.json();
        }
      );
      res.json(result);
    } catch (error) {
      console.error("Paystack verification error:", error);
      res.status(500).json({ error: "Failed to verify transaction" });
    }
  });

  // Paystack Callback Route
  app.get("/payment/callback", (req, res) => {
    const { reference } = req.query;
    // Redirect back to the app with the reference
    res.redirect(`/?payment_reference=${reference}`);
  });

  // AI Chatbot Proxy Endpoint
  app.post("/api/chat", requireAuthMiddleware(), async (req: any, res) => {
    const { contents, config, model = "gemini-2.5-flash" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const userId = req.auth.userId;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    // Rate-limit: 20 requests per minute per user
    const rl = await rateLimit(
      buildCacheKey("ratelimit", "chat", userId),
      20, 60
    );
    if (!rl.allowed) {
      res.setHeader("X-RateLimit-Remaining", rl.remaining);
      res.setHeader("X-RateLimit-Reset", rl.ttl);
      return res.status(429).json({
        error: "Too many requests. Please wait before sending another message.",
        retryAfter: rl.ttl
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      res.json({
        text: response.text,
        functionCalls: response.functionCalls,
        raw: response
      });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // ==========================================
  // PLAN LIMIT HELPERS
  // ==========================================

  async function getPlanForUser(userId: string) {
    const [sub] = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "Active")))
      .orderBy(desc(subscriptions.createdAt)).limit(1);
    if (!sub) return null;
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId));
    return plan || null;
  }

  async function checkPlanWorkspaceLimit(userId: string): Promise<string | null> {
    const plan = await getPlanForUser(userId);
    if (!plan || plan.maxWorkspaces === null) return null;
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(workspaces).where(eq(workspaces.ownerId, userId));
    const count = Number(result?.count || 0);
    if (count >= plan.maxWorkspaces) return `Plan limit reached: max ${plan.maxWorkspaces} workspaces`;
    return null;
  }

  async function checkPlanInvoiceLimit(workspaceId: string, userId: string): Promise<string | null> {
    const plan = await getPlanForUser(userId);
    if (!plan || plan.invoicesPerMonth === null) return null;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), gte(invoices.createdAt, firstOfMonth)));
    const count = Number(result?.count || 0);
    if (count >= plan.invoicesPerMonth) return `Plan limit reached: max ${plan.invoicesPerMonth} invoices/month`;
    return null;
  }

  // ==========================================
  // CLOUD DATABASE ENDPOINTS (TURSO + DRIZZLE)
  // ==========================================

  // --- USER PROFILE ENDPOINTS ---
  app.get("/api/users/me", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    try {
      const result = await withCache(
        buildCacheKey("user", userId, "profile"),
        120,
        async () => {
          let [profile] = await db.select().from(users).where(eq(users.uid, userId));
          if (!profile) {
            let email = "";
            try {
              const clerkUser = await clerkClient.users.getUser(userId);
              email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
            } catch { }
            const displayName = email ? email.split("@")[0] : "User";
            const newUser = {
              uid: userId,
              email,
              displayName,
              createdAt: new Date().toISOString(),
              role: "User",
              subscription: JSON.stringify({ plan: "Free", status: "Active" }),
              preferences: JSON.stringify({ timeFormat: "12h", dateFormat: "yyyy-MM-dd" })
            };
            const [inserted] = await db.insert(users).values(newUser).returning();
            profile = inserted;
          }
          return {
            ...profile,
            subscription: safeParse(profile.subscription),
            preferences: safeParse(profile.preferences)
          };
        }
      );
      res.json(result);
    } catch (err) {
      console.error("Error in /api/users/me:", err);
      res.status(500).json({ error: "Failed to retrieve user profile" });
    }
  });

  app.put("/api/users/me", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    const { displayName, photoURL, subscription, preferences } = req.body;
    try {
      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (photoURL !== undefined) updateData.photoURL = photoURL;
      if (subscription !== undefined) updateData.subscription = JSON.stringify(subscription);
      if (preferences !== undefined) updateData.preferences = JSON.stringify(preferences);

      const [updated] = await db.update(users)
        .set(updateData)
        .where(eq(users.uid, userId))
        .returning();

      await invalidateCache(buildCacheKey("user", userId, "profile"));

      res.json({
        ...updated,
        subscription: safeParse(updated.subscription),
        preferences: safeParse(updated.preferences)
      });
    } catch (err) {
      console.error("Error in PUT /api/users/me:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // --- WORKSPACE ENDPOINTS ---
  app.get("/api/workspaces", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    try {
      const result = await withCache(
        buildCacheKey("user", userId, "workspaces"),
        60,
        async () => {
          const [user] = await db.select().from(users).where(eq(users.uid, userId));
          const userEmail = user?.email || "";
          const owned = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
          let collaborated: typeof owned = [];
          if (userEmail) {
            const all = await db.select().from(workspaces).where(sql`${workspaces.collaborators} IS NOT NULL`);
            collaborated = all.filter(w => {
              const c = safeParse((w as any).collaborators) as string[] | null;
              return c?.includes(userEmail) && w.ownerId !== userId;
            });
          }
          const seen = new Set(owned.map(w => w.id));
          const merged = [...owned, ...collaborated.filter(w => !seen.has(w.id))];
          return merged.map(w => ({
            ...w,
            incomeCategories: safeParse(w.incomeCategories),
            expenseCategories: safeParse(w.expenseCategories),
            investmentCategories: safeParse(w.investmentCategories),
            collaborators: safeParse((w as any).collaborators),
          }));
        }
      );
      res.json(result);
    } catch (err) {
      console.error("Error in GET /api/workspaces:", err);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.post("/api/workspaces", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    const limitError = await checkPlanWorkspaceLimit(userId);
    if (limitError) return res.status(403).json({ error: limitError });

    const data = req.body;
    try {
      const newWorkspace = {
        ...data,
        ownerId: userId,
        incomeCategories: data.incomeCategories ? JSON.stringify(data.incomeCategories) : null,
        expenseCategories: data.expenseCategories ? JSON.stringify(data.expenseCategories) : null,
        investmentCategories: data.investmentCategories ? JSON.stringify(data.investmentCategories) : null,
        collaborators: data.collaborators ? JSON.stringify(data.collaborators) : null,
      };
      const [inserted] = await db.insert(workspaces).values(newWorkspace).returning();
      await invalidateCache(buildCacheKey("user", userId, "workspaces"));
      res.json({
        ...inserted,
        incomeCategories: safeParse(inserted.incomeCategories),
        expenseCategories: safeParse(inserted.expenseCategories),
        investmentCategories: safeParse(inserted.investmentCategories),
        collaborators: safeParse((inserted as any).collaborators),
      });
    } catch (err) {
      console.error("Error in POST /api/workspaces:", err);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  app.put("/api/workspaces/:id", requireAuthMiddleware(), async (req: any, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;
    const data = req.body;
    try {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      if (!ws) return res.status(404).json({ error: "Workspace not found" });

      if (data.collaborators !== undefined) {
        if (ws.ownerId !== userId) return res.status(403).json({ error: "Only owner can manage collaborators" });
        const [owner] = await db.select().from(users).where(eq(users.uid, userId));
        const sub = safeParse(owner?.subscription) || { plan: "Free" };
        if (sub.plan !== "Agency") return res.status(403).json({ error: "Agency plan required" });
        const collabs: string[] = data.collaborators;
        if (collabs.length > 5) return res.status(403).json({ error: "Max 5 collaborators" });
        if (collabs.some(e => !e.includes("@"))) return res.status(400).json({ error: "Invalid email in collaborators" });
      }

      const updateData = {
        ...data,
        incomeCategories: data.incomeCategories ? JSON.stringify(data.incomeCategories) : undefined,
        expenseCategories: data.expenseCategories ? JSON.stringify(data.expenseCategories) : undefined,
        investmentCategories: data.investmentCategories ? JSON.stringify(data.investmentCategories) : undefined,
        paymentMethods: data.paymentMethods ? JSON.stringify(data.paymentMethods) : undefined,
      };
      if (data.collaborators !== undefined) {
        (updateData as any).collaborators = JSON.stringify(data.collaborators);
      }
      const [updated] = await db.update(workspaces).set(updateData).where(eq(workspaces.id, id)).returning();
      await invalidateCache(buildCacheKey("user", userId, "workspaces"));
      res.json({
        ...updated,
        incomeCategories: safeParse(updated.incomeCategories),
        expenseCategories: safeParse(updated.expenseCategories),
        investmentCategories: safeParse(updated.investmentCategories),
        paymentMethods: safeParse((updated as any).paymentMethods),
        collaborators: safeParse((updated as any).collaborators),
      });
    } catch (err) {
      console.error("Error in PUT /api/workspaces:", err);
      res.status(500).json({ error: "Failed to update workspace" });
    }
  });

  app.delete("/api/workspaces/:id", requireAuthMiddleware(), async (req: any, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;
    try {
      // Cascade delete child tables first
      await db.delete(accounts).where(eq(accounts.workspaceId, id));
      await db.delete(allocationRules).where(eq(allocationRules.workspaceId, id));
      await db.delete(transactions).where(eq(transactions.workspaceId, id));
      await db.delete(invoices).where(eq(invoices.workspaceId, id));
      await db.delete(catalogItems).where(eq(catalogItems.workspaceId, id));
      await db.delete(pricingCalculations).where(eq(pricingCalculations.workspaceId, id));
      await db.delete(contacts).where(eq(contacts.workspaceId, id));
      await db.delete(staff).where(eq(staff.workspaceId, id));
      await db.delete(staffReceipts).where(eq(staffReceipts.workspaceId, id));

      // Delete the workspace itself
      await db.delete(workspaces).where(eq(workspaces.id, id));

      await invalidateCache(buildCacheKey("user", userId, "workspaces"));
      res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/workspaces/:id:", err);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  // --- ACCOUNTS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/accounts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "accounts"), 60,
        () => db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/workspaces/:workspaceId/accounts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const newAccount = {
        id: crypto.randomUUID(),
        ...data,
        workspaceId
      };
      const [inserted] = await db.insert(accounts).values(newAccount).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.put("/api/workspaces/:workspaceId/accounts/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/accounts/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(accounts).where(eq(accounts.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // --- ALLOCATION RULES ---
  app.get("/api/workspaces/:workspaceId/allocation-rules", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "allocation-rules"), 60,
        () => db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch allocation rules" });
    }
  });

  app.post("/api/workspaces/:workspaceId/allocation-rules", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const id = crypto.randomUUID();
      const [inserted] = await db.insert(allocationRules).values({ id, ...data, workspaceId }).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "allocation-rules"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create allocation rule" });
    }
  });
  app.put("/api/workspaces/:workspaceId/allocation-rules/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(allocationRules).set(data).where(eq(allocationRules.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "allocation-rules"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update allocation rule" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/allocation-rules/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(allocationRules).where(eq(allocationRules.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "allocation-rules"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete allocation rule" });
    }
  });

  // --- TRANSACTIONS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/transactions", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "transactions"), 60,
        () => db.select().from(transactions).where(eq(transactions.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/workspaces/:workspaceId/transactions", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const amountNum = Number(data.amount);
      const isOutflow = data.type === 'Expense' || data.type === 'Investment';
      const isInflow = data.type === 'Income';

      const [inserted] = await db.insert(transactions).values({ ...data, workspaceId }).returning();

      if (data.accountId === 'auto-allocate') {
        const rules = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
        for (const rule of rules) {
          const allocationAmount = (amountNum * rule.percentage) / 100;
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, rule.targetAccountId));
          if (acc) {
            await db.update(accounts)
              .set({ balance: acc.balance + allocationAmount })
              .where(eq(accounts.id, rule.targetAccountId));
          }
        }
      } else if (data.accountId) {
        const [acc] = await db.select().from(accounts).where(eq(accounts.id, data.accountId));
        if (acc) {
          const balanceChange = isInflow ? amountNum : isOutflow ? -amountNum : 0;
          await db.update(accounts)
            .set({ balance: acc.balance + balanceChange })
            .where(eq(accounts.id, data.accountId));
        }
      }

      if (data.savePayeeAsContact && data.payeePayer) {
        const name = data.payeePayer.trim();
        const [existing] = await db.select().from(contacts)
          .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.name, name)));
        if (!existing) {
          await db.insert(contacts).values({
            id: Math.random().toString(36).substring(2),
            workspaceId,
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      await invalidateCache(buildCacheKey("ws", workspaceId, "transactions"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.put("/api/workspaces/:workspaceId/transactions/:id", requireAuthMiddleware(), async (req, res) => {
    const { id, workspaceId } = req.params;
    const data = req.body;
    try {
      const [oldTx] = await db.select().from(transactions).where(eq(transactions.id, id));
      if (!oldTx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const oldAmount = oldTx.amount;
      const oldIsOutflow = oldTx.type === 'Expense' || oldTx.type === 'Investment';
      const oldIsInflow = oldTx.type === 'Income';

      if (oldTx.accountId === 'auto-allocate') {
        const rules = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
        for (const rule of rules) {
          const allocationAmount = (oldAmount * rule.percentage) / 100;
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, rule.targetAccountId));
          if (acc) {
            await db.update(accounts)
              .set({ balance: acc.balance - allocationAmount })
              .where(eq(accounts.id, rule.targetAccountId));
          }
        }
      } else if (oldTx.accountId) {
        const [acc] = await db.select().from(accounts).where(eq(accounts.id, oldTx.accountId));
        if (acc) {
          const oldBalanceChange = oldIsInflow ? oldAmount : oldIsOutflow ? -oldAmount : 0;
          await db.update(accounts)
            .set({ balance: acc.balance - oldBalanceChange })
            .where(eq(accounts.id, oldTx.accountId));
        }
      }

      const newAmount = Number(data.amount ?? oldTx.amount);
      const newType = data.type ?? oldTx.type;
      const newAccountId = data.accountId ?? oldTx.accountId;
      const newIsOutflow = newType === 'Expense' || newType === 'Investment';
      const newIsInflow = newType === 'Income';

      if (newAccountId === 'auto-allocate') {
        const rules = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
        for (const rule of rules) {
          const allocationAmount = (newAmount * rule.percentage) / 100;
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, rule.targetAccountId));
          if (acc) {
            await db.update(accounts)
              .set({ balance: acc.balance + allocationAmount })
              .where(eq(accounts.id, rule.targetAccountId));
          }
        }
      } else if (newAccountId) {
        const [acc] = await db.select().from(accounts).where(eq(accounts.id, newAccountId));
        if (acc) {
          const newBalanceChange = newIsInflow ? newAmount : newIsOutflow ? -newAmount : 0;
          await db.update(accounts)
            .set({ balance: acc.balance + newBalanceChange })
            .where(eq(accounts.id, newAccountId));
        }
      }

      const [updated] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "transactions"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/transactions/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      if (tx.invoiceId) {
        const [inv] = await db.select().from(invoices).where(eq(invoices.id, tx.invoiceId));
        if (inv) {
          const newPaidAmount = Math.max(0, (inv.paidAmount || 0) - tx.amount);
          let newStatus = inv.status;
          if (newPaidAmount <= 0) {
            newStatus = 'Sent';
          } else if (newPaidAmount < inv.amount) {
            newStatus = 'Partial';
          }
          await db.update(invoices)
            .set({ paidAmount: newPaidAmount, status: newStatus, updatedAt: new Date().toISOString() })
            .where(eq(invoices.id, tx.invoiceId));
        }
      }

      const amountNum = tx.amount;
      const isOutflow = tx.type === 'Expense' || tx.type === 'Investment';
      const isInflow = tx.type === 'Income';

      if (tx.accountId === 'auto-allocate') {
        const rules = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
        for (const rule of rules) {
          const allocationAmount = (amountNum * rule.percentage) / 100;
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, rule.targetAccountId));
          if (acc) {
            await db.update(accounts)
              .set({ balance: acc.balance - allocationAmount })
              .where(eq(accounts.id, rule.targetAccountId));
          }
        }
      } else if (tx.accountId) {
        const [acc] = await db.select().from(accounts).where(eq(accounts.id, tx.accountId));
        if (acc) {
          const balanceChange = isInflow ? amountNum : isOutflow ? -amountNum : 0;
          await db.update(accounts)
            .set({ balance: acc.balance - balanceChange })
            .where(eq(accounts.id, tx.accountId));
        }
      }

      await db.delete(transactions).where(eq(transactions.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "transactions"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "invoices"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // --- INVOICES ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/invoices", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "invoices"), 60,
        async () => {
          const rows = await db.select().from(invoices).where(eq(invoices.workspaceId, workspaceId));
          return rows.map(i => ({ ...i, items: safeParse(i.items) }));
        }
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/workspaces/:workspaceId/invoices", requireAuthMiddleware(), async (req: any, res) => {
    const { workspaceId } = req.params;
    const userId = req.auth.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const limitError = await checkPlanInvoiceLimit(workspaceId, userId);
    if (limitError) return res.status(403).json({ error: limitError });

    const data = req.body;
    try {
      const newInvoice = {
        id: crypto.randomUUID(),
        ...data,
        clientBusinessName: data.clientBusinessName || data.clientName || "Unknown Business",
        workspaceId,
        items: JSON.stringify(data.items)
      };
      const [inserted] = await db.insert(invoices).values(newInvoice).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "invoices"));

      // 1. Auto-save contact if it doesn't exist
      if (inserted.clientName) {
        const [existingContact] = await db.select().from(contacts)
          .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.name, inserted.clientName)));

        if (!existingContact) {
          const contactId = crypto.randomUUID();
          await db.insert(contacts).values({
            id: contactId,
            workspaceId,
            name: inserted.clientName,
            email: inserted.clientEmail || '',
            phone: inserted.clientPhone || '',
            type: 'Payer',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          });
        } else {
          await db.update(contacts)
            .set({
              lastUsed: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(contacts.id, existingContact.id));
        }
        await invalidateCache(buildCacheKey("ws", workspaceId, "contacts"));
      }

      // 2. Auto-record transaction if paidAmount > 0
      const amountNum = Number(inserted.paidAmount || 0);
      if (amountNum > 0) {
        const txnId = crypto.randomUUID();
        const transactionData = {
          workspaceId,
          type: 'Income' as const,
          amount: amountNum,
          currency: inserted.currency,
          category: 'Invoice Payment',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          description: `Initial payment for Invoice #${inserted.id.slice(-6).toUpperCase()} - ${inserted.clientName}`,
          payeePayer: inserted.clientName,
          invoiceId: inserted.id,
          accountId: '', // Assuming empty for initial unless specified
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          affects_cash: true,
          affects_profit: true
        };
        await db.insert(transactions).values({ id: txnId, ...transactionData });
        await invalidateCache(buildCacheKey("ws", workspaceId, "transactions"));
      }

      res.json({
        ...inserted,
        items: safeParse(inserted.items)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.put("/api/workspaces/:workspaceId/invoices/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const updateData = { ...data };
      if (data.items !== undefined) {
        updateData.items = JSON.stringify(data.items);
      }
      const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "invoices"));
      res.json({
        ...updated,
        items: safeParse(updated.items)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/invoices/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(invoices).where(eq(invoices.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "invoices"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  app.post("/api/workspaces/:workspaceId/invoices/:id/payments", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const { amount, date } = req.body;
    try {
      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const paidSoFar = Number(existing.paidAmount || 0);
      const invoiceTotal = Number(existing.amount || 0);
      const newPaidAmount = paidSoFar + amountNum;
      const isFullyPaid = newPaidAmount >= (invoiceTotal - 0.01);
      const newStatus = isFullyPaid ? 'Paid' : (newPaidAmount > 0 ? 'Partial' : existing.status);

      await db.update(invoices)
        .set({
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date().toISOString()
        })
        .where(eq(invoices.id, id));

      if (existing.clientName) {
        const [existingContact] = await db.select().from(contacts)
          .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.name, existing.clientName)));

        if (!existingContact) {
          const contactId = crypto.randomUUID();
          await db.insert(contacts).values({
            id: contactId,
            workspaceId,
            name: existing.clientName,
            email: existing.clientEmail || '',
            phone: existing.clientPhone || '',
            type: 'Payer',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          });
        } else {
          await db.update(contacts)
            .set({
              lastUsed: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(contacts.id, existingContact.id));
        }
        await invalidateCache(buildCacheKey("ws", workspaceId, "contacts"));
      }

      const txnId = crypto.randomUUID();
      const transactionData = {
        workspaceId,
        type: 'Income' as const,
        amount: amountNum,
        currency: existing.currency,
        category: 'Invoice Payment',
        date: date || new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        description: `Payment for Invoice #${id.slice(-6).toUpperCase()} - ${existing.clientName}`,
        payeePayer: existing.clientName,
        invoiceId: id,
        accountId: req.body.accountId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        affects_cash: true,
        affects_profit: true
      };

      await db.insert(transactions).values({ id: txnId, ...transactionData });

      if (req.body.accountId === 'auto-allocate') {
        const rules = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
        for (const rule of rules) {
          const allocationAmount = (amountNum * rule.percentage) / 100;
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, rule.targetAccountId));
          if (acc) {
            await db.update(accounts)
              .set({ balance: acc.balance + allocationAmount })
              .where(eq(accounts.id, rule.targetAccountId));
          }
        }
      } else if (req.body.accountId) {
        const [acc] = await db.select().from(accounts).where(eq(accounts.id, req.body.accountId));
        if (acc) {
          await db.update(accounts)
            .set({ balance: acc.balance + amountNum })
            .where(eq(accounts.id, req.body.accountId));
        }
      }

      await invalidateCache(buildCacheKey("ws", workspaceId, "invoices"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "transactions"));
      await invalidateCache(buildCacheKey("ws", workspaceId, "accounts"));

      const [updated] = await db.select().from(invoices).where(eq(invoices.id, id));
      res.json({ ...updated, items: safeParse(updated.items) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  // --- CATALOG ITEMS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/catalog-items", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "catalog-items"), 60,
        () => db.select().from(catalogItems).where(eq(catalogItems.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch catalog items" });
    }
  });

  app.post("/api/workspaces/:workspaceId/catalog-items", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const id = crypto.randomUUID();
      const [inserted] = await db.insert(catalogItems).values({ id, ...data, workspaceId }).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "catalog-items"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create catalog item" });
    }
  });

  app.put("/api/workspaces/:workspaceId/catalog-items/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(catalogItems).set(data).where(eq(catalogItems.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "catalog-items"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update catalog item" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/catalog-items/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(catalogItems).where(eq(catalogItems.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "catalog-items"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete catalog item" });
    }
  });

  // --- PRICING CALCULATIONS ---
  app.get("/api/workspaces/:workspaceId/pricing-calculations", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "pricing-calculations"), 60,
        async () => {
          const rows = await db.select().from(pricingCalculations).where(eq(pricingCalculations.workspaceId, workspaceId));
          return rows.map(p => ({ ...p, inputs: safeParse(p.inputs) }));
        }
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch pricing calculations" });
    }
  });

  app.post("/api/workspaces/:workspaceId/pricing-calculations", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const newCalc = {
        ...data,
        workspaceId,
        inputs: JSON.stringify(data.inputs)
      };
      const [inserted] = await db.insert(pricingCalculations).values(newCalc).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "pricing-calculations"));
      res.json({
        ...inserted,
        inputs: safeParse(inserted.inputs)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save calculation" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/pricing-calculations/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(pricingCalculations).where(eq(pricingCalculations.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "pricing-calculations"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete calculation" });
    }
  });

  // --- CONTACTS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/contacts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "contacts"), 60,
        () => db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/workspaces/:workspaceId/contacts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const id = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
      const [inserted] = await db.insert(contacts).values({ id, ...data, workspaceId }).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "contacts"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.put("/api/workspaces/:workspaceId/contacts/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "contacts"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/contacts/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(contacts).where(eq(contacts.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "contacts"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // --- STAFF ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/staff", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "staff"), 60,
        () => db.select().from(staff).where(eq(staff.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/workspaces/:workspaceId/staff", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const id = crypto.randomUUID();
      const [inserted] = await db.insert(staff).values({ id, ...data, workspaceId }).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "staff"));
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.put("/api/workspaces/:workspaceId/staff/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(staff).set(data).where(eq(staff.id, id)).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "staff"));
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/staff/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(staff).where(eq(staff.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "staff"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  // --- STAFF RECEIPT ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/staff-receipts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("ws", workspaceId, "staff-receipts"), 60,
        async () => {
          const rows = await db.select().from(staffReceipts).where(eq(staffReceipts.workspaceId, workspaceId));
          return rows.map(r => ({ ...r, items: safeParse(r.items) }));
        }
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch staff receipts" });
    }
  });

  app.post("/api/workspaces/:workspaceId/staff-receipts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const newReceipt = {
        id: crypto.randomUUID(),
        ...data,
        workspaceId,
        items: JSON.stringify(data.items)
      };
      const [inserted] = await db.insert(staffReceipts).values(newReceipt).returning();
      await invalidateCache(buildCacheKey("ws", workspaceId, "staff-receipts"));
      res.json({
        ...inserted,
        items: safeParse(inserted.items)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create staff receipt" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/staff-receipts/:id", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId, id } = req.params;
    try {
      await db.delete(staffReceipts).where(eq(staffReceipts.id, id));
      await invalidateCache(buildCacheKey("ws", workspaceId, "staff-receipts"));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete staff receipt" });
    }
  });

  // --- ADMIN ENDPOINTS ---
  const requireAdmin = () => requireAuthMiddleware(); // reuse same auth; role checked inside handler

  app.get("/api/admin/stats", requireAdmin(), async (req: any, res) => {
    try {
      const userRole = req.auth?.sessionClaims?.metadata?.role;
      if (userRole !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
      const [allUsers, visits, queries, errors] = await Promise.all([
        db.select().from(users),
        db.select().from(analytics).where(eq(analytics.type, 'visit')),
        db.select().from(analytics).where(eq(analytics.type, 'izy_query')),
        db.select().from(appErrors),
      ]);
      res.json({ users: allUsers, visits, queries, errors });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  });

  app.put("/api/admin/users/:uid/role", requireAdmin(), async (req: any, res) => {
    const { uid } = req.params;
    const { role } = req.body;
    try {
      const userRole = req.auth?.sessionClaims?.metadata?.role;
      if (userRole !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
      await db.update(users).set({ role }).where(eq(users.uid, uid));
      // Also update Clerk metadata
      await clerkClient.users.updateUserMetadata(uid, { publicMetadata: { role } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  app.post("/api/admin/analytics/visit", async (req, res) => {
    try {
      const { userId, path: visitPath, userAgent } = req.body;
      await db.insert(analytics).values({
        id: `vis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'visit', userId, path: visitPath, userAgent,
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to log visit' }); }
  });

  app.post("/api/admin/analytics/query", async (req, res) => {
    try {
      const { userId, query } = req.body;
      await db.insert(analytics).values({
        id: `qry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'izy_query', userId, query,
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to log query' }); }
  });

  app.post("/api/admin/errors", async (req, res) => {
    try {
      const { error, query, userId } = req.body;
      await db.insert(appErrors).values({
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        error, query, userId,
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to log error' }); }
  });

  // --- CMS CONFIG ENDPOINTS ---
  app.get("/api/cms-config", async (req, res) => {
    try {
      let [config] = await db.select().from(cmsConfigs).where(eq(cmsConfigs.id, "cms"));
      if (!config) {
        const defaultConfig = {
          id: "cms",
          siteName: "IzyFlow",
          heroBadgeText: "IzyInvoice is now IzyFlow!",
          heroHeading: "Track Your Money. Know Your Business",
          heroSubtext: "Send invoices, track your money and understand your business clearly with built-in tools to help you price your work right.",
          faqs: JSON.stringify([]),
          services: JSON.stringify([]),
          hideBrandName: false
        };
        const [inserted] = await db.insert(cmsConfigs).values(defaultConfig).returning();
        config = inserted;
      }
      res.json({
        ...config,
        faqs: safeParse(config.faqs),
        services: safeParse(config.services),
      });
    } catch (err) {
      console.error("Error fetching CMS config:", err);
      res.status(500).json({ error: "Failed to fetch CMS config" });
    }
  });

  app.post("/api/cms-config", requireAuthMiddleware(), async (req: any, res) => {
    const data = req.body;
    try {
      const updateData = { ...data };
      if (data.faqs !== undefined) updateData.faqs = JSON.stringify(data.faqs);
      if (data.services !== undefined) updateData.services = JSON.stringify(data.services);

      const [updated] = await db.update(cmsConfigs).set(updateData).where(eq(cmsConfigs.id, "cms")).returning();
      await invalidateCache(buildCacheKey("cms", "config"));
      res.json({
        ...updated,
        faqs: safeParse(updated.faqs),
        services: safeParse(updated.services),
      });
    } catch (err) {
      console.error("Error updating CMS config:", err);
      res.status(500).json({ error: "Failed to update CMS config" });
    }
  });

  // Public catalog access (does not require authentication)
  app.get("/api/public/catalog/:workspaceId", async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("public", "catalog", workspaceId), 300,
        () => db.select().from(catalogItems).where(eq(catalogItems.workspaceId, workspaceId))
      );
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch public catalog" });
    }
  });

  app.get("/api/public/workspace/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await withCache(
        buildCacheKey("public", "workspace", id), 300,
        async () => {
          const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
          if (!ws) return null;
          return {
            id: ws.id,
            name: ws.name,
            logoUrl: ws.logoUrl,
            currency: ws.currency,
          };
        },
        { skipCacheOnNull: true }
      );
      if (!result) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch public workspace details" });
    }
  });

  app.post("/api/public/catalog/:workspaceId/checkout", async (req, res) => {
    const { workspaceId } = req.params;
    const { customerName, customerEmail, cart, cartTotal } = req.body;
    try {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
      if (!ws) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const invoiceId = Math.random().toString(36).substring(2, 11).toUpperCase();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoiceData = {
        id: invoiceId,
        workspaceId,
        clientName: customerName,
        clientBusinessName: customerName,
        clientEmail: customerEmail,
        amount: cartTotal,
        currency: ws.currency,
        status: 'Paid',
        createdAt: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        updatedAt: new Date().toISOString(),
        items: JSON.stringify(cart.map((c: any) => ({
          name: c.item.name,
          description: c.item.description,
          quantity: c.quantity,
          price: c.item.price
        }))),
        paidAmount: cartTotal,
        introduction: `Order placed via public catalog by ${customerName}.`
      };

      const [insertedInvoice] = await db.insert(invoices).values(invoiceData).returning();

      const accountsList = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
      const rulesList = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));

      const defaultAccount = accountsList.find(a => a.isDefault) || accountsList[0];
      const accountId = rulesList.length > 0 ? 'auto-allocate' : (defaultAccount?.id || '');

      const transactionId = Math.random().toString(36).substring(2, 11).toUpperCase();
      const transactionData = {
        id: transactionId,
        workspaceId,
        type: 'Income',
        amount: cartTotal,
        currency: ws.currency,
        category: 'Catalog Sale',
        date: new Date().toISOString().split('T')[0],
        description: `Sale to ${customerName} via Public Catalog`,
        payeePayer: customerName,
        invoiceId: insertedInvoice.id,
        accountId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.insert(transactions).values(transactionData);

      if (accountId === 'auto-allocate') {
        for (const rule of rulesList) {
          const allocationAmount = (cartTotal * rule.percentage) / 100;
          const account = accountsList.find(a => a.id === rule.targetAccountId);
          if (account) {
            await db.update(accounts)
              .set({ balance: account.balance + allocationAmount })
              .where(eq(accounts.id, account.id));
          }
        }
      } else if (accountId) {
        const account = accountsList.find(a => a.id === accountId);
        if (account) {
          await db.update(accounts)
            .set({ balance: account.balance + cartTotal })
            .where(eq(accounts.id, accountId));
        }
      }

      res.json({ success: true, invoice: insertedInvoice });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to place order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Seed subscription plans
  async function seedPlans() {
    const plans = [
      { id: "plan_free", name: "Free", price: 0, invoicesPerMonth: 10, maxWorkspaces: 1, features: JSON.stringify(["Up to 10 Invoices / month", "1 Workspace", "Basic Expense Tracking", "GHS Currency Only", "Standard Support"]) },
      { id: "plan_pro", name: "Pro", price: 7900, invoicesPerMonth: 50, maxWorkspaces: 2, features: JSON.stringify(["Up to 50 Invoices / month", "2 Workspaces", "Clients & CRM Database", "Multi-currency (USD, GBP, EUR)", "Advanced Analytics", "Priority Email Support"]) },
      { id: "plan_agency", name: "Agency", price: 45000, invoicesPerMonth: null, maxWorkspaces: 10, features: JSON.stringify(["Unlimited Invoices / month", "10 Workspaces", "Team Collaboration (5 seats)", "Clients & CRM Database", "Interactive Price Calculator", "Custom Branding", "Automated Overdue Reminders", "Dedicated Account Manager"]) },
    ];
    for (const plan of plans) {
      const [existing] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, plan.name)).limit(1);
      if (!existing) {
        await db.insert(subscriptionPlans).values(plan);
        console.log(`✅ Seeded plan: ${plan.name}`);
      }
    }
  }
  seedPlans().catch(e => console.error("❌ Seed plans error:", e));

  // Expiry check — run hourly
  setInterval(async () => {
    try {
      const expired = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.status, "Active"), eq(subscriptions.autoRenew, false)));
      const now = new Date();
      for (const sub of expired) {
        if (sub.expiryDate && new Date(sub.expiryDate) < now) {
          await db.update(subscriptions).set({ status: "Expired", updatedAt: now.toISOString() }).where(eq(subscriptions.id, sub.id));
          await db.update(users).set({ subscription: JSON.stringify({ plan: "Free", status: "Active" }) }).where(eq(users.uid, sub.userId));
          console.log(`⏰ Subscription expired: ${sub.userId}`);
        }
      }
    } catch (e) {
      console.error("❌ Expiry check error:", e);
    }
  }, 3600000); // every hour
}

startServer();
