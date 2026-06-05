export type Currency = 'GHS' | 'USD' | 'GBP' | 'EUR';
export type WorkspaceType = 'Business' | 'Personal' | 'NGO';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partial';
export type TransactionType = 'Income' | 'Expense' | 'Investment' | 'Transfer';

export type UserRole = 'Admin' | 'Content Admin' | 'User';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string;
  role?: UserRole;
  subscription?: {
    plan: 'Free' | 'Pro' | 'Agency';
    status: 'Active' | 'Inactive' | 'Trial';
    expiryDate?: string;
  };
  preferences?: {
    timeFormat: '12h' | '24h';
    dateFormat: string;
    transactionFields?: {
      showTime?: boolean;
      showPayeePayer?: boolean;
      showDescription?: boolean;
    };
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ServiceItem {
  title: string;
  description: string;
  icon: string;
}

export interface CMSConfig {
  id: string;
  logoUrl?: string;
  sidebarLogoUrl?: string;
  heroImageUrl?: string;
  fontFamily?: string;
  brandColor?: string;
  heroHeading?: string;
  heroSubtext?: string;
  featuresHeading?: string;
  featuresSubtext?: string;
  intelligenceHeading?: string;
  intelligenceSubtext?: string;
  automationHeading?: string;
  automationSubtext?: string;
  growthHeading?: string;
  growthSubtext?: string;
  dataFreedomHeading?: string;
  dataFreedomSubtext?: string;
  simplicityHeading?: string;
  simplicitySubtext?: string;
  ctaHeading?: string;
  ctaSubtext?: string;
  footerSubtext?: string;
  copyrightText?: string;
  faqs?: FAQItem[];
  services?: ServiceItem[];
  hideBrandName?: boolean;
  customDomain?: string;
  txtRecord?: string;
  heroBadgeText?: string;
  siteName?: string;
  faviconUrl?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'Bank' | 'Mobile Money' | 'Online';
  provider: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  isDefault?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerId: string;
  currency: Currency;
  logoUrl?: string;
  description?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
  investmentCategories?: string[];
  salesTarget?: number;
  retainerTarget?: number;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  taxId?: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  mobileMoneyProvider?: string;
  mobileMoneyNumber?: string;
  onlinePaymentUrl?: string;
  brandColor?: string;
  paymentMethods?: PaymentMethod[];
}

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  balance: number;
  currency: Currency;
  isDefault?: boolean;
  updatedAt?: string;
}

export interface AllocationRule {
  id: string;
  workspaceId: string;
  name: string;
  percentage: number;
  targetAccountId: string;
}

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  clientName: string;
  clientBusinessName: string;
  clientEmail?: string;
  clientPhone?: string;
  introduction?: string;
  amount: number;
  currency: Currency;
  status: InvoiceStatus;
  createdAt: string;
  dueDate?: string;
  items: InvoiceItem[];
  paidAmount?: number;
  updatedAt?: string;
  paymentTerms?: string;
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
  subtotal?: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category: string;
  date: string;
  time?: string;
  description: string;
  payeePayer?: string;
  isLoan?: boolean;
  loanStatus?: 'Loan' | 'Repayment';
  accountId?: string;
  // Behavior flags for accurate financial logic
  affects_cash?: boolean;
  affects_profit?: boolean;
  affects_investment?: boolean;
  affects_debt?: boolean;
  invoiceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  category: string;
  type: 'Product' | 'Service';
  createdAt: string;
  updatedAt: string;
}

export type PricingType = 'SERVICE_PROJECT' | 'PRODUCT' | 'EVENT' | 'RETAINER';

export interface CalcInputs {
  pricingType: PricingType;
  direct: {
    materials: number;
    subcontractors: number;
    packaging: number;
    delivery: number;
    transactionFees: number;
    softwareTools: number;
    dataItems: Array<{ id: string; name: string; cost: number }>;
  };
  labour: {
    monthlyIncomeTarget: number;
    monthlyWorkingHours: number;
    estimatedJobHours: number;
  };
  overheads: {
    monthlyOverheadTotal: number;
    monthlyJobs: number;
    items: Array<{ id: string; name: string; monthlyCost: number }>;
  };
  equipment: {
    equipmentCost: number;
    lifespanMonths: number;
    items: Array<{ id: string; name: string; cost: number; lifespanMonths: number }>;
  };
  adjustments: {
    profitMarginPct: number;
    riskBufferPct: number;
    taxPct: number;
  };
  product: {
    costPerUnit: number;
    extraCostPerUnit: number;
    method: 'MARKUP' | 'MARGIN';
    percent: number;
    taxPct: number;
  };
  event: {
    totalEventCost: number;
    expectedAttendees: number;
    profitMarginPct: number;
    taxPct: number;
  };
  retainer: {
    monthlyCostToServe: number;
    desiredProfitPct: number;
    taxPct: number;
  };
  advanced: {
    enabled: boolean;
    commissionEnabled: boolean;
    commissionPct: number;
    scenariosEnabled: boolean;
    scenarioAName: string;
    scenarioAPct: number;
    scenarioBName: string;
    scenarioBPct: number;
    subscriptionEnabled: boolean;
    basicTierName: string;
    basicTierPct: number;
    standardTierName: string;
    standardTierPct: number;
    premiumTierName: string;
    premiumTierPct: number;
  };
}

export interface PricingCalculation {
  id: string;
  workspaceId: string;
  clientName: string;
  pricingType: PricingType;
  inputs: CalcInputs;
  totalPrice: number;
  createdAt: string;
  notes?: string;
}

export interface Visit {
  id: string;
  timestamp: string;
  userId?: string;
  path: string;
  userAgent: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  name: string;
  email?: string;
  phone?: string;
  type?: 'Payer' | 'Payee' | 'Both';
  notes?: string;
  frequency?: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  bankName?: string;
  accountNumber?: string;
  createdAt: string;
}

export interface StaffReceiptItem {
  description: string;
  amount: number;
}

export interface StaffReceipt {
  id: string;
  workspaceId: string;
  staffId?: string;
  recipientName: string;
  recipientRole?: string;
  recipientEmail?: string;
  title: string;
  date: string;
  paymentMethod: string;
  items: StaffReceiptItem[];
  amount: number;
  currency: Currency;
  notes?: string;
  referenceNumber?: string;
  createdAt: string;
}

