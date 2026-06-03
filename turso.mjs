import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = process.argv[2] || "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
const rs = await db.execute(sql);
console.log(JSON.stringify(rs.rows, null, 2));
