import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await db.execute("ALTER TABLE workspaces ADD COLUMN collaborators text");
  console.log("✅ Added collaborators column to workspaces");
} catch (e) {
  console.error(`❌ ${e.message}`);
}

process.exit(0);
