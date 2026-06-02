# Clerk Re-Integration Plan — IzyFlow

## Overview

React SPA (Vite) + Express backend. Current SDK (`@clerk/react` + `@clerk/express`).

## Phase 1 — Install & Env

1. **Install packages**
   ```bash
   npm install @clerk/react@latest @clerk/express
   ```
2. **Provision Clerk app via CLI**
   ```bash
   clerk init --framework react -y
   ```
   Writes `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env`.

## Phase 2 — Frontend: main.tsx

3. **Wrap App with `ClerkProvider`** — no manual `publishableKey` prop (auto-read from env var).
   ```tsx
   import { ClerkProvider } from '@clerk/react'

   <ClerkProvider afterSignOutUrl="/">
     <App />
   </ClerkProvider>
   ```
4. **Create `ClerkAppWrapper`** using `useAuth()` + `useUser()` — passes the same `auth` prop shape to `<App>` (isLoaded, isSignedIn, userId, email, displayName, photoURL, getToken, signOut).
5. **Remove `mockAuth`** — replace with actual Clerk hook data.

## Phase 3 — Frontend: AuthModal

6. **Restore `AuthModal`** using Clerk's `<SignIn>` / `<SignUp>` components from `@clerk/react`.
   - Keep existing modal shell (backdrop, animations, close button)
   - `<SignIn routing="hash" signUpUrl="#/switch-to-sign-up" />`
   - Verify `routing="hash"` still supported in current SDK; fallback to `routing="virtual"` if not.

## Phase 4 — Frontend: Token & Sign-Out

7. **Token flow already works** — `getToken()` from Clerk returns real JWT, `setAuthToken()` stores it.
8. **Fix sign-out** in `App.tsx` — add `setAuthToken(null)` after `auth.signOut()`.

## Phase 5 — Backend: Express Middleware

9. **Re-add `@clerk/express` middleware** in `server.ts`:
   - `clerkMiddleware()` — global, authenticates every request
   - `requireAuth()` — per-route, returns 401 if no valid session
   - Extract `userId` and `primaryEmailAddress` via `getAuth(req)` → set `req.auth`
10. **Add TypeScript types** — create `types/globals.d.ts`:
    ```ts
    /// <reference types="@clerk/express/env" />
    ```

## Phase 6 — Verify

11. **Typecheck**: `npm run lint`
12. **Test flow**: open `localhost:3000`, click "Get Started", see Clerk sign-up, create account, verify redirect and API calls work.

## Files to touch

| File | Change |
|------|--------|
| `package.json` | Add `@clerk/react`, `@clerk/express` |
| `.env` | Add `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| `src/main.tsx` | Re-add `ClerkProvider` (no `publishableKey` prop) + wrapper |
| `src/components/AuthModal.tsx` | Re-add `<SignIn>` / `<SignUp>` |
| `src/App.tsx` | Add `setAuthToken(null)` on sign-out |
| `server.ts` | Re-add `clerkMiddleware()`, `requireAuth()`, `getAuth()` |
| `types/globals.d.ts` | Add `/// <reference types="@clerk/express/env" />` |
