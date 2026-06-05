let activeToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  activeToken = token;
};

const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    ...options.headers,
  };
  
  const res = await fetch(endpoint, {
    ...options,
    headers,
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  
  return res.json();
};

export const api = {
  // User Profile
  getMe: () => fetchAPI("/api/users/me"),
  updateProfile: (data: any) => fetchAPI("/api/users/me", { method: "PUT", body: JSON.stringify(data) }),

  // Workspaces
  getWorkspaces: () => fetchAPI("/api/workspaces"),
  createWorkspace: (data: any) => fetchAPI("/api/workspaces", { method: "POST", body: JSON.stringify(data) }),
  updateWorkspace: (id: string, data: any) => fetchAPI(`/api/workspaces/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Accounts
  getAccounts: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/accounts`),
  createAccount: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/accounts`, { method: "POST", body: JSON.stringify(data) }),
  updateAccount: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAccount: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/accounts/${id}`, { method: "DELETE" }),

  // Allocation Rules
  getAllocationRules: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/allocation-rules`),
  createAllocationRule: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/allocation-rules`, { method: "POST", body: JSON.stringify(data) }),
  deleteAllocationRule: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/allocation-rules/${id}`, { method: "DELETE" }),

  // Transactions
  getTransactions: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/transactions`),
  createTransaction: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/transactions`, { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/transactions/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/invoices`),
  createInvoice: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/invoices`, { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/invoices/${id}`, { method: "DELETE" }),

  // Catalog Items
  getCatalogItems: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/catalog-items`),
  createCatalogItem: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/catalog-items`, { method: "POST", body: JSON.stringify(data) }),
  updateCatalogItem: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/catalog-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCatalogItem: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/catalog-items/${id}`, { method: "DELETE" }),

  // Pricing Calculations
  getPricingCalculations: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/pricing-calculations`),
  createPricingCalculation: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/pricing-calculations`, { method: "POST", body: JSON.stringify(data) }),
  deletePricingCalculation: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/pricing-calculations/${id}`, { method: "DELETE" }),

  // Contacts
  getContacts: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/contacts`),
  createContact: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/contacts`, { method: "POST", body: JSON.stringify(data) }),
  updateContact: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContact: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/contacts/${id}`, { method: "DELETE" }),

  // Staff
  getStaff: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/staff`),
  createStaff: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/staff`, { method: "POST", body: JSON.stringify(data) }),
  updateStaff: (wsId: string, id: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/staff/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStaff: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/staff/${id}`, { method: "DELETE" }),

  // Staff Receipts
  getStaffReceipts: (wsId: string) => fetchAPI(`/api/workspaces/${wsId}/staff-receipts`),
  createStaffReceipt: (wsId: string, data: any) => fetchAPI(`/api/workspaces/${wsId}/staff-receipts`, { method: "POST", body: JSON.stringify(data) }),
  deleteStaffReceipt: (wsId: string, id: string) => fetchAPI(`/api/workspaces/${wsId}/staff-receipts/${id}`, { method: "DELETE" }),

  // CMS Config
  getCMSConfig: () => fetchAPI("/api/cms-config"),
  updateCMSConfig: (data: any) => fetchAPI("/api/cms-config", { method: "POST", body: JSON.stringify(data) }),

  // Public Catalog
  getPublicCatalog: (wsId: string) => fetchAPI(`/api/public/catalog/${wsId}`),
  getPublicWorkspace: (id: string) => fetchAPI(`/api/public/workspace/${id}`),
  publicCheckout: (wsId: string, data: any) => fetchAPI(`/api/public/catalog/${wsId}/checkout`, { method: "POST", body: JSON.stringify(data) }),

  // AI Chat
  chat: (contents: any[], config?: any, model?: string) => fetchAPI("/api/chat", {
    method: "POST",
    body: JSON.stringify({ contents, config, model })
  }),
};
