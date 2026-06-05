import "./src/loadEnv";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import { verifyWebhook } from "@clerk/express/webhooks";
// Drizzle and DB imports
import { db } from "./src/db/index";
import { 
  users, workspaces, accounts, allocationRules, transactions, 
  invoices, catalogItems, pricingCalculations, contacts, 
  staff, staffReceipts, cmsConfigs 
} from "./src/db/schema";
import { eq, and } from "drizzle-orm";


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
  app.use(express.json());
  
  // Register Clerk Auth Middleware (excludes webhook route and health check)
  app.use(clerkMiddleware({
    excludedRoutes: ['/api/webhooks/clerk', '/api/health']
  }));

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
        const { user_id } = evt.data;
        await db.update(users)
          .set({ lastSeen: new Date().toISOString() })
          .where(eq(users.uid, user_id));
        console.log(`✅ User logged out: ${user_id}`);
      }
      
      
      // ==================== SUBSCRIPTION EVENTS ====================
      if (evt.type === "subscription.created") {
        const { user_id, status, plan_id } = evt.data;
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
        const { user_id, status, plan_id } = evt.data;
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
        const { user_id, plan_id } = evt.data;
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
        const { user_id } = evt.data;
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
        const { user_id, email_address, verification } = evt.data;
        console.log(`✅ Email created for user ${user_id}: ${email_address} (verified: ${verification?.status})`);
        // Future: Track email verification status for analytics
      }
      
      // ==================== SMS EVENTS ====================
      if (evt.type === "sms.created") {
        const { user_id, phone_number, verification } = evt.data;
        console.log(`✅ SMS created for user ${user_id}: ${phone_number} (verified: ${verification?.status})`);
        // Future: Track phone verification status for analytics
      }
      
      res.send('Webhook received');
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(400).send('Error verifying webhook');
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
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const data = await response.json();
      res.json(data);
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

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      res.json(response);
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // ==========================================
  // CLOUD DATABASE ENDPOINTS (TURSO + DRIZZLE)
  // ==========================================

  // --- USER PROFILE ENDPOINTS ---
  app.get("/api/users/me", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    try {
      let [profile] = await db.select().from(users).where(eq(users.uid, userId));
      if (!profile) {
        // Fetch real email from Clerk API
        let email = "";
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
        } catch {}
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
      res.json({
        ...profile,
        subscription: safeParse(profile.subscription),
        preferences: safeParse(profile.preferences)
      });
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
      const rows = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
      const formatted = rows.map(w => ({
        ...w,
        incomeCategories: safeParse(w.incomeCategories),
        expenseCategories: safeParse(w.expenseCategories),
        investmentCategories: safeParse(w.investmentCategories),
      }));
      res.json(formatted);
    } catch (err) {
      console.error("Error in GET /api/workspaces:", err);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.post("/api/workspaces", requireAuthMiddleware(), async (req: any, res) => {
    const userId = req.auth.userId;
    const data = req.body;
    try {
      const newWorkspace = {
        ...data,
        ownerId: userId,
        incomeCategories: data.incomeCategories ? JSON.stringify(data.incomeCategories) : null,
        expenseCategories: data.expenseCategories ? JSON.stringify(data.expenseCategories) : null,
        investmentCategories: data.investmentCategories ? JSON.stringify(data.investmentCategories) : null,
      };
      const [inserted] = await db.insert(workspaces).values(newWorkspace).returning();
      res.json({
        ...inserted,
        incomeCategories: safeParse(inserted.incomeCategories),
        expenseCategories: safeParse(inserted.expenseCategories),
        investmentCategories: safeParse(inserted.investmentCategories),
      });
    } catch (err) {
      console.error("Error in POST /api/workspaces:", err);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  app.put("/api/workspaces/:id", requireAuthMiddleware(), async (req: any, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const updateData = {
        ...data,
        incomeCategories: data.incomeCategories ? JSON.stringify(data.incomeCategories) : undefined,
        expenseCategories: data.expenseCategories ? JSON.stringify(data.expenseCategories) : undefined,
        investmentCategories: data.investmentCategories ? JSON.stringify(data.investmentCategories) : undefined,
        paymentMethods: data.paymentMethods ? JSON.stringify(data.paymentMethods) : undefined,
      };
      const [updated] = await db.update(workspaces).set(updateData).where(eq(workspaces.id, id)).returning();
      res.json({
        ...updated,
        incomeCategories: safeParse(updated.incomeCategories),
        expenseCategories: safeParse(updated.expenseCategories),
        investmentCategories: safeParse(updated.investmentCategories),
        paymentMethods: safeParse(updated.paymentMethods),
      });
    } catch (err) {
      console.error("Error in PUT /api/workspaces:", err);
      res.status(500).json({ error: "Failed to update workspace" });
    }
  });

  // --- ACCOUNTS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/accounts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const rows = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/workspaces/:workspaceId/accounts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const [inserted] = await db.insert(accounts).values({ ...data, workspaceId }).returning();
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.put("/api/workspaces/:workspaceId/accounts/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/accounts/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(accounts).where(eq(accounts.id, id));
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
      const rows = await db.select().from(allocationRules).where(eq(allocationRules.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch allocation rules" });
    }
  });

  app.post("/api/workspaces/:workspaceId/allocation-rules", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const [inserted] = await db.insert(allocationRules).values({ ...data, workspaceId }).returning();
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create allocation rule" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/allocation-rules/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(allocationRules).where(eq(allocationRules.id, id));
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
      const rows = await db.select().from(transactions).where(eq(transactions.workspaceId, workspaceId));
      res.json(rows);
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

      // 1. Create Transaction
      const [inserted] = await db.insert(transactions).values({ ...data, workspaceId }).returning();

      // 2. Adjust Account Balances
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

      // 3. Optional: Add payee as Contact if requested
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

      // 1. Reverse old transaction changes on accounts
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

      // 2. Apply new transaction changes on accounts
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

      // 3. Update Transaction record
      const [updated] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
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

      // 1. If linked to an invoice, reverse the payment on the invoice
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

      // 2. Adjust Account Balances (Reverse the transaction change)
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

      // 3. Delete the transaction record
      await db.delete(transactions).where(eq(transactions.id, id));
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
      const rows = await db.select().from(invoices).where(eq(invoices.workspaceId, workspaceId));
      const formatted = rows.map(i => ({
        ...i,
        items: safeParse(i.items)
      }));
      res.json(formatted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/workspaces/:workspaceId/invoices", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const newInvoice = {
        ...data,
        workspaceId,
        items: JSON.stringify(data.items)
      };
      const [inserted] = await db.insert(invoices).values(newInvoice).returning();
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
    const { id } = req.params;
    const data = req.body;
    try {
      const updateData = {
        ...data,
      };
      if (data.items !== undefined) {
        updateData.items = JSON.stringify(data.items);
      }
      const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
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
    const { id } = req.params;
    try {
      await db.delete(invoices).where(eq(invoices.id, id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // --- CATALOG ITEMS ENDPOINTS ---
  app.get("/api/workspaces/:workspaceId/catalog-items", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const rows = await db.select().from(catalogItems).where(eq(catalogItems.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch catalog items" });
    }
  });

  app.post("/api/workspaces/:workspaceId/catalog-items", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const [inserted] = await db.insert(catalogItems).values({ ...data, workspaceId }).returning();
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create catalog item" });
    }
  });

  app.put("/api/workspaces/:workspaceId/catalog-items/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(catalogItems).set(data).where(eq(catalogItems.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update catalog item" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/catalog-items/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(catalogItems).where(eq(catalogItems.id, id));
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
      const rows = await db.select().from(pricingCalculations).where(eq(pricingCalculations.workspaceId, workspaceId));
      const formatted = rows.map(p => ({
        ...p,
        inputs: safeParse(p.inputs)
      }));
      res.json(formatted);
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
    const { id } = req.params;
    try {
      await db.delete(pricingCalculations).where(eq(pricingCalculations.id, id));
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
      const rows = await db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/workspaces/:workspaceId/contacts", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const [inserted] = await db.insert(contacts).values({ ...data, workspaceId }).returning();
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.put("/api/workspaces/:workspaceId/contacts/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/contacts/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(contacts).where(eq(contacts.id, id));
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
      const rows = await db.select().from(staff).where(eq(staff.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/workspaces/:workspaceId/staff", requireAuthMiddleware(), async (req, res) => {
    const { workspaceId } = req.params;
    const data = req.body;
    try {
      const [inserted] = await db.insert(staff).values({ ...data, workspaceId }).returning();
      res.json(inserted);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.put("/api/workspaces/:workspaceId/staff/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const [updated] = await db.update(staff).set(data).where(eq(staff.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/workspaces/:workspaceId/staff/:id", requireAuthMiddleware(), async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(staff).where(eq(staff.id, id));
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
      const rows = await db.select().from(staffReceipts).where(eq(staffReceipts.workspaceId, workspaceId));
      const formatted = rows.map(r => ({
        ...r,
        items: safeParse(r.items)
      }));
      res.json(formatted);
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
        ...data,
        workspaceId,
        items: JSON.stringify(data.items)
      };
      const [inserted] = await db.insert(staffReceipts).values(newReceipt).returning();
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
    const { id } = req.params;
    try {
      await db.delete(staffReceipts).where(eq(staffReceipts.id, id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete staff receipt" });
    }
  });

  // --- CMS CONFIG ENDPOINTS ---
  app.get("/api/cms-config", async (req, res) => {
    try {
      let [config] = await db.select().from(cmsConfigs).where(eq(cmsConfigs.id, "cms"));
      if (!config) {
        // Create default CMS config if not exists
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
    // Basic Admin check (should verify req.auth.email or similar)
    const data = req.body;
    try {
      const updateData = {
        ...data,
      };
      if (data.faqs !== undefined) updateData.faqs = JSON.stringify(data.faqs);
      if (data.services !== undefined) updateData.services = JSON.stringify(data.services);

      const [updated] = await db.update(cmsConfigs).set(updateData).where(eq(cmsConfigs.id, "cms")).returning();
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
      const rows = await db.select().from(catalogItems).where(eq(catalogItems.workspaceId, workspaceId));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch public catalog" });
    }
  });

  app.get("/api/public/workspace/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      if (!ws) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json({
        id: ws.id,
        name: ws.name,
        logoUrl: ws.logoUrl,
        currency: ws.currency,
      });
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
}

startServer();
