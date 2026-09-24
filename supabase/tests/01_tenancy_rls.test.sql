-- Tenant isolation and role rules for the M1 schema (docs/PLAN.md §4.6).
-- Each test impersonates a user by switching to the `authenticated` role and
-- setting the JWT claims that auth.uid() reads.
begin;
select plan(36);

-------------------------------------------------------------------------------
-- Test helpers
-------------------------------------------------------------------------------
create function pg_temp.mk_user(p_email text, p_meta jsonb default '{}') returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  -- Random prefix so test logins never collide with seed data or earlier runs.
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          substr(md5(random()::text), 1, 8) || '.' || p_email,
          p_meta, '{}'::jsonb, now(), now());
  return v_id;
end $$;

create function pg_temp.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- Shared state for the test run.
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;

insert into ids values
  ('owner_a', pg_temp.mk_user('owner.a@test.local')),
  ('owner_b', pg_temp.mk_user('owner.b@test.local')),
  ('admin', pg_temp.mk_user('admin@test.local'));
insert into public.platform_admins values ((select v from ids where k = 'admin'), 'super_admin');

-------------------------------------------------------------------------------
-- Onboarding creates a complete gym
-------------------------------------------------------------------------------
select pg_temp.login((select v from ids where k = 'owner_a'));
insert into ids values ('gym_a', public.create_gym_with_owner('পাওয়ার হাউস জিম', 'ph', 'ঢাকা', '+8801711111111', 'ধানমন্ডি', 'ধানমন্ডি শাখা'));
select pg_temp.logout();

select pg_temp.login((select v from ids where k = 'owner_b'));
insert into ids values ('gym_b', public.create_gym_with_owner('ফিট জোন', 'FZ', 'ঢাকা', null, '', 'মিরপুর শাখা'));
insert into public.packages (gym_id, name, duration_days, price_paisa)
  values ((select v from ids where k = 'gym_b'), 'মাসিক', 30, 150000);
select pg_temp.logout();

select is((select code_prefix from public.gyms where id = (select v from ids where k = 'gym_a')), 'PH', 'code prefix is upper-cased');
select is((select status::text from public.gyms where id = (select v from ids where k = 'gym_a')), 'trial', 'new gym starts in trial');
select ok((select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
           from public.gyms where id = (select v from ids where k = 'gym_a')), 'trial lasts 14 days');
select is((select role::text from public.gym_users where gym_id = (select v from ids where k = 'gym_a')), 'owner', 'creator becomes owner');
select is((select count(*)::int from public.branches where gym_id = (select v from ids where k = 'gym_a')), 1, 'first branch created');
select is((select count(*)::int from public.gym_subscriptions where gym_id = (select v from ids where k = 'gym_a')), 1, 'trial subscription created');
select is((select count(*)::int from public.audit_logs where gym_id = (select v from ids where k = 'gym_a') and action = 'gym.created'), 1, 'gym creation audited');

-------------------------------------------------------------------------------
-- Tenant isolation: owner A sees nothing of gym B
-------------------------------------------------------------------------------
select pg_temp.login((select v from ids where k = 'owner_a'));
select is((select count(*)::int from public.gyms), 1, 'owner A sees only their own gym');
select is((select count(*)::int from public.branches where gym_id = (select v from ids where k = 'gym_b')), 0, 'owner A cannot see gym B branches');
select is((select count(*)::int from public.packages where gym_id = (select v from ids where k = 'gym_b')), 0, 'owner A cannot see gym B packages');
select is((select count(*)::int from public.gym_users where gym_id = (select v from ids where k = 'gym_b')), 0, 'owner A cannot see gym B staff');
select is((select count(*)::int from public.audit_logs where gym_id = (select v from ids where k = 'gym_b')), 0, 'owner A cannot see gym B audit log');
select is((select count(*)::int from public.profiles where user_id = (select v from ids where k = 'owner_b')), 0, 'owner A cannot see owner B profile');
select throws_ok(
  $$insert into public.packages (gym_id, name, duration_days, price_paisa) values ((select v from ids where k = 'gym_b'), 'hack', 30, 1)$$,
  '42501', null, 'owner A cannot add a package to gym B');
select is_empty(
  $$update public.gyms set name = 'hacked' where id = (select v from ids where k = 'gym_b') returning id$$,
  'owner A cannot rename gym B');
select is(public.gym_access_state((select v from ids where k = 'gym_b')), null, 'owner A cannot read gym B status');

-- Owners cannot change billing-controlled columns on their own gym.
select throws_ok(
  $$update public.gyms set status = 'active' where id = (select v from ids where k = 'gym_a')$$,
  '42501', null, 'owner cannot change own gym status');
select throws_ok(
  $$update public.gyms set trial_ends_at = now() + interval '1 year' where id = (select v from ids where k = 'gym_a')$$,
  '42501', null, 'owner cannot extend own trial');
select throws_ok(
  $$insert into public.platform_admins values ((select v from ids where k = 'owner_a'), 'super_admin')$$,
  '42501', null, 'user cannot make themselves a platform admin');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Staff roles
-------------------------------------------------------------------------------
insert into ids values
  ('reception', pg_temp.mk_user('8801722222222@staff.gymnode.invalid', jsonb_build_object('created_for_gym', (select v from ids where k = 'gym_a')))),
  ('manager', pg_temp.mk_user('8801733333333@staff.gymnode.invalid', jsonb_build_object('created_for_gym', (select v from ids where k = 'gym_a')))),
  ('trainer', pg_temp.mk_user('8801744444444@staff.gymnode.invalid', jsonb_build_object('created_for_gym', (select v from ids where k = 'gym_a')))),
  ('stranger', pg_temp.mk_user('stranger@test.local'));

select pg_temp.login((select v from ids where k = 'owner_a'));
select lives_ok(
  $$select public.add_gym_user((select v from ids where k = 'gym_a'), (select v from ids where k = 'manager'), 'manager', 'রুবেল', '+8801733333333')$$,
  'owner can add a manager');
select throws_ok(
  $$select public.add_gym_user((select v from ids where k = 'gym_a'), (select v from ids where k = 'stranger'), 'reception', 'x', null)$$,
  '42501', 'user_not_created_for_gym', 'owner cannot attach a login that was not created for the gym');
select pg_temp.logout();

select pg_temp.login((select v from ids where k = 'manager'));
select throws_ok(
  $$select public.add_gym_user((select v from ids where k = 'gym_a'), (select v from ids where k = 'reception'), 'manager', 'শিপা', '+8801799000002')$$,
  '42501', 'forbidden', 'manager cannot create another manager');
select lives_ok(
  $$select public.add_gym_user((select v from ids where k = 'gym_a'), (select v from ids where k = 'reception'), 'reception', 'শিপা', '+8801799000002')$$,
  'manager can add reception');
select lives_ok(
  $$select public.add_gym_user((select v from ids where k = 'gym_a'), (select v from ids where k = 'trainer'), 'trainer', 'কামাল', '+8801744444444')$$,
  'manager can add a trainer');
select pg_temp.logout();

select is((select must_change_password from public.profiles where user_id = (select v from ids where k = 'reception')), true,
  'new staff must change their password');

select pg_temp.login((select v from ids where k = 'reception'));
select is((select count(*)::int from public.packages), 0, 'reception sees packages of own gym only (none yet)');
select throws_ok(
  $$insert into public.packages (gym_id, name, duration_days, price_paisa) values ((select v from ids where k = 'gym_a'), 'মাসিক', 30, 150000)$$,
  '42501', null, 'reception cannot create packages');
select is((select count(*)::int from public.audit_logs), 0, 'reception cannot read the audit log');
select pg_temp.logout();

-- Deactivated staff lose access immediately.
select pg_temp.login((select v from ids where k = 'owner_a'));
select public.set_gym_user_active((select id from public.gym_users where user_id = (select v from ids where k = 'trainer')), false);
select pg_temp.logout();
select pg_temp.login((select v from ids where k = 'trainer'));
select is((select count(*)::int from public.gyms), 0, 'deactivated trainer sees no gym');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Audit log is append-only
-------------------------------------------------------------------------------
select pg_temp.login((select v from ids where k = 'owner_a'));
select throws_ok($$update public.audit_logs set action = 'x'$$, '42501', null, 'audit log cannot be edited');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'audit log cannot be deleted');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Trial expiry → read-only
-------------------------------------------------------------------------------
update public.gyms set trial_ends_at = now() - interval '8 days' where id = (select v from ids where k = 'gym_a');
select pg_temp.login((select v from ids where k = 'owner_a'));
select is(public.gym_access_state((select v from ids where k = 'gym_a'))::text, 'suspended', 'trial ended 8 days ago → suspended');
select throws_ok(
  $$insert into public.packages (gym_id, name, duration_days, price_paisa) values ((select v from ids where k = 'gym_a'), 'মাসিক', 30, 150000)$$,
  '42501', null, 'suspended gym is read-only');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Support mode: read-only, time-limited, admins only
-------------------------------------------------------------------------------
select pg_temp.login((select v from ids where k = 'admin'));
select is((select count(*)::int from public.gyms), 0, 'platform admin sees no gym without a support session');
select pg_temp.logout();

insert into public.support_sessions (admin_user_id, gym_id, reason, expires_at)
values ((select v from ids where k = 'admin'), (select v from ids where k = 'gym_b'), 'bKash verification issue', now() + interval '1 hour');

select pg_temp.login((select v from ids where k = 'admin'));
select is((select count(*)::int from public.packages where gym_id = (select v from ids where k = 'gym_b')), 1, 'support session can read the gym');
select throws_ok(
  $$insert into public.packages (gym_id, name, duration_days, price_paisa) values ((select v from ids where k = 'gym_b'), 'x', 30, 1)$$,
  '42501', null, 'support session cannot write');
select pg_temp.logout();

select * from finish();
rollback;
