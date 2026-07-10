import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    currency text DEFAULT 'GHS' NOT NULL,
    invoices_per_month integer,
    max_workspaces integer,
    features text,
    is_active integer DEFAULT 1 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES users(uid),
    plan_id text NOT NULL REFERENCES subscription_plans(id),
    status text DEFAULT 'Active' NOT NULL,
    start_date text NOT NULL,
    expiry_date text,
    auto_renew integer DEFAULT 1 NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payment_transactions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES users(uid),
    subscription_id text REFERENCES subscriptions(id),
    reference text NOT NULL UNIQUE,
    amount integer NOT NULL,
    currency text DEFAULT 'GHS' NOT NULL,
    status text NOT NULL,
    plan_name text,
    metadata text,
    created_at text NOT NULL
  )`,
];

for (const sql of statements) {
  try {
    await db.execute(sql);
    console.log(`✅ ${sql.split('\n')[0].replace('CREATE TABLE IF NOT EXISTS ', '').trim()}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

console.log('✅ Subscription migration complete');
process.exit(0);
