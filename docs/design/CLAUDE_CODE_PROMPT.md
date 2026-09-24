# Claude Code Prompt — Gym Management SaaS (Web App, Phase 1)

> Paste this whole file as your first message to Claude Code (or save it as `docs/PROMPT.md` and say "Read docs/PROMPT.md and start"). Put `DESIGN_SYSTEM.md`, `tokens.css` and the `designs/` folder in the repo under `docs/design/` first.

---

## 0. Your role and how to work

You are the lead engineer building a production-quality, multi-tenant **gym management SaaS for Bangladesh**. I am the founder. I understand the business well but I am not a senior engineer, so:

1. **Plan before coding.** Start by reading everything in `docs/design/`. Then write `docs/PLAN.md` with the architecture, database schema, folder structure and milestone checklist. **Stop and wait for my approval** before writing app code.
2. Work **one milestone at a time**. At the end of each milestone: run lint, type-check and tests, update `docs/PLAN.md` checkboxes, and give me a short summary of what works, what's left, and anything I must do (e.g. create a Supabase project, add an env var).
3. **Ask me** before any decision that is hard to reverse (schema changes after data exists, paid services, auth model changes).
4. Library versions change fast. **Check current official docs** for Next.js, Supabase, Tailwind and shadcn/ui before setting them up, and tell me which versions you chose.
5. Never commit secrets. Use `.env.local` and keep an up-to-date `.env.example`.
6. Small, focused commits with clear messages.

---

## 1. Product summary

Gyms in Bangladesh subscribe to this software to run their business. Three kinds of users:

| Panel | Users | Platform |
|---|---|---|
| **Gym admin panel** | Gym owner, manager, reception staff, trainer | Web (this phase), owner mobile app later |
| **Super admin panel** | Me (SaaS owner) and my team | Web (this phase) |
| **Member app** | Gym members/customers | React Native (later phase) |

Key local requirements:
- **Bangla-first UI** with English toggle.
- Payments by **cash, bKash, Nagad, Rocket, card**. Phase 1 = manual entry + transaction ID + staff verification. Online auto-payment comes later.
- **WhatsApp + SMS** reminders and receipts.
- **Door access control** with ZKTeco biometric devices (face/fingerprint/RFID); door stays locked when membership expires. (Phase 2, but design the data model for it now.)
- Currency BDT (৳), lakh formatting (`৳3,42,000`), timezone `Asia/Dhaka`.
- Must work well on cheap Android phones and slow internet.

---

## 2. Tech stack (decided)

- **Next.js** (App Router, TypeScript, Server Components + Server Actions where sensible)
- **Supabase**: Postgres, Auth, Row Level Security, Storage (photos), Realtime (live check-ins), Edge Functions / cron (reminders)
- **Tailwind CSS + shadcn/ui**, themed with `docs/design/tokens.css`
- **Lucide** icons, **Recharts** for charts
- **next-intl** (or current best equivalent) for `bn` / `en`
- **Zod** for validation, **React Hook Form** for forms
- **Vitest** for unit tests, **Playwright** for a few critical end-to-end flows
- Hosting: Vercel (web) + Supabase cloud
- Later: **React Native (Expo)** for member/trainer/owner apps — so keep business logic in reusable places (Postgres functions, shared `packages/` types, API routes) rather than only inside React components.

Suggested structure (adjust in PLAN.md if you have a better reason): a monorepo (pnpm workspaces or Turborepo) with `apps/web`, `packages/db` (types, generated Supabase types), `packages/core` (pricing, dates, formatting, validation shared with the future mobile app), `supabase/` (migrations, seed, policies, functions).

---

## 3. Design

- **Source of truth:** `docs/design/DESIGN_SYSTEM.md` + `docs/design/tokens.css` + screens in `docs/design/designs/` (read `designs/README.md` first; it explains the `.dc.html` format and maps every file to a route).
- Rebuild screens as clean components. Do **not** copy the design tool's markup (`x-dc`, `sc-for`, `helmet`).
- Match colours, spacing, radius, typography and Bangla copy closely.
- Responsive rules: desktop sidebar (≥1200), tablet icon rail (768–1199), mobile top bar + bottom nav (<768). Tables → card lists on mobile. Side panels → full-screen sheets on mobile.
- Dark theme default, light theme toggle, remember choice per user.
- Fonts: Hind Siliguri + Space Grotesk via `next/font`. Numbers use tabular figures.
- Accessibility: visible labels on inputs, `aria-label` on icon buttons, keyboard focus visible, WCAG AA contrast.
- Build a small internal `/dev/ui` page showing all base components in both themes.

---

## 4. Multi-tenancy, roles and security (critical)

- Every tenant-owned table has `gym_id`. Branch-level data also has `branch_id`.
- **RLS on every table.** A user can only read/write rows of gyms they belong to, limited by role. Super admins bypass via a dedicated, audited path (not by disabling RLS).
- Roles per gym membership: `owner`, `manager`, `reception`, `trainer`. Platform role: `super_admin`, `support`.
- Permission examples: reception can take payments but cannot delete payments or change prices; trainer sees only assigned members' training data; only owner sees profit and staff salaries.
- **Audit log** for sensitive actions: payment created/edited/cancelled/verified, price change, member deleted, door manual override, super admin "support mode" access to a gym.
- Payments are never hard-deleted: cancel with reason + audit.
- Write RLS tests (at least: user from gym A cannot read gym B's members/payments; reception cannot cancel a verified payment).
- Member personal data (phone, photos, biometric enrollment status) is sensitive. Store biometric *templates* only on the device, never in our database; we only store "enrolled: yes/no" and the device user ID.

---

## 5. Data model (starting point — refine in PLAN.md)

Platform level:
- `profiles` (user_id, name, phone, locale, theme)
- `platform_admins` (user_id, role)
- `plans` (name, price_bdt — placeholder, limits: max_members, max_branches, max_devices, features jsonb)
- `gyms` (name, slug, owner_user_id, city, address, phone, logo_url, status: trial/active/past_due/suspended, trial_ends_at, plan_id)
- `gym_subscriptions` + `subscription_invoices` (for billing gyms)
- `gym_users` (gym_id, user_id, role, branch_ids)
- `branches` (gym_id, name, address)
- `support_tickets`, `audit_logs`, `message_usage` (per gym per month: sms_count, whatsapp_count)

Gym level:
- `members` (gym_id, branch_id, member_code e.g. PH-0142, name, phone, gender, dob, photo_url, address, emergency_contact, joined_at, status, assigned_trainer_id, locker_id, notes)
- `packages` (gym_id, name, duration_days, price_bdt, admission_fee, is_active)
- `memberships` (member_id, package_id, start_date, end_date, price, discount, status: active/expired/frozen/cancelled, frozen_from/frozen_until)
- `payments` (gym_id, member_id nullable, membership_id nullable, amount, discount, method: cash/bkash/nagad/rocket/card, transaction_id, status: pending_verification/completed/cancelled, received_by, verified_by, invoice_no, receipt_sent_at, cancel_reason)
- `dues` (view or computed from memberships + payments)
- `expenses` (gym_id, branch_id, category, amount, date, note, created_by)
- `products`, `stock_movements`, `sales`, `sale_items` (supplements/POS)
- `lockers`
- `attendance` (member_id, branch_id, checked_in_at, method: face/fingerprint/rfid/qr/manual, device_id, result: allowed/blocked, reason)
- `devices` (gym_id, branch_id, name, model e.g. ZKTeco SenseFace 2A, serial, connection_type, last_seen_at, status)
- `access_rules` (gym_id: auto_lock_on_expiry, grace_days, allow_staff_override, offline_mode)
- `message_templates`, `message_logs` (channel sms/whatsapp, to, template, status, cost)
- `trainers` via `gym_users` role; `workout_plans`, `workout_items`, `diet_plans`, `body_measurements` (needed later for the member app, but create tables now)

Conventions: `uuid` primary keys, `created_at`/`updated_at`, money as integer paisa **or** numeric(12,2) — pick one and document why. Use Postgres functions for critical logic (renew membership + record payment atomically, compute dues, member status).

---

## 6. Milestones

### M0 — Setup
Monorepo, Next.js app, Supabase local dev, Tailwind + shadcn themed with tokens, fonts, i18n (bn default, en), theme toggle, lint/format/type-check, Vitest, Playwright, CI (GitHub Actions: lint + type-check + test), `/dev/ui` component page.

### M1 — Auth & onboarding
- Sign up / login with phone OTP or email (ask me which first; phone OTP needs an SMS provider).
- Gym onboarding wizard: gym name, branch, logo, first package(s), invite staff.
- New gyms start a trial (length configurable).
- Role-based layout: gym admin → `/app`, super admin → `/admin`.

### M2 — Members & packages
- Packages CRUD.
- Members list exactly like `Members.dc.html`: filter tabs with counts (all/active/due/expired/frozen), search by name/phone/code, package filter, pagination, Excel export.
- Add/edit member form, photo upload (compress on client).
- QR self-registration link: public form → pending member for staff to approve.
- Member profile like `MemberProfile.dc.html`: package progress, info, attendance heatmap, weight chart, payment history, actions (take payment & renew, WhatsApp, freeze).
- Freeze/unfreeze membership (extends end date).

### M3 — Payments & dues
- Payments page like `Payments.dc.html`: today/week/month KPIs, transactions table, "take payment" panel (member search, package, amount, discount, method chips, transaction ID for mobile banking, send receipt checkbox, shows new expiry date and total).
- Mobile banking payments start as `pending_verification`; owner/manager verifies.
- Renewal + payment in one atomic DB function.
- Invoice numbers per gym, printable/shareable receipt page (PDF optional).
- Dues computed automatically; dues list.

### M4 — Dashboard
- Dashboard like the three `Dashboard-*.dc.html` files (desktop/tablet/mobile): today's collection vs yesterday, month income, active members, total dues, 14-day income vs expense chart, payment-method breakdown, expiring this week (with renew + WhatsApp buttons), live check-ins (Realtime).

### M5 — Expenses, sales & stock, reports
- Expenses CRUD with categories.
- Simple POS for supplements, stock movements, low-stock alert.
- Reports like `Reports.dc.html`: date ranges, income/expense/profit by month, expense categories, new vs expired members, popular packages, peak hours, renewal rate; PDF and Excel export.

### M6 — Messaging (WhatsApp + SMS)
- Provider-agnostic `MessagingService` interface with adapters: `whatsapp_cloud` (official Meta WhatsApp Cloud API) and `sms_bd` (a Bangladeshi SMS gateway — keep it configurable; I will choose the provider). Start with a `console`/mock adapter so everything works in dev.
- Templates (bn/en) with variables: payment receipt, due reminder, expiry reminder (e.g. 5/3/1 days before), birthday.
- Scheduled job (Supabase cron / Edge Function) for reminders; respect quiet hours; log every message and count usage per gym per month.
- Manual one-tap WhatsApp from lists (can open `wa.me` link as a fallback).

### M7 — Super admin panel
- Screens like `SA-*.dc.html`: SaaS dashboard (gyms, MRR, trials, overdue, churn, MRR chart, plans breakdown, recent signups, alerts), gyms list with filters and "support mode" (read-only impersonation, audited), plans & invoices (prices are placeholders — make them editable), operations (offline devices, message usage vs plan limits, support tickets).
- Plan limits enforced in the gym panel (member/branch/device caps, feature flags).

### M8 — Access control (research spike first)
- **Do a written spike before building** (`docs/ACCESS_CONTROL.md`): how ZKTeco devices (target model: **SenseFace 2A**) can talk to our cloud. Compare (a) direct device push to our server (ZKTeco ADMS/"Push" protocol) vs (b) going through ZKTeco BioTime software's API. List pros/cons, what hardware/licence the gym needs, offline behaviour, and what must be verified on a real device. Do not assume protocol details — mark anything unverified.
- Then build: devices page like `Access.dc.html` (device status, live entry feed via Realtime, blocked entries with "take payment" shortcut, rules: auto-lock on expiry, grace days, staff override off by default, offline mode), attendance records, sync of allowed-member list to devices.

### Later (not now)
Trainer features, member app (React Native), AI meal photo nutrition (estimates only, clearly labelled), free gym website builder with lead form, online bKash/Nagad payments, multi-branch reporting, owner mobile app.

---

## 7. Quality bar

- TypeScript strict. No `any` without a comment explaining why.
- Every form: Zod validation on client **and** server, Bangla error messages.
- Loading, empty and error states for every list and page (empty states invite action).
- Seed script with realistic Bangla sample data (2 gyms, ~60 members, payments across 6 months) so every screen can be reviewed.
- Performance: paginate server-side, index `gym_id` + common filters, keep mobile JS small.
- Dates always stored in UTC, displayed in `Asia/Dhaka`.
- Write short docs as you go: `README.md` (setup), `docs/PLAN.md`, `docs/ACCESS_CONTROL.md`, `docs/DEPLOY.md`.

---

## 8. First task

1. Read `docs/design/DESIGN_SYSTEM.md`, `docs/design/tokens.css`, `docs/design/designs/README.md`, and skim every `.dc.html` screen.
2. Write `docs/PLAN.md`: architecture, final schema (with RLS approach), folder structure, milestone checklist, open questions for me.
3. Stop and wait for my approval.
