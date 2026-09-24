-- M0 foundation: extensions and shared helpers used by every later migration.
-- Business tables arrive in M1+ (see docs/PLAN.md §4). Every tenant table must
-- enable RLS in the same migration that creates it.

-- Trigram search on member name / phone / code (M2).
create extension if not exists pg_trgm with schema extensions;

-- Private schema for helper functions that must not be exposed through the API.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- Keeps updated_at current on every update. Attached per table:
--   create trigger set_updated_at before update on <table>
--   for each row execute function app_private.set_updated_at();
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Business "today" is always the Dhaka calendar date, never UTC's.
create or replace function public.dhaka_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Dhaka')::date;
$$;

comment on function public.dhaka_today() is 'Current calendar date in Asia/Dhaka. Use for all membership/expiry decisions.';
