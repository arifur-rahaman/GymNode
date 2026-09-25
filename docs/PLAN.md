# GymNode — Build Plan (Phase 1: Web)

> Status: **M7 done (26 Sep 2026). M6 (messaging) and M8 (access control) are next, when the founder is ready.** Q1–Q5 are decided (see §8).
> Sources: `docs/design/CLAUDE_CODE_PROMPT.md` (the brief), `docs/design/DESIGN_SYSTEM.md`, `docs/design/tokens.css`, `docs/design/designs/*.dc.html`.
> Written 24 Sep 2026.

---

## 0. The short version

- **One code repository** holding the website, the shared business logic and the database, so the future mobile app can reuse most of it.
- **Supabase** does the database, logins, file storage, live updates and scheduled jobs. **Vercel** hosts the website.
- **The database protects itself.** Every table has Row Level Security (RLS): even if the website has a bug, Postgres refuses to show gym A's data to gym B. Money actions (take payment, verify, cancel, renew) run as **database functions**, so the web app and the future mobile app follow exactly the same rules.
- **Money is stored in paisa as whole numbers** (৳1,500 → `150000`). Whole numbers never produce rounding errors.
- **Payments are never deleted**, only cancelled with a reason, and every sensitive action goes to an audit log.
- We build in **9 milestones (M0–M8)**. I stop after each one and report back.

---

## 1. Library versions (checked 24 Sep 2026)

I checked the npm registry on 24 Sep 2026 for the latest published versions. The official docs sites (nextjs.org, supabase.com) are **blocked from this cloud environment**, so I couldn't read them directly. I confirmed the key Next.js 16 + Supabase setup through search results that quote the Supabase docs. **I'll check again when M0 starts**, because versions may have moved on.

| Tool              | Version to use                                          | Notes                                                                                                                                             |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js           | **16.3.x**                                              | App Router. In Next 16 the old `middleware.ts` file is now called **`proxy.ts`**. Supabase's docs use it to refresh login sessions.               |
| React             | **19.x** (currently 19.3)                               | Whatever Next 16 installs.                                                                                                                        |
| TypeScript        | **6.0.x**, not 7.0                                      | TS 7.0.2 is out, but the linting tool (`typescript-eslint` 8.70) only supports TS below 6.1 right now. We'll switch once it supports 7.           |
| Supabase JS / SSR | `@supabase/supabase-js` 2.117.x, `@supabase/ssr` 0.12.x | Uses the new **publishable key** env var (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and `auth.getClaims()` to check who is logged in on the server. |
| Supabase CLI      | 2.117.x                                                 | Runs Postgres + Auth + Storage locally in Docker, handles migrations, and runs RLS tests (`supabase test db`, which uses pgTAP).                  |
| Tailwind CSS      | **4.3.x**                                               | v4 is configured in CSS (`@theme`), not in a JS config file. Our `tokens.css` plugs in directly.                                                  |
| shadcn/ui         | CLI 4.21.x                                              | Copies component source into our repo, so we own it and can style it with our tokens.                                                             |
| next-intl         | 4.14.x                                                  | Supports Next 16.                                                                                                                                 |
| Zod               | 4.x                                                     | Validation, shared between browser and server.                                                                                                    |
| React Hook Form   | 7.88.x + `@hookform/resolvers` 5.x                      |                                                                                                                                                   |
| Recharts          | 3.x                                                     |                                                                                                                                                   |
| lucide-react      | 1.x                                                     | Icons.                                                                                                                                            |
| Vitest            | 5.x                                                     | Unit tests.                                                                                                                                       |
| Playwright        | 1.63.x                                                  | End-to-end tests. Chromium is already installed here.                                                                                             |
| pnpm + Turborepo  | pnpm 10+ (latest 12.x), turbo 2.x                       | Monorepo tooling. I'll pin one exact pnpm version in `package.json`.                                                                              |
| Node.js           | 22 LTS or newer                                         | Next 16 requires Node ≥ 20.9. I'm not certain which Node LTS Vercel defaults to today, so I'll check that at M0.                                  |

---

## 2. Architecture

```
 Browser (cheap Android / desktop)
        │  HTTPS
        ▼
 ┌─────────────────────────────┐        ┌──────────────────────────────┐
 │  Next.js on Vercel (apps/web)│        │  Supabase (cloud)             │
 │  • Server Components render  │ ─────► │  • Postgres + RLS             │
 │    pages with the user's own │  user  │  • Auth (sessions in cookies) │
 │    login (RLS applies)       │  JWT   │  • Storage (photos, logos)    │
 │  • Server Actions for forms  │        │  • Realtime (live check-ins)  │
 │  • Route handlers: device    │        │  • pg_cron + Edge Functions   │
 │    webhooks, exports, receipts│       │    (reminders, sending msgs)  │
 └─────────────────────────────┘        └──────────────────────────────┘
                                                   ▲
      Future: Expo mobile app ── same Supabase ────┘  (same RLS, same DB functions)
      Future: ZKTeco devices ── push to our endpoint (M8 spike decides how)
```

**Key decisions, in plain language**

1. **Business rules live in the database, not only in React.** "Take payment and renew" is one Postgres function (`record_payment_and_renew`). It runs in a transaction, so either everything saves or nothing does. The mobile app will call the same function, which is why the brief asks for reusable logic.
2. **The website talks to Supabase using the logged-in person's own identity.** The powerful "service role" key (it bypasses all security) is used **only** by background jobs and the device webhook, never in page code, and never in the browser.
3. **Direct table writes are limited.** For money tables (`payments`, `memberships`) the app cannot `UPDATE`/`DELETE` directly. It has to call a function that checks the role, writes the audit log and does the change. Simple things (e.g. editing a member's address) can use normal RLS-protected updates.
4. **Shared code in `packages/core`**: money and lakh formatting, Dhaka dates, Zod schemas, status rules, pricing maths. It has no React or Next.js code in it, so Expo can import it.
5. **Pages are paginated on the server.** Lists fetch 25 rows at a time, filtered in SQL with indexes, so the site stays fast on slow connections.
6. **Tenant = gym.** A user can belong to several gyms (e.g. an owner with two businesses). The active gym and branch live in a cookie, and the switcher changes them.
7. **URLs:** `/app/...` for the gym panel, `/admin/...` for super admin, `/join/[gymSlug]` for the public QR sign-up form, `/r/[token]` for public receipts. **No `/bn/` or `/en/` in the URL.** Language comes from the user's profile (with a cookie as fallback). This keeps links short and shareable, and next-intl supports it. _(The design README suggested `/[locale]/app`. See question Q6.)_

---

## 3. Folder structure

```
GymNode/
├─ apps/
│  └─ web/                          Next.js app
│     ├─ src/app/
│     │  ├─ (auth)/login, signup, onboarding/
│     │  ├─ app/                    gym panel: layout (sidebar/rail/bottom-nav)
│     │  │  ├─ page.tsx             dashboard
│     │  │  ├─ members/  members/[id]/  packages/  payments/  dues/
│     │  │  ├─ expenses/  sales/  reports/  messages/  access/  staff/  settings/
│     │  ├─ admin/                  super admin: dashboard, gyms, billing, ops
│     │  ├─ join/[gymSlug]/         public QR self-registration
│     │  ├─ r/[token]/              public receipt page
│     │  ├─ api/devices/…           device push endpoint (M8)
│     │  └─ dev/ui/                 component gallery (dev only)
│     ├─ src/components/ui/         shadcn components themed with tokens
│     ├─ src/components/…           app components (KpiCard, StatusBadge, DataTable…)
│     ├─ src/lib/supabase/          server/browser client helpers
│     ├─ src/i18n/ + messages/bn.json, en.json
│     ├─ src/proxy.ts               session refresh + route guards
│     └─ e2e/                       Playwright tests
├─ packages/
│  ├─ core/                         pure TS: money, dates, status, schemas (zod), pricing
│  ├─ db/                           generated Supabase types + typed query helpers
│  └─ config/                       shared eslint / tsconfig / prettier
├─ supabase/
│  ├─ migrations/                   SQL files, one per change, never edited after merge
│  ├─ tests/                        pgTAP RLS tests
│  ├─ functions/                    Edge Functions (send-messages, reminders)
│  ├─ seed.sql (+ seed script)      2 gyms, ~60 members, 6 months of payments, Bangla data
│  └─ config.toml
├─ docs/  PLAN.md, ACCESS_CONTROL.md, DEPLOY.md, design/
├─ .github/workflows/ci.yml         lint + typecheck + unit + RLS tests
├─ .env.example
└─ README.md
```

---

## 4. Database design

### 4.1 Conventions

| Topic          | Decision                                                                                                | Why                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDs            | `uuid` (`gen_random_uuid()`)                                                                            | Safe to expose in URLs, and mobile apps can create them offline later.                                                                                                                                                                                |
| Money          | **`bigint` paisa**, columns end in `_paisa`                                                             | Whole numbers avoid rounding bugs. Supabase returns `numeric` as text, which is awkward in JS. `bigint` paisa comes back as a normal number, and JS numbers are exact up to about ৳90 trillion. Formatting to `৳3,42,000` happens in `packages/core`. |
| Timestamps     | `timestamptz` (stored in UTC)                                                                           | Shown in `Asia/Dhaka`.                                                                                                                                                                                                                                |
| Calendar dates | `date` for membership start/end, expense date, DOB                                                      | "Membership ends 24 Oct" is a Dhaka calendar day, not a moment in time. "Today" is always worked out in `Asia/Dhaka`, never in UTC.                                                                                                                   |
| Enums          | Postgres enums for stable lists (roles, payment method, statuses), text + check for lists that may grow |                                                                                                                                                                                                                                                       |
| Audit columns  | `created_at`, `updated_at` (trigger), `created_by` where useful                                         |                                                                                                                                                                                                                                                       |
| Soft delete    | `deleted_at` on members, packages, products                                                             | Keeps payment history intact. Payments use `status = cancelled` instead.                                                                                                                                                                              |
| Tenant key     | `gym_id` on **every** gym-owned table, even when it could be looked up through a parent                 | Makes RLS simple and fast (one indexed column check).                                                                                                                                                                                                 |
| Indexes        | `(gym_id, …common filter…)` on every tenant table                                                       | e.g. `members(gym_id, status)`, `payments(gym_id, paid_at desc)`, `attendance(gym_id, checked_in_at desc)`.                                                                                                                                           |

### 4.2 Platform tables

| Table                   | Key columns                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | `user_id` PK→auth.users, `full_name`, `phone`, `locale` (bn/en), `theme` (dark/light), `last_gym_id`                                                                                                                                                                                                                                                                  |
| `platform_admins`       | `user_id` PK, `role` (`super_admin`/`support`), `created_at`                                                                                                                                                                                                                                                                                                          |
| `plans`                 | `name`, `name_bn`, `price_paisa` (placeholder, editable), `billing_period`, `max_members`, `max_branches`, `max_devices` (null = unlimited), `sms_quota`, `whatsapp_quota`, `features jsonb`, `is_active`, `sort_order`                                                                                                                                               |
| `gyms`                  | `name`, `slug` (unique, used in QR link), `code_prefix` (e.g. `PH`, for member codes), `owner_user_id`, `city`, `address`, `phone`, `logo_path`, `status` (`trial`/`active`/`past_due`/`suspended`/`cancelled`), `trial_ends_at`, `plan_id`, `settings jsonb` (monthly income target, quiet hours, invoice prefix, receipt defaults), `timezone` default `Asia/Dhaka` |
| `gym_subscriptions`     | `gym_id`, `plan_id`, `status`, `current_period_start/end`, `price_paisa` (price locked at signup)                                                                                                                                                                                                                                                                     |
| `subscription_invoices` | `gym_id`, `subscription_id`, `invoice_no` (`SUB-0931`), `amount_paisa`, `due_date`, `status` (`unpaid`/`paid`/`void`), `paid_at`, `method` (bkash/nagad/rocket/card/**bank**/cash), `transaction_id`                                                                                                                                                                  |
| `gym_users`             | `gym_id`, `user_id`, `role` (`owner`/`manager`/`reception`/`trainer`), `branch_ids uuid[]` (null = all branches), `is_active`, `display_name`, unique(gym_id,user_id)                                                                                                                                                                                                 |
| `staff_invites`         | `gym_id`, `phone_or_email`, `role`, `branch_ids`, `token_hash`, `expires_at`, `accepted_at`                                                                                                                                                                                                                                                                           |
| `staff_compensation`    | `gym_id`, `gym_user_id`, `monthly_salary_paisa`, `notes`. **Owner-only**                                                                                                                                                                                                                                                                                              |
| `branches`              | `gym_id`, `name`, `address`, `is_active`                                                                                                                                                                                                                                                                                                                              |
| `gym_counters`          | `gym_id`, `kind` (`member_code`/`invoice`/`sale`), `year`, `next_value`. Row-locked, so numbers never repeat                                                                                                                                                                                                                                                          |
| `support_sessions`      | `admin_user_id`, `gym_id`, `reason`, `started_at`, `expires_at` (≤ 2h), `ended_at`. Powers read-only "support mode"                                                                                                                                                                                                                                                   |
| `support_tickets`       | `gym_id`, `opened_by`, `subject`, `body`, `priority`, `status`, `assigned_to`                                                                                                                                                                                                                                                                                         |
| `audit_logs`            | `gym_id` (nullable for platform events), `actor_user_id`, `actor_kind` (staff/platform_admin/system/device), `action` (e.g. `payment.cancelled`), `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `ip`, `created_at`. **Append-only**: nobody can update or delete rows                                                                          |
| `message_usage`         | `gym_id`, `month` (date, 1st of month), `sms_count`, `whatsapp_count`, `cost_paisa`                                                                                                                                                                                                                                                                                   |

### 4.3 Gym tables

| Table                                                               | Key columns / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `members`                                                           | `gym_id`, `branch_id`, `member_code` (`PH-0142`, unique per gym), `full_name`, `phone`, `gender`, `dob`, `photo_path`, `address`, `emergency_contact_name/phone`, `joined_at`, `status` (`pending`/`active`/`inactive`), `assigned_trainer_id`→gym_users, `locker_id`, `notes`, `source` (`staff`/`qr_self`), `deleted_at`. Later: `user_id` so a member can log into the app. Search index: trigram on name + phone + code                                                                                                                                                                                                                                                  |
| `packages`                                                          | `gym_id`, `name`, `name_en`, `duration_days`, `price_paisa`, `admission_fee_paisa`, `is_active`, `sort_order`. Price changes are audited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `memberships`                                                       | `gym_id`, `member_id`, `package_id`, `start_date`, `end_date`, `price_paisa` (copied from package at sale time), `admission_fee_paisa`, `discount_paisa`, `status` (`active`/`frozen`/`cancelled`; "expired" is **calculated** from `end_date`, not stored), `frozen_from`, `frozen_until`, `previous_membership_id` (renewal chain)                                                                                                                                                                                                                                                                                                                                         |
| `membership_freezes`                                                | `membership_id`, `from_date`, `to_date`, `days`, `reason`, `created_by`. History of freezes. Unfreezing pushes `end_date` later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `payments`                                                          | `gym_id`, `branch_id`, `member_id` (nullable), `membership_id` (nullable), `sale_id` (nullable), `kind` (`membership`/`admission`/`sale`/`due`/`other`), `amount_paisa`, `discount_paisa`, `method` (`cash`/`bkash`/`nagad`/`rocket`/`card`), `transaction_id` (unique per gym+method when present, to catch reused bKash IDs), `status` (`pending_verification`/`completed`/`cancelled`), `paid_at`, `received_by`, `verified_by`, `verified_at`, `invoice_no` (per gym, e.g. `INV-2026-00042`), `receipt_token` (for `/r/[token]`), `receipt_sent_at`, `cancelled_by`, `cancelled_at`, `cancel_reason`. **No DELETE for anyone. No direct UPDATE: only through functions** |
| `member_dues` (view)                                                | Per member: sum of what they owe on memberships (price + admission − discount) minus sum of payments linked to them. Drives the "বকেয়া" amounts and the dues list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `member_status_v` (view)                                            | One display status per member (see 4.5) plus `days_left` and `due_paisa`. Used by the list, dashboard and filter tab counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `expense_categories`                                                | `gym_id`, `name`, `is_salary` (salary categories are owner-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `expenses`                                                          | `gym_id`, `branch_id`, `category_id`, `amount_paisa`, `spent_on` (date), `note`, `created_by`, `deleted_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `products`                                                          | `gym_id`, `name`, `sku`, `price_paisa`, `cost_paisa` (owner/manager only), `stock_qty` (kept up to date by trigger), `low_stock_at`, `is_active`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `stock_movements`                                                   | `gym_id`, `product_id`, `qty` (+in / −out), `reason` (`purchase`/`sale`/`adjustment`/`return`), `sale_id`, `created_by`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sales`, `sale_items`                                               | `gym_id`, `branch_id`, `member_id` (nullable), `sale_no`, `total_paisa`, `created_by`; items: `product_id`, `qty`, `unit_price_paisa`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `lockers`                                                           | `gym_id`, `branch_id`, `code` (`L-17`), `status`, `member_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `devices`                                                           | `gym_id`, `branch_id`, `name`, `door_name` (মেইন গেট / লেডিস জোন), `model` (SenseFace 2A), `serial`, `connection_type` (`adms_push`/`biotime`/`manual`), `status` (`online`/`offline`/`offline_mode`), `last_seen_at`, `secret_hash` (device auth), `firmware`                                                                                                                                                                                                                                                                                                                                                                                                               |
| `biometric_enrollments`                                             | `gym_id`, `member_id`, `device_id`, `method` (`face`/`fingerprint`/`rfid`), `device_user_id`, `enrolled_at`. **No templates are ever stored.** This is only "enrolled yes/no" + device user ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `access_rules`                                                      | `gym_id` PK, `auto_lock_on_expiry` (default true), `grace_days` (default 0), `warn_on_due` (default true), `allow_staff_override` (**default false**), `offline_mode` (default true)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `attendance`                                                        | `gym_id`, `branch_id`, `member_id` (nullable for unknown faces), `device_id`, `checked_in_at`, `method` (`face`/`fingerprint`/`rfid`/`qr`/`manual`), `result` (`allowed`/`blocked`), `reason` (`expired`/`frozen`/`due`/`unknown`/`override`), `override_by`. Realtime is switched on for this table                                                                                                                                                                                                                                                                                                                                                                         |
| `message_templates`                                                 | `gym_id` (null = platform default), `key` (`payment_receipt`/`due_reminder`/`expiry_reminder`/`birthday`), `channel`, `locale`, `body` with `{{name}}`-style variables, `is_active`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `message_outbox`                                                    | `gym_id`, `channel`, `to_phone`, `template_key`, `payload jsonb`, `send_after` (respects quiet hours), `status`, `attempts`, `dedupe_key` (stops the same reminder going out twice)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `message_logs`                                                      | `gym_id`, `channel`, `to_phone`, `template_key`, `provider`, `provider_message_id`, `status`, `cost_paisa`, `error`, `sent_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `workout_plans`, `workout_items`, `diet_plans`, `body_measurements` | Tables are created now (all with `gym_id`, `member_id`, `created_by` trainer), screens come later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 4.4 Important database functions (all `security definer` with explicit role checks + audit)

| Function                                                                                    | What it does                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_gym_with_owner(...)`                                                                | Onboarding: gym + first branch + owner `gym_users` row + trial subscription + default access rules/templates, all in one step                                                                                                                                                                                                             |
| `next_counter(gym, kind)`                                                                   | Gets the next member code / invoice no. safely                                                                                                                                                                                                                                                                                            |
| `record_payment_and_renew(member, package, amount, discount, method, txn_id, send_receipt)` | Works out the new start/end date (continues from the current end date if not yet expired, otherwise from today in Dhaka), creates the membership, creates the payment (`completed` for cash/card, `pending_verification` for bKash/Nagad/Rocket), assigns the invoice no., queues the receipt, writes the audit log. **One transaction.** |
| `verify_payment(payment)`                                                                   | Owner/manager only → `completed` + audit                                                                                                                                                                                                                                                                                                  |
| `cancel_payment(payment, reason)`                                                           | Reception may cancel **only their own pending** payment. Owner/manager can cancel anything, verified payments included. Reason required. Audited                                                                                                                                                                                          |
| `freeze_membership` / `unfreeze_membership`                                                 | Freezing records a freeze. Unfreezing pushes `end_date` later by the days frozen. Audited                                                                                                                                                                                                                                                 |
| `approve_self_registration(member)`                                                         | QR sign-up: pending → active                                                                                                                                                                                                                                                                                                              |
| `start_support_session(gym, reason)`                                                        | Super admin only. Creates a 2-hour read-only session + audit                                                                                                                                                                                                                                                                              |
| `gym_plan_usage(gym)` / `assert_plan_limit(gym, kind)`                                      | Enforces member/branch/device limits (called from insert triggers)                                                                                                                                                                                                                                                                        |
| `dashboard_summary(gym, branch)`, `report_*`                                                | Aggregations for the dashboard and reports. Profit/salary numbers come back only to owners                                                                                                                                                                                                                                                |
| `ingest_device_event(...)`                                                                  | (M8) Called by the device endpoint with the service role. Decides allowed/blocked, writes attendance                                                                                                                                                                                                                                      |

### 4.5 Member display status (one badge per member)

The designs show one status per member: সক্রিয় / বকেয়া / মেয়াদ শেষ / ফ্রিজ. In reality someone can be "active **and** owing money", so I'll pick the badge in this priority order:

1. **ফ্রিজ (frozen)**: current membership frozen today
2. **মেয়াদ শেষ (expired)**: `end_date` < today (Dhaka), or no membership
3. **বকেয়া (due)**: membership valid but `due_paisa > 0`
4. **সক্রিয় (active)**

The due amount is always shown in its own column, so nothing is hidden. Payments in `pending_verification` **count as paid** here, and the member gets an extra "যাচাই বাকি" flag (decided in Q4).

### 4.6 Security model (RLS)

**Helper functions** (fast, `stable`, `security definer`, read `auth.uid()`):

- `my_gym_role(gym_id)` → the caller's role in that gym, or null
- `has_gym_role(gym_id, roles[])`
- `can_see_branch(gym_id, branch_id)` → true if `branch_ids` is null or contains the branch
- `in_support_session(gym_id)` → true if the caller is a platform admin with an active, unexpired support session for that gym
- `is_platform_admin()`

**Policy pattern for every gym table**

| Action          | Rule                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| SELECT          | `has_gym_role(gym_id, …allowed roles…)` AND branch check **OR** `in_support_session(gym_id)` (read-only)    |
| INSERT / UPDATE | Allowed roles only. Never allowed in support mode. Money tables: **no direct write at all**, functions only |
| DELETE          | Almost never. Soft delete via update. Payments/audit logs: no delete policy exists at all                   |

**Role matrix (first version, you can change it)**

|                                     | Owner            | Manager                          | Reception                    | Trainer           |
| ----------------------------------- | ---------------- | -------------------------------- | ---------------------------- | ----------------- |
| Members: view                       | all              | all                              | all                          | **assigned only** |
| Members: add / edit                 | ✓                | ✓                                | ✓                            | ✗                 |
| Members: delete (soft)              | ✓                | ✓                                | ✗                            | ✗                 |
| Packages: view                      | ✓                | ✓                                | ✓                            | ✓                 |
| Packages: create / change price     | ✓                | ✓                                | ✗                            | ✗                 |
| Take payment                        | ✓                | ✓                                | ✓                            | ✗                 |
| Verify bKash/Nagad/Rocket           | ✓                | ✓                                | ✗                            | ✗                 |
| Cancel payment                      | ✓                | ✓                                | own pending only             | ✗                 |
| Expenses                            | ✓ (incl. salary) | ✓ (no salary)                    | ✗                            | ✗                 |
| Sales (POS)                         | ✓                | ✓                                | ✓                            | ✗                 |
| Product cost / stock adjust         | ✓                | ✓                                | ✗                            | ✗                 |
| Reports: income, members            | ✓                | ✓                                | ✗                            | ✗                 |
| Reports: **profit**, staff salaries | ✓ only           | ✗                                | ✗                            | ✗                 |
| Workout/diet/measurements           | ✓                | ✓                                | ✗                            | assigned members  |
| Access rules / door override        | ✓                | ✓ (override only if rule allows) | override only if rule allows | ✗                 |
| Staff & settings, plan/billing      | ✓                | view staff                       | ✗                            | ✗                 |

**Super admins** do **not** get a "see everything" RLS rule. Instead:

- Platform screens (MRR, gym list, ops) use `security definer` functions that first check `is_platform_admin()`.
- Opening a gym's panel requires `start_support_session`, which is **audited**, **read-only** and **expires after 2 hours**. The gym panel shows a visible "সাপোর্ট মোড" banner.

**Storage**: `member-photos` bucket is **private**. Path is `{gym_id}/{member_id}.webp`, and policies check the gym from the folder name. Pages get short-lived signed URLs. `gym-logos` can be public.

**RLS tests (pgTAP, run in CI)**: at least

- gym A user cannot read gym B members/payments/audit logs
- reception cannot cancel a verified payment, cannot change a package price, cannot see expenses
- trainer sees only assigned members
- manager cannot see profit or salaries
- support session is read-only and stops working after expiry
- nobody can delete a payment or edit an audit log

### 4.7 Biometric & personal data

- No face or fingerprint templates in our database, ever. The only data stored is enrollment rows (method + device user ID).
- Phone numbers are masked in lists (`017•• •••421`) for trainers. Full number is shown to owner/manager/reception.
- Member photos are private (signed URLs only).

---

## 5. Front-end approach

- **Theme**: `tokens.css` is copied into `apps/web` and mapped into Tailwind v4 `@theme` (e.g. `bg-surface`, `text-muted`, `bg-accent`). shadcn components are restyled to match. No raw hex in components.
- **Dark by default**, light toggle, saved per user in `profiles.theme` + a cookie. The page renders with the right theme on the server, so there's no white flash on load.
- **Fonts**: Hind Siliguri + Space Grotesk via `next/font/google`, `.num` utility with tabular figures.
- **Layouts**: desktop 248px sidebar (≥1200), tablet 76px icon rail (768–1199), mobile top bar + 5-item bottom nav (<768). Tables switch to card lists on mobile. The take-payment side panel becomes a full-screen sheet on mobile.
- **Formatting** (`packages/core`): `formatTaka(150000) → "৳1,500"`, `formatTaka(34200000) → "৳3,42,000"`, compact `"৳3.42L"` for mobile KPIs, Dhaka dates via `Intl` with `timeZone: 'Asia/Dhaka'`. Numbers use English digits as the design system says.
- **Forms**: one Zod schema per form in `packages/core`. It's used by React Hook Form in the browser **and** checked again on the server. Error messages are in Bangla (and English).
- **Every list/page** gets loading, empty (inviting action) and error states.
- **Performance for cheap phones**: Server Components by default, charts loaded only where needed, images compressed on the phone before upload (WebP, ~800px), 25-row server pagination.
- **Nav items not built yet** (ওয়েবসাইট, etc.) are shown with a "শীঘ্রই" (coming soon) tag _(see Q9)_.
- **`/dev/ui`** shows every base component in both themes. It's only available in development.

---

## 6. Milestone checklist

Each milestone ends with: lint + type-check + tests green, this file updated, and a short report to you.

### M0 — Setup

- [x] pnpm + Turborepo monorepo (`apps/web`, `packages/core`, `packages/db`, `packages/config`)
- [x] Next.js 16 app, TypeScript strict, ESLint + Prettier
- [x] Supabase CLI local dev, first migration (extensions, `app_private` schema, `set_updated_at()`, `dhaka_today()`), generated types
- [x] Tailwind v4 themed with `tokens.css`; Hind Siliguri + Space Grotesk via `next/font`. Components are written in shadcn/ui style on Radix (see M0 notes)
- [x] next-intl with `bn` (default) + `en`, language switch saved in a cookie
- [x] Theme toggle (dark default), rendered on the server so there is no flash
- [x] `packages/core`: money/lakh formatting, Dhaka dates, BD phone numbers, member status, with 38 unit tests
- [x] Vitest (core + web) + Playwright (5 smoke tests × desktop and 390px phone)
- [x] GitHub Actions CI: format, lint, type-check, unit tests, pgTAP database tests, Playwright
- [x] `/dev/ui` gallery: Button, Input/Field, native Select, Checkbox, Badge, KpiCard, Card, Segmented tabs, Toggle, Table→Card list, Sheet, Toast, EmptyState, Skeleton, in both themes
- [x] `README.md`, `.env.example`

**M0 notes (24 Sep 2026)**

- **Versions actually installed:** Next.js 16.3.6, React 19.2.8 (the version create-next-app 16.3.6 pins), TypeScript 6.0.3, Tailwind 4.x, next-intl 4.14, @supabase/ssr 0.12, supabase-js 2.117, Supabase CLI 2.117, Zod 4.6, Vitest 5, Playwright 1.63, pnpm 10.33 (pinned in `package.json`), Turborepo 2.11, radix-ui 1.6, sonner 2.
- **shadcn/ui:** its component registry (ui.shadcn.com) is blocked from the cloud build machine, so `shadcn add` could not run. The components in `apps/web/src/components/ui` are written in the same style (Radix + `cva` + `cn`), and we own them either way. Nothing is lost.
- **Native `<select>`** instead of a custom dropdown: faster, and on cheap Android phones it opens the phone's own picker.
- **Next.js docs** ship inside `node_modules/next/dist/docs`. Those were used for the Next 16 specifics (`proxy.ts`, async `cookies()`, typed `LayoutProps`).
- **`[data-theme="dark"]`** also works as a selector (not only `:root`), so a dark panel can sit inside a light page.

### M1 — Auth & onboarding

- [x] Core schema migration: profiles, platform_admins, platform_settings, plans, gyms, branches, gym_users, gym_counters, gym_subscriptions, subscription_invoices, support_sessions, audit_logs, packages + RLS on every table + 36 pgTAP tests
- [x] Owner sign-up + login (email + password, email confirmation), staff login (phone + password, created by owner/manager), forced password change on first login, owner password reset by email
- [x] Onboarding wizard: gym + first branch → logo (compressed in the browser) → first packages (3 suggested) → add staff
- [x] 14-day trial starts automatically (`platform_settings.trial_days`); `gym_access_state()` gives past_due after the trial and read-only (suspended) 7 days later, enforced in RLS
- [x] Staff accounts with role (owner adds manager/reception/trainer, manager adds reception/trainer), turn off/on, password reset by owner/manager
- [x] Role-based routing: `/` → login / onboarding / `/app` / `/admin`; protected routes in `proxy.ts`; gym switcher when a user works in several gyms
- [x] App shell matching the designs: 248px sidebar (≥1200), icon rail (768–1199), top bar + bottom nav + menu sheet (<768), trial card, read-only banner
- [ ] Branch switcher: deferred to when multi-branch data exists (M2+). Branch access (`gym_users.branch_ids`) is already enforced in RLS

**M1 notes (24–25 Sep 2026)**

- **Staff login without SMS:** Supabase refuses phone+password logins unless a paid SMS provider is set up ("Phone logins are disabled"). Staff logins are therefore stored as `8801XXXXXXXXX@staff.gymnode.invalid` (`.invalid` can never receive mail). Staff only ever type their phone number. When an SMS gateway is chosen (M6), phone OTP can be added on top.
- **Staff invites → owner-created accounts** (decision Q2). There is no invite/accept flow and no `staff_invites` table.
- **The secret key is used in one more place than planned:** creating and resetting staff logins needs Supabase's Auth admin API. It runs only on the server (`lib/supabase/admin.ts`, marked `server-only`), only after a database check that the caller may manage that role, and every database write still goes through the caller's own session and RLS. A login can only be attached to the gym it was created for (`created_for_gym`), so an owner can't pull a stranger into their gym.
- **`packages` table moved into M1** because onboarding creates the first packages. The full packages screen is still M2.
- **Numbers in Bangla text use English digits** ("3টি প্যাকেজ") per DESIGN_SYSTEM §3. Long dates keep Bangla digits, as in the design header.
- **Local demo logins** are listed at the top of `supabase/seed.sql`.

### M2 — Members & packages

- [x] Schema: members, memberships, membership_freezes, lockers, biometric_enrollments, **payments** (moved from M3), `member_overview` view (security invoker) + 46 new pgTAP tests
- [x] Packages page: add / edit / turn off / delete (owner & manager; reception read-only). Price changes audited
- [x] Members list like `Members.dc.html`: tabs with counts (all/active/due/expired/frozen + awaiting approval), search by name/phone/ID, package filter, 25 per page, soonest expiry first, Excel export (CSV)
- [x] Add/edit member form with photo (shrunk in the browser, private storage, signed links); new member + package + first payment in one transaction
- [x] QR self-registration (`/join/[slug]`, printable QR) → awaiting approval → approve (gets member code) or reject
- [x] Member profile like `MemberProfile.dc.html`: status, due, package progress, info, membership and payment history, take payment & renew, WhatsApp, freeze/unfreeze, edit, delete (owner/manager)
- [x] Freeze / unfreeze (frozen days extend the end date; early unfreeze gives unused days back)
- [x] Seed: 2 gyms, 60 members with Bangla names, 6 months of memberships and payments, a trainer, lockers, QR sign-ups
- [ ] Attendance heatmap and weight chart: empty states until door devices (M8) and body tracking exist

**M2 notes (25 Sep 2026)**

- **Payments table + "renew and take payment" moved into M2**, because joining and paying happen together at reception. M3 builds the Payments page, verification, cancelling, receipts and the dues list.
- **Renewal dates (Q8, my default):** renewing while still active continues from the day after the current end date; renewing after expiry starts today. Admission fee is charged only on the first membership (staff can still add a discount). This can become a gym setting later if you want.
- **Excel export is a CSV file.** Excel opens it directly, with Bangla working. Real `.xlsx` can come with the reports in M5 if needed.
- **Lockers:** the table exists and the profile shows the locker; assigning lockers from the screen comes with settings.
- **Trainers** see only their assigned members, with masked phone numbers, and never see payments.
- **Bug found by the tests and fixed:** clearing the search box and quickly clicking a tab could undo the tab choice.

### M3 — Payments & dues

- [x] Schema: payments + `record_payment_and_renew` (done in M2)
- [x] `verify_payment` (owner/manager), `cancel_payment` with reason (owner/manager any; reception only their own still-pending payment; cancelling also cancels the membership it paid for when nothing else covers it), `pay_due`, `get_receipt`, `payment_stats`, `gym_money_snapshot` + 19 new pgTAP tests
- [x] Payments page like `Payments.dc.html`: today / this week (Sat–Fri) / this month totals with comparison to the previous period, transactions table, take-payment panel (side card on desktop, full-screen sheet on phones)
- [x] Verification queue ("যাচাই বাকি") for owner/manager, oldest first, payments waiting 24h+ highlighted; pending count badge on the sidebar
- [x] Receipt page `/r/[token]`: public secret link, printable (prints light), shareable on WhatsApp right after taking a payment
- [x] Dues list with WhatsApp reminder (prefilled Bangla message) and "pay due only"; member profile links to receipts and "pay due"
- [ ] Automatic 24-hour reminder message for unverified payments → with messaging (M6)
- [x] PDF report button from the design → reports (M5)

**M3 notes (25 Sep 2026)**

- Reminders and receipts are sent with a **one-tap WhatsApp link** (`wa.me`) for now: staff press send on their own phone. Automatic sending needs the WhatsApp/SMS providers (M6).
- The receipt link is a random 24-character code; anyone with the link can see that one receipt (like a paper receipt), nothing else.
- **Bug found by the tests and fixed:** a slow search update could still undo a tab choice on the member list (a second case of the M2 bug). Filter changes now cancel any pending search update.

### M4 — Dashboard

- [x] `dashboard_summary` (today vs yesterday, month vs same days last month, active/new members, dues, check-ins, 14 days of income vs expense, payment methods) + 14 new pgTAP tests
- [x] Desktop / tablet / mobile layouts per the three designs (hero collection tile + 2×2 KPIs on phones, 7-day chart on phones)
- [x] Income vs expense chart (Recharts): legend, hover tooltip, screen-reader table; colours validated for colour-blindness in both themes
- [x] Payment methods this month, expiring this week (renew + WhatsApp), live check-ins via Supabase Realtime
- [x] **Check-ins now (moved forward from M8):** `attendance` table in the M8 shape; reception checks members in by hand (search on the dashboard or button on the profile); expired/frozen members are blocked; owner/manager can override (audited); profile shows the 5-week attendance grid
- [x] **Expenses tables (moved forward from M5)** so the chart shows real expenses; salaries visible to the owner only; default categories for every gym. Entry screens stay in M5
- [x] Trainer dashboard shows no money

**M4 notes (25 Sep 2026)**

- **Chart colours:** dark mode uses the design's lime/orange (colour-blind and contrast checks pass). In light mode the lime is nearly invisible on white, so income uses the design's dark olive `#3F6212` and expense `#F97316` (colour-blind check passes; the orange is slightly low-contrast, so the chart always has a legend, tooltips and a data table).
- **Bug found by the tests and fixed:** the live check-in feed stayed empty because it connected before the login session was loaded, so the database (correctly) sent nothing. It now waits for the session.
- "লক্ষ্যের 76%" (monthly target) from the design needs a target setting; until settings exist (M7) the tile compares with the same days of last month instead.

### M5 — Expenses, sales & stock, reports

- [x] Expenses page (আয়-ব্যয়): month by month, income vs expenses vs net profit, by-category bars, add/edit/delete (deletes are kept for the audit log), categories (add, rename, hide; salary categories owner-only)
- [x] Supplements shop (বিক্রি ও স্টক): products, stock in (can be recorded as an expense in the same step), stock count correction with reason (audited), stock history
- [x] POS: tap products → cart → member or walk-in → discount → cash/bKash/Nagad/Rocket/card → receipt (WhatsApp share for members). Stock, sale and payment are saved together by the database; cancelling the payment puts the items back
- [x] Low-stock alert: badge on the menu, amber notice on the dashboard
- [x] Reports like `Reports.dc.html`: this month / 3 / 6 months / custom; income, expenses, profit, renewal rate; monthly income-expense-profit chart; expense categories; new vs expired members; popular packages; peak hours; top products; payment methods
- [x] PDF (print → "Save as PDF") and Excel (.xlsx with 6 sheets) export
- [x] Receipts list sold items; payments list shows "প্রোটিন শেক ×2 · বিক্রি"
- [x] 29 new pgTAP tests (149 total), 11 new unit tests, 8 new end-to-end tests

**M5 notes (25 Sep 2026)**

- **PDF uses the browser's print ("Save as PDF").** I chose this because Bangla letters join correctly there. My understanding (not verified in this project) is that server-side PDF libraries often break Bangla letter joining. Charts print in the light palette.
- **Excel is a real .xlsx file** (library `write-excel-file` 4.1.1, checked on npm 25 Sep 2026). Amounts are numbers in taka, so they can be added up in Excel.
- **Stock is counted per gym**, not per branch. Per-branch stock can come with multi-branch reporting.
- **"Expired" in the members chart** = memberships that ran out in that month and were not renewed.
- **Renewal rate** = of the memberships that ended in the period (up to yesterday), how many were followed by a new one.
- Managers' expense and report figures leave out salaries (owner-only), and the page says so.
- Reception can see a product's last purchase cost in the database (the screen hides it). Tell me if that must be locked down too.
- **Fixed while building:** an expense could in theory be pointed at another gym's branch or category (the database now refuses it). Seed expenses were scaled down to match the sample gym's income.

### M6 — Messaging

- [ ] `MessagingService` interface + `console`, `whatsapp_cloud`, `sms_bd` adapters
- [ ] Templates bn/en with variables; outbox + logs + monthly usage
- [ ] pg_cron → Edge Function: expiry reminders (5/3/1 days), due reminders, birthdays; quiet hours; no duplicates
- [ ] One-tap `wa.me` fallback

### M7 — Super admin

- [x] SA dashboard (gyms, MRR, trials, overdue, churn, 12-month billing chart, plans breakdown, recent sign-ups, alerts)
- [x] Gyms list with status tabs, city filter and search; gym detail page (plan & price, activate/suspend/cancel with reason, extend trial, invoices, tickets, history)
- [x] Support mode: reason required, 15–120 minutes, read-only (the database refuses changes), banner in the gym panel, can be ended, always audited
- [x] Plans page (prices stay "[দাম]" until decided; limits and features editable, audited) and subscription billing (monthly invoice generation, mark paid with bKash/Nagad/bank, void with reason; overdue → "বিল বকেয়া" banner for the gym)
- [x] Support tickets: gym owner/manager write from Settings → Support; the team answers in the admin panel
- [x] Team page (super admin / support roles) and platform settings (trial length, grace days)
- [x] Plan limits enforced by the database: members and branches (device limits come with M8). Trials have no limits
- [x] Gym Settings page: gym details, monthly income target (dashboard shows "% of target"), plan & usage & invoices, support
- [ ] Ops: offline devices → M8; message usage vs plan limits → M6
- [x] 36 new pgTAP tests (185 total), 10 new end-to-end tests

**M7 notes (26 Sep 2026)**

- **Prices are still undecided.** Plans show "[দাম]". Gyms without a price get no automatic monthly invoice. The sample data uses made-up prices only so the screens have numbers.
- **Paying gyms are never suspended automatically.** An overdue invoice shows a "বিল বকেয়া" banner but the gym keeps working; suspending is your decision (button on the gym page). Trials still become read-only 7 days after they end (Q3).
- **Support team role:** can see everything and answer tickets, but cannot change plans, bills, status or settings. Only super admins can.
- **How gyms pay you (for now):** bKash/Nagad/bank, then you mark the invoice paid in the admin panel. Online payment can come later.
- New sample logins: `support@gymnode.test` / `GymNode-admin-1` (support team), plus 8 small sample gyms.

### M8 — Access control

- [ ] **Written spike first**: `docs/ACCESS_CONTROL.md` (ADMS push vs BioTime API, hardware/licences, offline behaviour, list of things to verify on a real SenseFace 2A)
- [ ] Devices page like `Access.dc.html`, live entry feed, blocked → take payment shortcut, rules
- [ ] Attendance records, allowed-member sync to devices

**Also throughout:** `docs/DEPLOY.md` (Vercel + Supabase production steps), keeping `.env.example` current.

---

## 7. Things I noticed in the designs (small conflicts, tell me if you disagree)

1. **Default theme:** the brief and DESIGN_SYSTEM say "dark is default". `tokens.css` switches to light automatically when the phone/computer is set to light mode and the user hasn't chosen yet. **My plan: always dark until the user picks light** (follows the brief). See Q7.
2. **"বকেয়া" as a member status**: handled with the priority order in §4.5.
3. **Payments list includes product sales** ("প্রোটিন শেক ×2 · বিক্রি"), so `payments.kind` includes `sale`.
4. **Subscription invoices** (SA-Billing) use "ব্যাংক" (bank) as a method. Gym member payments don't. I added `bank` only to subscription invoices.
5. **Dashboard "লক্ষ্যের 76%"** needs a monthly income target, so it's stored in `gyms.settings`.
6. **Access screen** has multiple doors per branch (মেইন গেট, লেডিস জোন), so `devices.door_name`. See Q10.
7. **Member profile** shows face and fingerprint enrollment separately, so there's one row per method in `biometric_enrollments`.
8. **Sidebar** has 12 items (incl. আয়-ব্যয়, ওয়েবসাইট). The tablet rail has 10. Website builder is "later", so it's shown as coming soon or hidden (Q9).
9. **Plan limits in SA-Billing** (Starter 150 members/1 branch/1 device, Growth 500/2 branches, Pro unlimited) are used as seed values, still editable.
10. **Sample dates in the designs** (24 Sep 2026, Thursday) match today. The seed data will be generated relative to "today" so screens always look alive.

---

## 8. Open questions for you

**Decided (24 Sep 2026). The founder asked me to decide Q1–Q4. Q5 was answered by the founder.**

- **Q1. Login → owner: email + password. Staff: phone + password. Phone OTP later.**
  - Owners sign up with email + password. Email verification is free and needs no SMS provider.
  - Phone OTP gets added in M6, once an SMS gateway is chosen. It then becomes a second way to log in, not a replacement.
  - Why: an SMS provider costs money and needs a decision, and it shouldn't block M1. Bangladeshi users are generally more used to phone numbers than email, which is why staff log in by phone (Q2), and why OTP comes as soon as there's a gateway.
  - _To verify at M1:_ that Supabase lets an admin create a phone + password user without sending an SMS (`phone_confirm: true` in the admin API), and that `signInWithPassword({ phone, password })` works without an SMS provider configured. If it doesn't, the fallback is an internal placeholder email per staff member (e.g. `8801XXXXXXXXX@staff.gymnode.local`). Staff still type only their phone number.
- **Q2. Staff without email → yes, the owner creates them.** The owner/manager adds a staff member with name, phone, role and branch, and sets a temporary password. The staff member must change it at first login. The owner can reset it. No email needed.
- **Q3. Trial → 14 days, no card or payment needed.** The length is a platform setting you can change in `/admin`. When the trial ends:
  - **Days 1–7 after:** the gym goes to `past_due`. Everything still works, with a renewal banner.
  - **After 7 days:** the gym goes to `suspended`, which is **read-only**. Data is kept, and staff can still view members and export.
  - **Access doors keep following member rules either way.** A gym's unpaid SaaS bill should never lock out its members.
- **Q4. Unverified bKash/Nagad/Rocket payment → counts as paid, with a flag.**
  - The member is treated as paid for status and door access, and shows a "যাচাই বাকি" badge. The front desk shouldn't block a member because the owner hasn't opened the bKash app yet.
  - Safeguards:
    - A transaction ID is required and must be unique per gym + method.
    - Pending payments appear as a count on the dashboard and in a verification queue for owner/manager.
    - The owner gets a reminder if something is still unverified after 24 hours.
    - If a payment is **cancelled** (e.g. the transaction ID was fake), the membership it created is cancelled too, and the member goes back to expired/due. The whole thing is audited.
- **Q5. Product name → "GymNode".**

**Needed before M2–M3**

- **Q6. URL language prefix**: OK to skip `/bn/` `/en/` in URLs (language from the user's setting)? Public pages (QR join form, receipt) will pick the gym's default language.
- **Q7. Theme**: always dark by default (my plan), or follow the phone's light/dark setting until chosen?
- **Q8. Renewal when a membership has already expired**: does the new period start **today** or from the **old end date** (so they "pay for" the missed days)? I plan: from today if expired, from the old end date if still active. Some gyms want this configurable.
- **Q9. Unbuilt nav items** (Website, etc.): hide them, or show with "শীঘ্রই"?
- **Q10. Ladies zone door:** should access rules restrict doors by gender (e.g. only female members open "লেডিস জোন")? This affects the M8 data model slightly.
- **Q11. Admission fee**: charged once per member forever, or again if they return after a long gap (e.g. 3+ months expired)?

**Needed before going live (hard to reverse / costs money)**

- **Q12. Supabase region.** A region close to Bangladesh (I believe Singapore and Mumbai are options, to be confirmed in the Supabase dashboard) gives better speed. You can't change region after creating the project. I'm **not a lawyer**. Please check whether any Bangladeshi data-protection rule requires storing personal data inside Bangladesh.
- **Q13. Paid plans.** Supabase and Vercel both have free tiers suitable for development. Production will likely need paid plans (for example, I understand Supabase free projects can be paused after inactivity). **Check current pricing yourself.** I won't sign up for anything paid. You create the accounts, and I'll tell you exactly what to click.
- **Q14. SMS gateway + WhatsApp Business account** (M6). You choose the provider. WhatsApp Cloud API needs a verified Meta Business account and approved message templates, which can take days, so it's worth starting early.
- **Q15. A real ZKTeco SenseFace 2A** for testing M8: do you have one, or can a partner gym lend one?

---

## 9. What you'll need to do (nothing yet)

- **Before M1** (not now): create a free Supabase project + a GitHub repo secret for CI, if we want CI to hit a real project. Local development works without any account (Docker).
- I'll list exact steps at the end of M0.
