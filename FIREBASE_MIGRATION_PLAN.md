# Technical Migration Plan: Firebase to Clerk & Turso DB

This document details the architectural and procedural steps required to migrate users from Firebase Authentication to Clerk, and database records from Cloud Firestore (NoSQL) to Turso DB (SQL/SQLite).

---

## 1. User Migration (Firebase Authentication ➔ Clerk)

### A. Password Hash Configuration Extraction
Firebase Auth uses a customized `scrypt` hashing algorithm. To import users into Clerk *without* forcing them to reset their passwords, we must retrieve Firebase's specific password hashing configuration.

1. Go to the **Firebase Console** ➔ **Authentication** ➔ **Users**.
2. Click the three vertical dots (menu) near the user list and select **Password hash parameters**.
3. Retrieve and copy the following parameters:
   - `base64_signer_key`
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

### B. Exporting Users from Firebase
Use the Firebase CLI to export all users to a JSON file:
```bash
firebase auth:export users.json --format=json --project=<your-firebase-project-id>
```

### C. Importing Users into Clerk
Clerk provides a User Import API. We will create a migration script to map the exported Firebase users into Clerk's format:

**Clerk Import Payload Example:**
```json
{
  "email_address": "user@example.com",
  "password_digest": "firebase-password-hash-base64",
  "password_hasher": "scrypt_firebase",
  "first_name": "John",
  "last_name": "Doe",
  "created_at": 1717545600000,
  "external_id": "firebase-uid-here"
}
```

> [!NOTE]
> - Setting `external_id` to the Firebase UID preserves references to the user in our database tables (which use `owner_id` or `uid` matching the original Firebase UID).
> - For **OAuth-only users** (Google, Apple, etc. with no password hashes), omit the `password_digest` and set `skip_password_requirement: true`.
> - **Rate Limit Handling**: Clerk's User Import API is rate-limited. Ensure the import script handles `429 Too Many Requests` responses with an exponential backoff retry mechanism.

---

## 2. Data Migration (Firestore ➔ Turso DB)

Firestore is a document-oriented NoSQL database, while Turso is a relational SQLite database managed via Drizzle ORM.

### A. Collection-to-Table Mapping Strategy

| Firestore Path | Turso DB Table (`src/db/schema.ts`) | Transformation Rules / Serialization |
| :--- | :--- | :--- |
| `/users/{userId}` | `users` | Map fields; serialize `subscription` and `preferences` objects to JSON strings. |
| `/workspaces/{workspaceId}` | `workspaces` | Map fields; serialize `incomeCategories`, `expenseCategories`, `investmentCategories` arrays to JSON strings. |
| `/workspaces/{wId}/accounts/{aId}` | `accounts` | Flattens subcollection. Record `workspaceId` column explicitly. |
| `/workspaces/{wId}/allocationRules/{rId}` | `allocation_rules` | Flattens subcollection. Record `workspaceId` column. |
| `/workspaces/{wId}/invoices/{iId}` | `invoices` | Serialize `items` array to JSON string. |
| `/workspaces/{wId}/transactions/{tId}` | `transactions` | Convert timestamps to ISO strings. Convert boolean flags. |
| `/workspaces/{wId}/pricingCalculations/{cId}` | `pricing_calculations` | Serialize `inputs` object to JSON string. |
| `/workspaces/{wId}/catalogItems/{itemId}` | `catalog_items` | Standard mapping. |

---

## 3. Migration Execution Script Structure

Here is a blueprint for the migration script (`migration.js`) which runs locally using the Firebase Admin SDK and `@libsql/client`:

```javascript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@libsql/client';
import fs from 'fs';

// Initialize Turso client
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateData() {
  console.log("Starting Firestore migration...");

  // 1. Migrate Users
  const usersSnapshot = await db.collection('users').get();
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    await turso.execute({
      sql: `INSERT OR REPLACE INTO users (uid, email, display_name, photo_url, created_at, subscription, preferences) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        doc.id,
        data.email,
        data.displayName || 'User',
        data.photoURL || null,
        data.createdAt || new Date().toISOString(),
        data.subscription ? JSON.stringify(data.subscription) : null,
        data.preferences ? JSON.stringify(data.preferences) : null
      ]
    });
  }

  // 2. Migrate Workspaces and Sub-collections
  const workspacesSnapshot = await db.collection('workspaces').get();
  for (const wDoc of workspacesSnapshot.docs) {
    const wData = wDoc.data();
    
    // Insert workspace
    await turso.execute({
      sql: `INSERT OR REPLACE INTO workspaces (id, name, type, owner_id, currency, created_at, updated_at, income_categories, expense_categories, investment_categories)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        wDoc.id,
        wData.name,
        wData.type,
        wData.ownerId,
        wData.currency || 'GHS',
        wData.createdAt || new Date().toISOString(),
        wData.updatedAt || new Date().toISOString(),
        JSON.stringify(wData.incomeCategories || []),
        JSON.stringify(wData.expenseCategories || []),
        JSON.stringify(wData.investmentCategories || [])
      ]
    });

    // Fetch and migrate accounts sub-collection
    const accountsSnapshot = await db.collection(`workspaces/${wDoc.id}/accounts`).get();
    for (const aDoc of accountsSnapshot.docs) {
      const aData = aDoc.data();
      await turso.execute({
        sql: `INSERT OR REPLACE INTO accounts (id, workspace_id, name, balance, currency, is_default, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [aDoc.id, wDoc.id, aData.name, aData.balance, aData.currency, aData.isDefault ? 1 : 0, aData.updatedAt || null]
      });
    }

    // Fetch and migrate transactions
    const transSnapshot = await db.collection(`workspaces/${wDoc.id}/transactions`).get();
    for (const tDoc of transSnapshot.docs) {
      const tData = tDoc.data();
      await turso.execute({
        sql: `INSERT OR REPLACE INTO transactions (id, workspace_id, type, amount, currency, category, date, description, payee_payer, is_loan, loan_status, account_id, affects_cash, affects_profit)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          tDoc.id, wDoc.id, tData.type, tData.amount, tData.currency, tData.category, tData.date, tData.description,
          tData.payeePayer || null, tData.isLoan ? 1 : 0, tData.loanStatus || null, tData.accountId || null,
          tData.affects_cash ? 1 : 0, tData.affects_profit ? 1 : 0
        ]
      });
    }
  }

  console.log("Migration complete!");
}

migrateData().catch(console.error);
```

---

## 4. Rollout & Validation Plan

1. **Dry-Run Import**: Run imports on Clerk and Turso using staging environments.
2. **Data Integrity Check**: Compare record counts between Firestore and Turso tables.
3. **Authentication Verification**: Verify target user password validation using Clerk's dashboard or manual login.
