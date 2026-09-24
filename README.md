# GymNode

Multi-tenant gym management SaaS for Bangladesh: Bangla-first, BDT (৳) with lakh formatting,
bKash/Nagad/Rocket payments, WhatsApp/SMS reminders and ZKTeco door access.

- **Plan and progress:** [`docs/PLAN.md`](docs/PLAN.md)
- **Design source of truth:** [`docs/design/`](docs/design/) (brief, design system, tokens, screens)

## What's inside

| Path              | What it is                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 web app (gym panel `/app`, super admin `/admin`, component gallery `/dev/ui`)                                                       |
| `packages/core`   | Pure TypeScript business logic shared with the future mobile app: money (paisa, lakh formatting), Dhaka dates, BD phone numbers, member status |
| `packages/db`     | Generated Supabase database types                                                                                                              |
| `packages/config` | Shared TypeScript settings                                                                                                                     |
| `supabase/`       | Database migrations, pgTAP tests (incl. RLS), config                                                                                           |

## Requirements

- **Node.js 22+** (see `.nvmrc`)
- **pnpm 10** (`corepack enable` will pick the exact version from `package.json`)
- **Docker** (only for the local Supabase database)

## First-time setup

```bash
pnpm install

# Start the local Supabase stack (Postgres, Auth, Storage) in Docker.
pnpm db:start

# Create your local env file, then paste the values printed by `pnpm exec supabase status`.
cp .env.example apps/web/.env.local

pnpm dev          # http://localhost:3000  (component gallery: /dev/ui)
```

The web app also runs without Supabase configured. Pages that need the database will
arrive from M1 onward.

## Everyday commands

| Command                                      | What it does                                              |
| -------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                   | Run the web app in development mode                       |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Checks run by CI                                          |
| `pnpm format`                                | Format all code with Prettier                             |
| `pnpm e2e`                                   | Playwright end-to-end tests (builds the app first)        |
| `pnpm db:start` / `pnpm db:stop`             | Start/stop local Supabase                                 |
| `pnpm db:reset`                              | Recreate the local database from migrations (+ seed)      |
| `pnpm db:test`                               | Run database tests (pgTAP), including RLS isolation tests |
| `pnpm db:types`                              | Regenerate `packages/db` types after changing a migration |
| `pnpm exec supabase migration new <name>`    | Create a new migration file                               |

## Rules of the road

- **Never commit secrets.** Only `.env.example` is committed. Real values go in `apps/web/.env.local`.
- **Money is integer paisa** (`150000` = ৳1,500). Format with `formatTaka()` from `@gymnode/core`.
- **"Today" is Dhaka's date.** Use `todayInDhaka()` / `public.dhaka_today()`, never UTC's date.
- **Every tenant table has `gym_id` and RLS** enabled in the same migration that creates it, with pgTAP tests.
- **Colours come from design tokens** (`bg-surface`, `text-muted`, `bg-accent` …), never raw hex.
- **Every user-facing string lives in `apps/web/messages/bn.json` and `en.json`.** A test checks that both files have the same keys.

## Cloud dev containers

If Supabase's default image registry (`public.ecr.aws`) is blocked, pull from Docker Hub instead:

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start
```

If Playwright's own browser download is blocked but Chromium is installed elsewhere:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm e2e
```
