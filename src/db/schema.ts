import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  uid: text("uid").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  photoURL: text("photo_url"),
  createdAt: text("created_at").notNull(),
  lastSeen: text("last_seen"),
  role: text("role"),
  subscription: text("subscription"), // JSON string representing: { plan: 'Free' | 'Pro' | 'Agency', status: 'Active' | 'Inactive' | 'Trial', expiryDate?: string }
  preferences: text("preferences"), // JSON string representing: { timeFormat: '12h' | '24h', dateFormat: string, transactionFields?: { showTime?: boolean, showPayeePayer?: boolean, showDescription?: boolean } }
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'Business' | 'Personal' | 'NGO'
  ownerId: text("owner_id").notNull(),
  currency: text("currency").notNull(), // 'GHS' | 'USD' | 'GBP' | 'EUR'
  logoUrl: text("logo_url"),
  description: text("description"),
  incomeCategories: text("income_categories"), // JSON array of string
  expenseCategories: text("expense_categories"), // JSON array of string
  investmentCategories: text("investment_categories"), // JSON array of string
  salesTarget: real("sales_target"),
  retainerTarget: real("retainer_target"),
  businessAddress: text("business_address"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  taxId: text("tax_id"),
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  accountNumber: text("account_number"),
  mobileMoneyProvider: text("mobile_money_provider"),
  mobileMoneyNumber: text("mobile_money_number"),
  onlinePaymentUrl: text("online_payment_url"),
  brandColor: text("brand_color"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  balance: real("balance").notNull(),
  currency: text("currency").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }),
  updatedAt: text("updated_at"),
});

export const allocationRules = sqliteTable("allocation_rules", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  percentage: real("percentage").notNull(),
  targetAccountId: text("target_account_id").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(), // 'Income' | 'Expense' | 'Investment' | 'Transfer'
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  time: text("time"),
  description: text("description").notNull(),
  payeePayer: text("payee_payer"),
  isLoan: integer("is_loan", { mode: "boolean" }),
  loanStatus: text("loan_status"),
  accountId: text("account_id"),
  affects_cash: integer("affects_cash", { mode: "boolean" }),
  affects_profit: integer("affects_profit", { mode: "boolean" }),
  affects_investment: integer("affects_investment", { mode: "boolean" }),
  affects_debt: integer("affects_debt", { mode: "boolean" }),
  invoiceId: text("invoice_id"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  clientName: text("client_name").notNull(),
  clientBusinessName: text("client_business_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  title: text("title"),
  introduction: text("introduction"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(), // 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partial'
  createdAt: text("created_at").notNull(),
  dueDate: text("due_date"),
  items: text("items").notNull(), // JSON string representing InvoiceItem[]
  paidAmount: real("paid_amount"),
  updatedAt: text("updated_at"),
  paymentTerms: text("payment_terms"),
  discountType: text("discount_type"), // 'percentage' | 'flat'
  discountValue: real("discount_value"),
  subtotal: real("subtotal"),
  notes: text("notes"),
});

export const catalogItems = sqliteTable("catalog_items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // 'Product' | 'Service'
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pricingCalculations = sqliteTable("pricing_calculations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  clientName: text("client_name").notNull(),
  pricingType: text("pricing_type").notNull(), // 'SERVICE_PROJECT' | 'PRODUCT' | 'EVENT' | 'RETAINER'
  inputs: text("inputs").notNull(), // JSON string representing CalcInputs
  totalPrice: real("total_price").notNull(),
  createdAt: text("created_at").notNull(),
  notes: text("notes"),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  type: text("type"), // 'Payer' | 'Payee' | 'Both'
  notes: text("notes"),
  frequency: integer("frequency"),
  lastUsed: text("last_used"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  phone: text("phone"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  createdAt: text("created_at").notNull(),
});

export const staffReceipts = sqliteTable("staff_receipts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  staffId: text("staff_id"),
  recipientName: text("recipient_name").notNull(),
  recipientRole: text("recipient_role"),
  recipientEmail: text("recipient_email"),
  title: text("title").notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  items: text("items").notNull(), // JSON string representing StaffReceiptItem[]
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  notes: text("notes"),
  referenceNumber: text("reference_number"),
  createdAt: text("created_at").notNull(),
});

export const cmsConfigs = sqliteTable("cms_configs", {
  id: text("id").primaryKey(),
  logoUrl: text("logo_url"),
  sidebarLogoUrl: text("sidebar_logo_url"),
  heroImageUrl: text("hero_image_url"),
  fontFamily: text("font_family"),
  brandColor: text("brand_color"),
  heroHeading: text("hero_heading"),
  heroSubtext: text("hero_subtext"),
  featuresHeading: text("features_heading"),
  featuresSubtext: text("features_subtext"),
  intelligenceHeading: text("intelligence_heading"),
  intelligenceSubtext: text("intelligence_subtext"),
  automationHeading: text("automation_heading"),
  automationSubtext: text("automation_subtext"),
  growthHeading: text("growth_heading"),
  growthSubtext: text("growth_subtext"),
  dataFreedomHeading: text("data_freedom_heading"),
  dataFreedomSubtext: text("data_freedom_subtext"),
  simplicityHeading: text("simplicity_heading"),
  simplicitySubtext: text("simplicity_subtext"),
  ctaHeading: text("cta_heading"),
  ctaSubtext: text("cta_subtext"),
  footerSubtext: text("footer_subtext"),
  copyrightText: text("copyright_text"),
  faqs: text("faqs"), // JSON string of FAQItem[]
  services: text("services"), // JSON string of ServiceItem[]
  hideBrandName: integer("hide_brand_name", { mode: "boolean" }),
  customDomain: text("custom_domain"),
  txtRecord: text("txt_record"),
  heroBadgeText: text("hero_badge_text"),
  siteName: text("site_name"),
  faviconUrl: text("favicon_url"),
});

export const analytics = sqliteTable("analytics", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'visit' | 'izy_query'
  userId: text("user_id"),
  path: text("path"),
  userAgent: text("user_agent"),
  query: text("query"),
  timestamp: text("timestamp").notNull(),
});

export const appErrors = sqliteTable("app_errors", {
  id: text("id").primaryKey(),
  error: text("error").notNull(),
  query: text("query"),
  userId: text("user_id"),
  timestamp: text("timestamp").notNull(),
});

export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("GHS"),
  invoicesPerMonth: integer("invoices_per_month"),
  maxWorkspaces: integer("max_workspaces"),
  features: text("features"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.uid),
  planId: text("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("Active"),
  startDate: text("start_date").notNull(),
  expiryDate: text("expiry_date"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const paymentTransactions = sqliteTable("payment_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.uid),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),
  reference: text("reference").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("GHS"),
  status: text("status").notNull(),
  planName: text("plan_name"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});
