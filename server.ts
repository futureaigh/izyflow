import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
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
  
  // Register Clerk Auth Middleware
  app.use(clerkMiddleware());

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
