# Deploying GymNode

> Status: nothing is deployed yet. This file grows milestone by milestone.

## Environments

| Name          | Where                                         | Used for                                                         |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Local         | Docker on your machine (`pnpm db:start`)      | Development and all automated tests                              |
| `gymnode-dev` | Supabase cloud project `dsqtjvpekxfagcainyqv` | Clicking through the app online before real gyms use it          |
| Production    | Not created yet                               | Real gyms. Region and paid plan to be decided (PLAN.md Q12, Q13) |

## Supabase cloud project: one-time settings

Do these in the Supabase dashboard of each cloud project (dev, later production).

1. **Authentication → URL Configuration**
   - **Site URL:** the web app's address (e.g. the Vercel URL).
   - **Redirect URLs:** add `<site URL>/auth/callback`.
2. **Authentication → Providers → Email:** keep **Confirm email** on (owners must confirm their email).
3. **Phone provider:** leave off. Staff log in with phone + password without it (PLAN.md M1 notes).

## Getting database changes into a cloud project

Database changes live in `supabase/migrations/` and are applied by the Supabase CLI, never by hand in the dashboard.
The planned setup is a GitHub Action that runs `supabase db push`. It needs two GitHub secrets, which the founder adds:

- `SUPABASE_ACCESS_TOKEN`: a personal access token from Supabase account settings
- `SUPABASE_DB_PASSWORD`: the database password chosen when the project was created

**Never** paste these into chat or commit them.

`supabase/seed.sql` is for local development only and must never be run against a cloud project.

## Web app environment variables (e.g. in Vercel)

| Variable                               | Secret? | Notes                                                                        |
| -------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | No      | Project URL                                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No      | Publishable key (`sb_publishable_…`)                                         |
| `SUPABASE_SECRET_KEY`                  | **Yes** | Secret key (`sb_secret_…`). Server only; needed to create/reset staff logins |
| `NEXT_PUBLIC_SITE_URL`                 | No      | Public address used in email links                                           |
