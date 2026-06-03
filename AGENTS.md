## Package manager

Use pnpm exclusively. Never use npm or yarn.

## Agent skills

- Always use the **caveman** skill. Be terse, direct, no filler. Cut thinking tokens. Go straight to the point.

## Turso DB queries

Query remote Turso DB directly via `turso.mjs` script in project root:

```
node --env-file=".env" turso.mjs "SELECT uid, email FROM users"
```

Omit SQL arg to list all tables. Uses `@libsql/client` + env vars `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
