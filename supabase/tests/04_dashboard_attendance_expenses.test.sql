-- Check-ins, expenses privacy and the dashboard summary (M4).
begin;
select plan(14);

create function pg_temp.mk_user(p_email text, p_meta jsonb default '{}') returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          substr(md5(random()::text), 1, 8) || '.' || p_email, p_meta, '{}'::jsonb, now(), now());
  return v_id;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
grant execute on all functions in schema pg_temp to authenticated;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into ids values ('owner', pg_temp.mk_user('o@test.local'));
select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('gym', public.create_gym_with_owner('জিম', 'DB', 'ঢাকা', null, '', 'মেইন'));
insert into public.packages (gym_id, name, duration_days, price_paisa) values (pg_temp.id('gym'), 'মাসিক', 30, 150000);
select pg_temp.logout();
select is((select count(*)::int from public.expense_categories where gym_id = pg_temp.id('gym')), 6, 'new gyms get default expense categories');

insert into ids values
  ('manager', pg_temp.mk_user('m@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym')))),
  ('reception', pg_temp.mk_user('r@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym'))));
select pg_temp.login(pg_temp.id('owner'));
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('manager'), 'manager', 'ম্যানেজার', '+8801799300001');
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('reception'), 'reception', 'রিসেপশন', '+8801799300002');
-- Owner records rent and a salary.
insert into public.expenses (gym_id, branch_id, category_id, amount_paisa)
select pg_temp.id('gym'), b.id, c.id, x.amt
from public.branches b, public.expense_categories c, (values ('ভাড়া', 5000000), ('বেতন', 3000000)) x(cat, amt)
where b.gym_id = pg_temp.id('gym') and c.gym_id = pg_temp.id('gym') and c.name = x.cat;
select pg_temp.logout();

-- Salaries are owner-only.
insert into ids select 'salary_cat', id from public.expense_categories where gym_id = pg_temp.id('gym') and name = 'বেতন';
insert into ids select 'branch', id from public.branches where gym_id = pg_temp.id('gym') limit 1;
select pg_temp.login(pg_temp.id('manager'));
select is((select count(*)::int from public.expenses), 1, 'manager sees rent but not salaries');
select throws_ok(
  $$insert into public.expenses (gym_id, branch_id, category_id, amount_paisa)
    values (pg_temp.id('gym'), pg_temp.id('branch'), pg_temp.id('salary_cat'), 100)$$,
  '42501', null, 'manager cannot record a salary');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('reception'));
select is((select count(*)::int from public.expenses), 0, 'reception sees no expenses');
select pg_temp.logout();

-- Check-ins.
select pg_temp.login(pg_temp.id('reception'));
create temp table r as select public.register_member(pg_temp.id('gym'),
  (select id from public.branches where gym_id = pg_temp.id('gym') limit 1), 'রাফি', '+8801711400001',
  null, null, '', '', null, null, '', (select id from public.packages where gym_id = pg_temp.id('gym')), 150000) as x;
grant select on r to authenticated;
insert into ids select 'paid', (x ->> 'member_id')::uuid from r;
insert into ids select 'unpaid', (public.register_member(pg_temp.id('gym'),
  (select id from public.branches where gym_id = pg_temp.id('gym') limit 1), 'সাকিব', '+8801711400002') ->> 'member_id')::uuid;

select is((public.check_in_member(pg_temp.id('paid')) ->> 'result'), 'allowed', 'active member is let in');
select is((public.check_in_member(pg_temp.id('unpaid')) ->> 'result'), 'blocked', 'member without a package is blocked');
select is((select reason from public.attendance where member_id = pg_temp.id('unpaid')), 'expired', 'blocked with a reason');
select throws_ok($$select public.check_in_member(pg_temp.id('unpaid'), true)$$, '42501', 'forbidden', 'reception cannot override');
select throws_ok($$insert into public.attendance (gym_id, branch_id, method, result)
  select pg_temp.id('gym'), id, 'manual', 'allowed' from public.branches where gym_id = pg_temp.id('gym')$$,
  '42501', null, 'no direct inserts into attendance');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('manager'));
select is((public.check_in_member(pg_temp.id('unpaid'), true) ->> 'reason'), 'override', 'manager can override');
select is((select count(*)::int from public.audit_logs where action = 'access.manual_override'), 1, 'override is audited');
select pg_temp.logout();

-- Dashboard numbers.
select pg_temp.login(pg_temp.id('owner'));
create temp table s as select public.dashboard_summary(pg_temp.id('gym')) as j;
grant select on s to authenticated;
select is((select (j ->> 'today_paisa')::bigint from s), 150000::bigint, 'today''s collection');
select is((select (j ->> 'checkins_today')::int from s), 2, 'allowed check-ins today (blocked ones not counted)');
select is((select jsonb_array_length(j -> 'daily') from s), 14, '14 days of income vs expense');
select pg_temp.logout();

select * from finish();
rollback;
