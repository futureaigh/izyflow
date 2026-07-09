export const platformDocumentation = `
# IzyFlow Platform Documentation & Tutorials

Welcome to IzyFlow! IzyFlow is an intelligent financial management platform designed to help you track transactions, manage invoices, auto-allocate funds, and view real-time analytics.

## Core Concepts
- **Workspace**: Your primary business environment. All your accounts, transactions, and invoices belong to a workspace.
- **Account**: A financial bucket (e.g., Bank Account, Mobile Money, Cash) where funds are stored.
- **Transaction**: A record of money moving in (Income), out (Expense/Investment), or between accounts (Transfer).
- **Invoice**: A bill sent to a client for products or services.
- **Allocation Rule**: A smart automation that automatically sets aside a percentage of your income into a specific account (e.g., 10% for Taxes).
- **Catalog Item**: A product or service that you sell, which can be quickly added to invoices.
- **Staff**: Employees or contractors who receive payroll or expense reimbursements (Staff Receipts).

## Tutorials & "How-To" Guides

### How to Record a Transaction
You can record a transaction manually via the dashboard, or simply ask IzyAssistant! 
For example, tell Izy: *"I spent $50 on office supplies today from my Cash account."*
Izy will automatically categorize it and log the expense.

### How to Create an Invoice
To bill a client, tell Izy: *"Create an invoice for John Doe for 500 GHS due next Friday."*
Izy will draft the invoice. You can then review and confirm it directly in the chat.

### How to Set Up Auto-Allocation Rules (Smart Splits)
Auto-allocation is a powerful feature that automatically splits your incoming money.
For example, if you want to save 15% of all income for taxes, tell Izy:
*"Create an allocation rule to send 15% to my Tax account."*
Whenever you record a new income transaction and select "Auto-Allocate", the system will automatically route 15% to the Tax account and keep the rest in your primary account.

### How to Record Invoice Payments
When a client pays an invoice, you need to record the payment so the invoice status updates from "Sent" to "Partial" or "Paid".
Tell Izy: *"Record a payment of 200 GHS for invoice #123456."* 
(You can find the invoice ID in your Invoices tab).

### How to Add Staff and Record Payroll
1. **Add Staff**: *"Add a new staff member named Sarah."*
2. **Pay Staff**: *"Record a salary payment of 2000 GHS to Sarah for October Salary."*

### How to Manage Your Catalog
You can save frequently sold items to your catalog.
Tell Izy: *"Add a new service to my catalog called SEO Audit priced at 300 USD."*

## Troubleshooting & FAQ
- **Why did I get a 'NOT NULL constraint failed' error?** This usually happens if the backend fails to generate a unique ID. Contact support if this persists.
- **Can I undo a transaction?** Yes, when you confirm a transaction in the chat, a success toast will appear with an "Undo" button.
- **How do I get technical support?** For complex bugs or billing issues, please contact our human support team directly via WhatsApp at: https://wa.me/233507750048.
`;
