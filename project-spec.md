# Balancr — Project Spec

**Balancr** is a full-stack personal finance web app built on Plaid, with a Wealthsimple-grade UI. Dual purpose: genuinely useful to me (tracks my real RBC + Wealthsimple accounts) **and** a portfolio piece for fintech engineering roles.

**Stack:** Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · Postgres + Prisma · NextAuth · Plaid · Vercel + Neon.

**Cost:** $0 — Vercel Hobby (hosting), Neon free tier (Postgres), Plaid Trial (real bank data, up to 10 accounts).

---

## 1. What it does

Link a bank account (Plaid), auto-sync transactions, categorize spending, set budgets, and see net worth + spending trends over time on a clean dashboard. The headline signal for fintech: a real Plaid integration inside a production-shaped app.

## 1a. Two run modes (same codebase, one env var)

The Plaid environment is set via `PLAID_ENV`. Nothing else changes.

- **Production (Trial plan) — for my real use.** Free, up to 10 real linked accounts. Link my actual **RBC** and **Wealthsimple** accounts and track real finances.
- **Sandbox — for the public demo.** Reviewers log in with Plaid's fake test credentials (`user_good` / `pass_good`), see fake transactions, and try the full app without any real data.

**My accounts, verified:**

- **RBC** — direct API agreement with Plaid; stable, official, API-based connection. Best-case Canadian link.
- **Wealthsimple** — supported, but Plaid requires **re-authentication every ~30 days**. Build a "re-connect" flow to handle expired Items gracefully (realistic fintech engineering anyway).
- **CSV import** — fallback safety net for any account that won't link or for historical data before the link date.

## 2. Core features (MVP)

- **Bank linking** via Plaid Link (works in both sandbox and production), with OAuth-style connect flow.
- **Re-connect flow** — detect expired/errored Items (e.g. Wealthsimple's 30-day expiry) and prompt re-authentication.
- **Transaction sync** — pull, store, and de-duplicate transactions; handle Plaid webhooks for incremental updates.
- **Auto-categorization** — map Plaid categories to your own taxonomy; let the user re-categorize and remember the rule.
- **CSV import** — upload a bank CSV, map columns, de-dup against existing transactions.
- **Budgets** — per-category monthly limits with budget-vs-actual and live progress bars.
- **Dashboard** — net worth over time, cash-flow (in vs. out), spending-by-category donut, recent transactions.
- **Auth** — email/OAuth login, each user sees only their own data.

## 3. Stretch (the "wow" layer)

- **Net-worth trend** with assets/liabilities split.
- **Subscription detection** — flag recurring charges.
- **Simple cash-flow forecast** — project month-end balance from recurring items.
- **CSV import** fallback for banks Plaid doesn't cover.

## 4. Data model (Prisma sketch)

```
User        id, email, name, createdAt
Item        id, userId, plaidItemId, accessToken(enc), institution
Account     id, itemId, plaidAccountId, name, type, subtype, currentBalance
Transaction id, accountId, plaidTxnId(unique), date, amount, name, category, pending
Category    id, userId, name, parent  (custom taxonomy)
Budget      id, userId, categoryId, month, limitAmount
Rule        id, userId, matchPattern, categoryId  (for auto-categorization)
```

Store money as integer cents, never floats. Encrypt Plaid access tokens at rest.

## 5. Architecture

- **Next.js App Router**: server components for data-heavy pages, route handlers (`/api/*`) for Plaid exchange + webhooks.
- **Plaid flow**: client opens Plaid Link → gets `public_token` → server exchanges for `access_token` → store encrypted → sync transactions.
- **Webhooks**: Plaid posts `SYNC_UPDATES_AVAILABLE` → route handler pulls the delta via `/transactions/sync`.
- **Prisma** as the single DB access layer. Neon (serverless Postgres) pairs cleanly with Vercel.

**Hosting / cost (all free tiers):**

- **Vercel Hobby** — hosts the Next.js app, free.
- **Neon free tier** — 0.5 GB storage, scale-to-zero (wakes on request, no manual un-pause), 100 compute-hrs/mo. Vastly more than a personal transaction history needs. Chosen over Supabase because Supabase pauses inactive projects after 1 week (bad for a demo someone clicks weeks later).
- **Plaid Trial** — real production data, up to 10 Items, free.
- Only ever costs money if it scales to many real users — not a concern here.

## 6. Making it Wealthsimple-slick

- shadcn/ui components + Tailwind; restrained palette (one accent color), generous whitespace, large numbers for balances.
- Charts via **Recharts** or **visx** — smooth, minimal, no gridline clutter.
- Skeleton loaders (not spinners), subtle transitions with **Framer Motion**.
- Mobile-first responsive; the dashboard should feel like an app, not a table dump.
- Dark mode from day one — it reads as "premium fintech."

## 7. Build order

1. Scaffold Next.js + Tailwind + shadcn/ui; deploy an empty app to Vercel.
2. Auth (NextAuth) + Postgres/Prisma schema + Neon.
3. Plaid Link in **sandbox** → exchange token → store Item/Account. (Build against sandbox first — free, fast, no re-auth friction.)
4. Transaction sync + webhook handler + de-dup.
5. Categorization (Plaid categories → your taxonomy → user override rules).
6. Budgets + budget-vs-actual.
7. Dashboard UI + charts. Polish pass for the slick look.
8. **Switch to Plaid Trial (production)** → link real RBC + Wealthsimple → add the re-connect flow for expired Items.
9. CSV import + stretch features. README with screenshots + architecture diagram + live (sandbox) demo link.

## 8. Portfolio presentation

- **Live demo** on Vercel running in Plaid **sandbox** (reviewers log in with `user_good` / `pass_good` — no real bank, no real data exposed). Keep your own real-data instance separate/private.
- **README** leads with a screenshot, one-line pitch, architecture diagram, and the Plaid/webhook story.
- Clean commit history and a short "engineering decisions" section (why integer cents, why token encryption, how sync + de-dup works) — this is what fintech reviewers actually read.

## 9. Watch-outs

- **Never commit Plaid secrets**; use env vars + Vercel secrets.
- **Encrypt access tokens**; treat them like passwords.
- **Idempotent sync** — de-dup on `plaidTxnId` so re-runs don't double-count.
- **Wealthsimple re-auth** — Items expire ~every 30 days; handle the `ITEM_LOGIN_REQUIRED` error and surface a re-connect prompt instead of silently failing.
- **Plaid Trial limit** — 10 real Items. Fine for personal use; don't design as if it scales to many users.
- Keep the **real-data instance private** — don't point the public demo link at your production/real-bank deployment.
