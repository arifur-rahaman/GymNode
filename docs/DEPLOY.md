# Deploying GymNode

> Status (25 Sep 2026): ready for a **demo deployment** on Vercel + the `gymnode-dev` Supabase project.
> Production (real gyms, real money) needs the extra steps in the last section first.

## Environments

| Name       | Where                                                            | Used for                                                            |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Local      | Docker on your computer (`pnpm db:start`)                        | Development and all automated tests                                 |
| Demo       | Vercel + Supabase project `gymnode-dev` (`dsqtjvpekxfagcainyqv`) | Showing gym owners what is being built. Data may be wiped.          |
| Production | Not created yet                                                  | Real gyms. Region and paid plans still to decide (PLAN.md Q12, Q13) |

---

## Demo deployment: step by step

Do the parts in order. Nothing here costs money on the free plans.
**Never paste passwords, the access token or the secret key into chat or into code.**
They only go into the GitHub, Vercel or Supabase settings pages named below.

### Part A — Put the database tables into Supabase (≈10 min, repeat step A4 after each milestone)

**A1. Create a Supabase access token**

1. Go to https://supabase.com/dashboard/account/tokens
2. Click **Generate new token**, name it `github-deploy`, create it.
3. Copy the token (starts with `sbp_`). It is shown only once.

**A2. Find your database password**

It is the password you saved when you created `gymnode-dev`. If you lost it: Supabase dashboard →
your project → **Project Settings → Database → Reset database password**, and save the new one.

**A3. Add both as GitHub secrets**

1. Open https://github.com/arifur-rahaman/gymnode/settings/secrets/actions
2. Click **New repository secret**:
   - Name: `SUPABASE_ACCESS_TOKEN`, Secret: the `sbp_…` token → **Add secret**
3. Click **New repository secret** again:
   - Name: `SUPABASE_DB_PASSWORD`, Secret: the database password → **Add secret**

**A4. Run the database deploy**

1. Open https://github.com/arifur-rahaman/gymnode/actions
2. In the left list click **Deploy database (gymnode-dev)**.
3. Click **Run workflow** → keep the branch as it is → **Run workflow**.
4. Wait for the green tick (1–2 min). A red cross means something failed: open it and send a screenshot.

This never copies the local demo accounts. Online, everyone signs up for real.

### Part B — Supabase login settings for the demo (≈3 min)

Supabase dashboard → project `gymnode-dev`:

1. **Authentication → Sign In / Providers → Email**: turn **Confirm email** **off** → Save.
   _Why:_ Supabase's built-in email sender only delivers to members of your own Supabase team,
   at most 2 emails per hour. Gym owners would never receive the confirmation link.
   With confirmation off, they sign up and go straight into gym setup.
   This is fine for a demo; production needs a real email service (see the last section).
2. Leave the **Phone** provider off. Staff log in with phone + password without it.

### Part C — Put the website on Vercel (≈10 min)

1. Go to https://vercel.com/signup → **Continue with GitHub**. Choose the free **Hobby** plan.
2. **Add New… → Project** → import `arifur-rahaman/gymnode`
   (if it's not listed, click **Adjust GitHub App Permissions** and allow the repo).
3. On the setup screen:
   - **Root Directory:** click **Edit** → choose `apps/web`.
   - **Framework Preset:** Next.js (detected automatically).
   - Leave build and install commands as they are.
4. Open **Environment Variables** and add these four:

   | Name                                   | Value                                                                                           |
   | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | `https://dsqtjvpekxfagcainyqv.supabase.co`                                                      |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_…` key                                                                     |
   | `SUPABASE_SECRET_KEY`                  | Supabase → **Project Settings → API Keys** → secret key (`sb_secret_…`). Mark it **Sensitive**. |
   | `NEXT_PUBLIC_DEMO_MODE`                | `true` (shows a "demo version" banner and hides the site from Google)                           |

5. Click **Deploy** and wait 2–4 minutes. You get an address like `https://gymnode-xxxx.vercel.app`.

### Part D — Tell Supabase the website address (≈2 min)

Supabase dashboard → **Authentication → URL Configuration**:

1. **Site URL:** your Vercel address, e.g. `https://gymnode-xxxx.vercel.app`
2. **Redirect URLs → Add URL:** `https://gymnode-xxxx.vercel.app/**` → Save.

### Part E — Try it yourself before sharing (≈5 min)

1. Open the Vercel address on your phone. You should see the blue demo banner and the Bangla login page.
2. Click **ফ্রি অ্যাকাউন্ট খুলুন**, sign up with your own email, and go through gym setup.
3. Add a staff member, log out, and log in as that staff member with the phone number.
4. If all of that works, share the address with gym owners.

**If something fails:** send a screenshot. In Vercel, **Deployments → (latest) → Logs** shows server errors.

### After each milestone

New code reaches Vercel automatically when it's pushed to the branch. New database tables do not:
run **Part A4** again (Claude will say when it's needed).

---

## What to tell gym owners

- It's an early **demo**: members and payments arrive in the next updates.
- They can sign up, set up their gym, packages and staff, and try it on their phone.
- They shouldn't enter real member or money data; demo data may be deleted.

---

## Before real gyms use it (production checklist)

- [ ] Create a separate **production** Supabase project (region decision: PLAN.md Q12; paid plan: Q13)
- [ ] Custom email sender (SMTP) so confirmation and password-reset emails reach everyone; then turn **Confirm email** back on
- [ ] Vercel plan: I believe the free Hobby plan is for non-commercial use only. Check Vercel's current terms; a paying product likely needs Pro
- [ ] Own domain (e.g. `app.<yourdomain>`), set as Site URL
- [ ] `NEXT_PUBLIC_DEMO_MODE` removed (or `false`)
- [ ] Separate GitHub secrets / workflow for production migrations, with review before each run
- [ ] Backups and a restore test

## Web app environment variables

| Variable                               | Secret? | Notes                                                                  |
| -------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | No      | Project URL                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No      | Publishable key (`sb_publishable_…`)                                   |
| `SUPABASE_SECRET_KEY`                  | **Yes** | Secret key (`sb_secret_…`). Server only; creates/resets staff logins   |
| `NEXT_PUBLIC_SITE_URL`                 | No      | Optional. Address used in email links; defaults to the request address |
| `NEXT_PUBLIC_DEMO_MODE`                | No      | `true` on demo deployments                                             |
| `ENABLE_DEV_UI`                        | No      | `true` shows `/dev/ui` in a production build                           |
