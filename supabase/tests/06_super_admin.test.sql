-- Super admin (M7): platform functions, support mode, billing, plan limits, tickets.
begin;
select plan(36);

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

insert into ids values
  ('super', pg_temp.mk_user('sa@test.local')),
  ('support', pg_temp.mk_user('sup@test.local')),
  ('owner', pg_temp.mk_user('o@test.local')),
  ('owner2', pg_temp.mk_user('o2@test.local'));
insert into public.platform_admins (user_id, role) values (pg_temp.id('super'), 'super_admin'), (pg_temp.id('support'), 'support');
-- A tiny test plan: 1 member, 1 branch.
insert into public.plans (code, name, name_en, price_paisa, max_members, max_branches, sort_order)
values ('tiny-test', 'টিনি', 'Tiny', 100000, 1, 1, 99);
insert into ids select 'tiny', id from public.plans where code = 'tiny-test';

select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('gym', public.create_gym_with_owner('টেস্ট জিম', 'TA', 'ঢাকা', null, '', 'মেইন'));
insert into ids select 'branch', id from public.branches where gym_id = pg_temp.id('gym');
insert into ids values ('m1', (public.register_member(pg_temp.id('gym'), pg_temp.id('branch'), 'প্রথম', '+8801799600001') ->> 'member_id')::uuid);
select pg_temp.logout();
select pg_temp.login(pg_temp.id('owner2'));
insert into ids values ('gym2', public.create_gym_with_owner('অন্য জিম', 'TB', 'সিলেট', null, '', 'মেইন'));
select pg_temp.logout();

-- Who may call the platform functions.
select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$select public.admin_overview()$$, '42501', 'forbidden', 'gym owner cannot open the admin dashboard');
select throws_ok($$select public.admin_list_gyms()$$, '42501', 'forbidden', 'gym owner cannot list all gyms');
select is((select count(*)::int from public.gyms), 1, 'gym owner still sees only their own gym');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('support'));
select lives_ok($$select public.admin_overview()$$, 'support team can see the dashboard');
select throws_ok($$select public.admin_set_gym_plan(pg_temp.id('gym'), pg_temp.id('tiny'))$$, '42501', 'forbidden',
  'support team cannot change plans');
select throws_ok($$select public.admin_update_setting('trial_days', '30')$$, '42501', 'forbidden',
  'support team cannot change platform settings');
select pg_temp.logout();

-- Super admin: no silent access to gym data.
select pg_temp.login(pg_temp.id('super'));
select ok((public.admin_list_gyms() -> 'counts' ->> 'all')::int >= 2, 'super admin lists every gym');
select is((select count(*)::int from public.members where gym_id = pg_temp.id('gym')), 0,
  'super admin cannot read a gym''s members without a support session');
select throws_ok($$select public.start_support_session(pg_temp.id('gym'), 'দেখা')$$, '22023', 'reason_required',
  'support session needs a real reason');
create temp table sess as select public.start_support_session(pg_temp.id('gym'), 'মালিক ফোন করে রিপোর্ট নিয়ে প্রশ্ন করেছেন') as j;
grant select on sess to authenticated;
select is((select count(*)::int from public.members where gym_id = pg_temp.id('gym')), 1, 'support mode can read the gym''s members');
select is((select count(*)::int from public.members where gym_id = pg_temp.id('gym2')), 0, '…but only that one gym');
select throws_ok($$insert into public.packages (gym_id, name, duration_days, price_paisa) values (pg_temp.id('gym'), 'X', 30, 100)$$,
  '42501', null, 'support mode is read-only');
select throws_ok($$select public.check_in_member(pg_temp.id('m1'))$$, '42501', 'forbidden', 'support mode cannot check members in');
select ok((select (j ->> 'expires_at')::timestamptz <= now() + interval '2 hours' from sess), 'support session expires within 2 hours');
select public.end_support_session((select (j ->> 'session_id')::uuid from sess));
select is((select count(*)::int from public.members where gym_id = pg_temp.id('gym')), 0, 'ending the session removes access');
select pg_temp.logout();
select is((select count(*)::int from public.audit_logs where gym_id = pg_temp.id('gym') and action like 'support.session_%'), 2,
  'support session start and end are audited');

-- Plans are edited by super admins only (audited).
select pg_temp.login(pg_temp.id('super'));
update public.plans set price_paisa = 250000 where code = 'tiny-test';
select is((select price_paisa from public.plans where code = 'tiny-test'), 250000::bigint, 'super admin edits a plan price');
select pg_temp.logout();
select is((select count(*)::int from public.audit_logs where action = 'plan.updated' and entity_id = pg_temp.id('tiny')), 1, 'plan edit is audited');
select pg_temp.login(pg_temp.id('owner'));
update public.plans set price_paisa = 1 where code = 'tiny-test';
select pg_temp.logout();
select is((select price_paisa from public.plans where code = 'tiny-test'), 250000::bigint, 'gym owner cannot change plan prices');

-- Plan limits in the gym panel.
select pg_temp.login(pg_temp.id('super'));
select public.admin_set_gym_plan(pg_temp.id('gym'), pg_temp.id('tiny'));
select pg_temp.logout();
select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$select public.register_member(pg_temp.id('gym'), pg_temp.id('branch'), 'দ্বিতীয়', '+8801799600002')$$,
  'P0001', 'plan_limit_members', 'member limit of the plan is enforced');
select throws_ok($$insert into public.branches (gym_id, name) values (pg_temp.id('gym'), 'দ্বিতীয় শাখা')$$,
  'P0001', 'plan_limit_branches', 'branch limit of the plan is enforced');
select is((public.gym_plan_usage(pg_temp.id('gym')) ->> 'members')::int, 1, 'owner sees plan usage');
select pg_temp.logout();

-- Billing: invoices, overdue → past_due (still writable), paid → active.
select pg_temp.login(pg_temp.id('super'));
select public.admin_set_gym_status(pg_temp.id('gym'), 'active', 'পেমেন্ট পেয়েছি');
insert into ids values ('inv', public.admin_create_invoice(pg_temp.id('gym'), 250000, public.dhaka_today() - 3,
  date_trunc('month', public.dhaka_today())::date));
select throws_ok($$select public.admin_create_invoice(pg_temp.id('gym'), 250000, public.dhaka_today(), date_trunc('month', public.dhaka_today())::date)$$,
  '23505', 'invoice_exists', 'one invoice per gym per month');
select is(public.admin_generate_invoices(public.dhaka_today()), 0, 'generating invoices skips months already billed');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('owner'));
select is(public.gym_access_state(pg_temp.id('gym'))::text, 'past_due', 'overdue invoice shows the gym as past due');
select lives_ok($$insert into public.packages (gym_id, name, duration_days, price_paisa) values (pg_temp.id('gym'), 'Y', 30, 100)$$,
  'a past-due gym can still work (only suspension is read-only)');
select is((select count(*)::int from public.subscription_invoices where gym_id = pg_temp.id('gym')), 1, 'owner sees their own invoices');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('super'));
select throws_ok($$select public.admin_mark_invoice_paid(pg_temp.id('inv'), 'bkash')$$, '22023', 'transaction_id_required',
  'bKash payment needs a transaction ID');
select public.admin_mark_invoice_paid(pg_temp.id('inv'), 'bkash', 'TXN123456');
select is(app_private.gym_effective_status(pg_temp.id('gym'))::text, 'active', 'paying the invoice makes the gym active again');
select public.admin_set_gym_status(pg_temp.id('gym'), 'suspended', 'বিল পরিশোধ হয়নি');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$insert into public.packages (gym_id, name, duration_days, price_paisa) values (pg_temp.id('gym'), 'Z', 30, 100)$$,
  '42501', null, 'a suspended gym is read-only');

-- Support tickets: allowed even while suspended; private to the gym and the team.
insert into ids values ('ticket', public.open_support_ticket(pg_temp.id('gym'), 'অ্যাকাউন্ট চালু করুন', 'বিল দিয়েছি, চালু করে দিন', 'urgent'));
select pg_temp.logout();
select pg_temp.login(pg_temp.id('owner2'));
select is((select count(*)::int from public.support_tickets where id = pg_temp.id('ticket')), 0, 'other gyms cannot see the ticket');
select throws_ok($$select public.reply_support_ticket(pg_temp.id('ticket'), 'হ্যালো')$$, '42501', 'forbidden', 'other gyms cannot reply');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('support'));
select public.reply_support_ticket(pg_temp.id('ticket'), 'দেখছি, একটু অপেক্ষা করুন');
select is((select status::text from public.support_tickets where id = pg_temp.id('ticket')), 'answered', 'team reply marks the ticket answered');
select pg_temp.logout();

-- Settings and team.
select pg_temp.login(pg_temp.id('super'));
select throws_ok($$select public.admin_update_setting('trial_days', '500')$$, '22023', 'invalid_setting', 'trial length is validated');
select public.admin_update_setting('trial_days', '21');
select is((select value #>> '{}' from public.platform_settings where key = 'trial_days'), '21', 'super admin changes the trial length');
select throws_ok($$select public.admin_remove_team_member(pg_temp.id('super'))$$, 'P0001', 'cannot_remove_self', 'cannot remove yourself');
select pg_temp.logout();

select * from finish();
rollback;
