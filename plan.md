# Balancr — Build Plan

Iterative plan derived from [project-spec.md](project-spec.md). Each iteration ends in a working, deployable state. Do them in order; don't start an iteration until the previous one's "Done when" holds.

---

## Iteration 0 — Scaffold

**Goal:** App skeleton running locally. (Deployment deferred to Iteration 8.)

**Steps:**
1. `npx create-next-app` — App Router, TypeScript, Tailwind, ESLint.
2. Install + init shadcn/ui; set base theme (one accent color, dark mode via `class` strategy).
3. Add dark mode toggle (next-themes) — day one, per spec.
4. Create GitHub repo, push.
5. Add placeholder landing page with app name.

**Done when:** `npm run dev` serves the app locally; dark mode toggles.

---

## Iteration 1 — Auth + Database

**Goal:** Users can sign in; schema exists in Neon; every table row is user-scoped.

**Steps:**
1. Create Neon project (free tier); grab pooled connection string.
2. Install Prisma; write full schema from spec §4: `User`, `Item`, `Account`, `Transaction`, `Category`, `Budget`, `Rule`.
   - Money = integer cents everywhere. No floats.
   - `Transaction.plaidTxnId` unique — de-dup anchor.
   - `Item.accessToken` stored encrypted (add `encryptToken`/`decryptToken` helpers using AES-256-GCM + env key now, even before Plaid exists).
3. Set up NextAuth: email (magic link or credentials) + one OAuth provider (Google), Prisma adapter.
4. Middleware: protect all app routes; unauthenticated → sign-in page.
5. Env var hygiene: `.env.example` committed, real `.env` gitignored.

**Done when:** Sign in/out works locally; `prisma migrate` applied to Neon; querying as user A never returns user B's rows.

---

## Iteration 2 — Plaid Link (Sandbox)

**Goal:** Link a fake bank via Plaid sandbox; Item + Accounts persisted.

**Steps:**
1. Plaid dashboard: get sandbox `client_id`/`secret`; set `PLAID_ENV=sandbox`.
2. Route handler `POST /api/plaid/create-link-token` — creates link token for current user.
3. Client: `react-plaid-link` component, "Connect a bank" button.
4. Route handler `POST /api/plaid/exchange` — exchange `public_token` → `access_token`, encrypt, store `Item` + fetch and store `Account`s (name, type, subtype, balance in cents).
5. Accounts page: list linked institutions + accounts + balances.

**Done when:** Logging in with `user_good`/`pass_good` links a sandbox bank and its accounts appear with balances.

---

## Iteration 3 — Transaction Sync + Webhooks

**Goal:** Transactions pulled, stored, de-duplicated; webhook drives incremental updates.

**Steps:**
1. Sync function using `/transactions/sync` (cursor-based): store cursor per Item, upsert on `plaidTxnId`, handle added/modified/removed, amounts → integer cents.
2. Trigger initial sync right after link (Iteration 2 exchange handler calls it).
3. Webhook route `POST /api/plaid/webhook`: verify request, on `SYNC_UPDATES_AVAILABLE` run sync for that Item. (Local dev: use Plaid sandbox webhook fire endpoint or ngrok.)
4. Manual "Sync now" button as fallback.
5. Transactions page: paginated list (date, name, amount, account, pending badge).
6. Prove idempotency: run sync twice, row count unchanged.

**Done when:** Sandbox transactions appear; re-sync never duplicates; sandbox-fired webhook triggers a delta pull.

---

## Iteration 4 — Categorization

**Goal:** Every transaction gets a category from own taxonomy; user overrides become remembered rules.

**Steps:**
1. Seed default `Category` taxonomy per user (Groceries, Dining, Transport, Housing, Subscriptions, Income, etc., with parents).
2. Mapping table: Plaid personal-finance categories → own taxonomy; apply during sync.
3. UI: inline category picker on each transaction row.
4. On manual re-categorize, offer "always do this" → create `Rule` (`matchPattern` on merchant name → `categoryId`).
5. Rules apply during sync *before* the Plaid-category fallback; rules win.
6. Category management page: add/rename/re-parent custom categories.

**Done when:** New synced transactions land in sensible categories; re-categorizing a merchant with a rule auto-applies to future syncs.

---

## Iteration 5 — Budgets

**Goal:** Per-category monthly limits with live budget-vs-actual.

**Steps:**
1. Budget CRUD: set/edit monthly `limitAmount` (cents) per category, keyed on `month`.
2. Actuals query: sum transactions per category for the month (exclude income/transfers).
3. Budgets page: progress bar per budget — spent / limit, color shifts near/over limit.
4. Month navigation (prev/next); copy-last-month's-budgets shortcut.

**Done when:** Setting a budget and syncing a spend moves the bar correctly; over-budget state visible.

---

## Iteration 6 — Dashboard + Polish

**Goal:** The Wealthsimple-slick face of the app. Portfolio screenshot lives here.

**Steps:**
1. Dashboard layout (server components): net worth headline (large number), net-worth-over-time line chart, cash-flow in-vs-out bar chart, spending-by-category donut, recent transactions list.
2. Charts: Recharts (or visx) — minimal, no gridline clutter, animated on load.
3. Skeleton loaders on all data-heavy sections — no spinners.
4. Framer Motion: subtle page/element transitions.
5. Mobile pass: responsive at 375px; feels like app, not table dump.
6. Polish pass: spacing, typography scale, dark-mode contrast check, empty states for fresh accounts.

**Done when:** Dashboard looks screenshot-worthy in light + dark on mobile + desktop with real sandbox data.

---

## Iteration 7 — Production Switch + Re-connect Flow

**Goal:** Real RBC + Wealthsimple linked (running locally); expired Items recover gracefully.

**Steps:**
1. Apply for Plaid Trial (production); get production keys.
2. Run locally with `PLAID_ENV=production` in a separate `.env` profile; webhooks via ngrok tunnel. Sandbox and production envs never mix (spec §9).
3. Link real RBC + Wealthsimple.
4. Re-connect flow:
   - Catch `ITEM_LOGIN_REQUIRED` on any Plaid call; mark Item as errored in DB.
   - Listen for `ITEM: ERROR` / `PENDING_EXPIRATION` webhooks.
   - UI banner on errored Items → "Reconnect" button → Plaid Link **update mode** (link token with `access_token`).
   - Test in sandbox first: `/sandbox/item/reset_login` forces the state.
5. Verify sync of real transactions; verify webhook delivery through the tunnel.

**Done when:** Real accounts sync; forcing login-required in sandbox shows reconnect banner and update-mode Link fixes it.

---

## Iteration 8 — CSV Import + Stretch + Deploy + Portfolio Packaging

**Goal:** Fallback import path, wow features, app live on Vercel, README that sells it.

**Steps:**
1. CSV import: upload → column-mapping UI (date/amount/description) → preview → import with de-dup (hash of date+amount+name against existing, plus `plaidTxnId` null-safe).
2. Stretch (in value order, cut as needed):
   - Subscription detection — flag recurring same-merchant, same-ish-amount monthly charges.
   - Net-worth assets/liabilities split on trend chart.
   - Cash-flow forecast — project month-end balance from recurring items.
3. **Deploy:**
   - Connect repo to Vercel Hobby; set all secrets in Vercel dashboard (`PLAID_ENV=sandbox` for the public demo).
   - Point Plaid webhook URL at the deployed domain; verify webhook delivery end-to-end.
   - Optionally deploy a second, private instance with `PLAID_ENV=production` for real data — or keep the real-data instance local-only. Public demo stays sandbox (spec §9).
4. README: screenshot first, one-line pitch, architecture diagram, Plaid/webhook story, "engineering decisions" section (integer cents, token encryption, sync + de-dup idempotency), live sandbox demo link with `user_good`/`pass_good` instructions.
5. Final sweep: no secrets in history, clean commits, demo link points at sandbox instance only.

**Done when:** Reviewer can click demo link, log in with sandbox creds, and see the full app; README reads like a case study.

---

## Standing rules (every iteration)

- Integer cents, never floats.
- Never commit secrets; `.env.example` stays current.
- All queries scoped to session user.
- Idempotent sync — re-runs never double-count.
- `main` always works locally; deployment happens once, in Iteration 8.
