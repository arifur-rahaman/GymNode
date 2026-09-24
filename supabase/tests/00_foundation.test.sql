-- pgTAP tests. Run with: pnpm db:test  (supabase test db)
-- RLS isolation tests for gyms, members and payments are added from M1 onward.
begin;
select plan(5);

select has_extension('pg_trgm', 'pg_trgm is installed');
select has_schema('app_private', 'app_private schema exists');
select has_function('app_private', 'set_updated_at', 'set_updated_at() exists');
select has_function('public', 'dhaka_today', 'dhaka_today() exists');

select is(
  public.dhaka_today(),
  (now() at time zone 'Asia/Dhaka')::date,
  'dhaka_today() returns the Dhaka calendar date'
);

select * from finish();
rollback;
