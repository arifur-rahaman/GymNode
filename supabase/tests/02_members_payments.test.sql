-- Members, memberships, freezes, payments and QR sign-up (M2).
begin;
select plan(46);

create function pg_temp.mk_user(p_email text, p_meta jsonb default '{}') returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          substr(md5(random()::text), 1, 8) || '.' || p_email, p_meta, '{}'::jsonb, now(), now());
  return v_id;
end $$;

create function pg_temp.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

-------------------------------------------------------------------------------
-- Setup: gym A (owner, reception, trainer) and gym B (owner)
-------------------------------------------------------------------------------
insert into ids values ('owner_a', pg_temp.mk_user('oa@test.local')), ('owner_b', pg_temp.mk_user('ob@test.local'));

select pg_temp.login(pg_temp.id('owner_a'));
insert into ids values ('gym_a', public.create_gym_with_owner('জিম এ', 'GA', 'ঢাকা', null, '', 'মেইন'));
insert into public.packages (gym_id, name, duration_days, price_paisa, admission_fee_paisa)
values (pg_temp.id('gym_a'), 'মাসিক', 30, 150000, 100000) returning id \gset pkg_
insert into ids values ('pkg', :'pkg_id');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('owner_b'));
insert into ids values ('gym_b', public.create_gym_with_owner('জিম বি', 'GB', 'ঢাকা', null, '', 'মেইন'));
select pg_temp.logout();

insert into ids values
  ('reception', pg_temp.mk_user('r@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym_a')))),
  ('trainer', pg_temp.mk_user('t@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym_a'))));
select pg_temp.login(pg_temp.id('owner_a'));
select public.add_gym_user(pg_temp.id('gym_a'), pg_temp.id('reception'), 'reception', 'শিপা', '+8801799100001');
insert into ids values ('trainer_gu', public.add_gym_user(pg_temp.id('gym_a'), pg_temp.id('trainer'), 'trainer', 'কামাল', '+8801799100002'));
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Reception adds members and takes payments
-------------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('reception'));
insert into public.members (gym_id, branch_id, full_name, phone, assigned_trainer_id)
select pg_temp.id('gym_a'), b.id, 'রাফি আহমেদ', '+8801711000001', pg_temp.id('trainer_gu')
from public.branches b where b.gym_id = pg_temp.id('gym_a') returning id \gset m1_
insert into ids values ('m1', :'m1_id');
insert into public.members (gym_id, branch_id, full_name, phone)
select pg_temp.id('gym_a'), b.id, 'তানিয়া ইসলাম', '+8801711000002'
from public.branches b where b.gym_id = pg_temp.id('gym_a') returning id \gset m2_
insert into ids values ('m2', :'m2_id');

select is((select member_code from public.members where id = pg_temp.id('m1')), 'GA-0001', 'first member gets GA-0001');
select is((select member_code from public.members where id = pg_temp.id('m2')), 'GA-0002', 'codes count up');
select is((select display_status from public.member_overview where id = pg_temp.id('m1')), 'expired', 'no membership yet → expired');

-- Full payment: monthly ৳1,500 + admission ৳1,000 = ৳2,500.
select is(
  (public.record_payment_and_renew(pg_temp.id('m1'), pg_temp.id('pkg'), 250000) ->> 'end_date')::date,
  public.dhaka_today() + 29, 'new membership runs 30 days from today');
select is((select display_status from public.member_overview where id = pg_temp.id('m1')), 'active', 'fully paid → active');
select is((select due_paisa from public.member_overview where id = pg_temp.id('m1')), 0::bigint, 'no due');
select matches((select invoice_no from public.payments where member_id = pg_temp.id('m1')),
  '^INV-\d{4}-00001$', 'first invoice number per gym and year');
select is((select status::text from public.payments where member_id = pg_temp.id('m1')), 'completed', 'cash is completed at once');

-- Renewal while active continues after the current end date; admission is not charged again.
select is(
  (public.record_payment_and_renew(pg_temp.id('m1'), pg_temp.id('pkg'), 150000) ->> 'start_date')::date,
  public.dhaka_today() + 30, 'early renewal starts the day after the current end');
select is((select due_paisa from public.member_overview where id = pg_temp.id('m1')), 0::bigint, 'renewal without admission fee is fully paid');

-- Partial payment leaves a due.
select public.record_payment_and_renew(pg_temp.id('m2'), pg_temp.id('pkg'), 100000);
select is((select due_paisa from public.member_overview where id = pg_temp.id('m2')), 150000::bigint, 'partial payment leaves ৳1,500 due');
select is((select display_status from public.member_overview where id = pg_temp.id('m2')), 'due', 'owing money → due');

-- Mobile banking needs a transaction ID and is pending until verified, but counts as paid (Q4).
select throws_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m2'), pg_temp.id('pkg'), 150000, 0, 'bkash')$$,
  '22023', 'transaction_id_required', 'bKash without transaction ID is refused');
select lives_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m2'), pg_temp.id('pkg'), 300000, 0, 'bkash', 'TXN123456')$$,
  'bKash with transaction ID works (pays renewal + old due)');
select is((select due_paisa from public.member_overview where id = pg_temp.id('m2')), 0::bigint, 'pending bKash counts as paid');
select ok((select has_pending_payment from public.member_overview where id = pg_temp.id('m2')), 'pending bKash is flagged');
select throws_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m2'), pg_temp.id('pkg'), 150000, 0, 'bkash', 'TXN123456')$$,
  '23505', 'duplicate_transaction_id', 'the same bKash transaction ID cannot be used twice');
select throws_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m2'), pg_temp.id('pkg'), 99999999)$$,
  '22023', 'invalid_amount', 'cannot take more than is owed');

-- Money tables cannot be written directly.
select throws_ok(
  $$insert into public.payments (gym_id, branch_id, member_id, amount_paisa, method, status, invoice_no)
    select gym_id, branch_id, id, 100, 'cash', 'completed', 'X-1' from public.members where id = pg_temp.id('m1')$$,
  '42501', null, 'no direct inserts into payments');
select throws_ok(
  $$update public.memberships set end_date = end_date + 365$$,
  '42501', null, 'no direct edits of memberships');

-- Reception cannot delete members (soft delete is owner/manager only).
select throws_ok(
  $$update public.members set deleted_at = now() where id = pg_temp.id('m2')$$,
  '42501', 'forbidden', 'reception cannot delete a member');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Expired member (membership in the past)
-------------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('owner_a'));
insert into public.members (gym_id, branch_id, full_name, phone)
select pg_temp.id('gym_a'), b.id, 'সাকিব হাসান', '+8801711000003'
from public.branches b where b.gym_id = pg_temp.id('gym_a') returning id \gset m3_
insert into ids values ('m3', :'m3_id');
select public.record_payment_and_renew(pg_temp.id('m3'), pg_temp.id('pkg'), 250000, 0, 'cash', null, null, public.dhaka_today() - 60);
select is((select display_status from public.member_overview where id = pg_temp.id('m3')), 'expired', 'past end date → expired');
select is(
  (public.record_payment_and_renew(pg_temp.id('m3'), pg_temp.id('pkg'), 150000) ->> 'start_date')::date,
  public.dhaka_today(), 'renewing an expired membership starts today');

-------------------------------------------------------------------------------
-- Freeze / unfreeze
-------------------------------------------------------------------------------
insert into ids select 'ms1', membership_id from public.member_overview where id = pg_temp.id('m1');
create temp table before_freeze as select end_date from public.memberships where id = pg_temp.id('ms1');
grant select on before_freeze to authenticated;

select public.freeze_membership(pg_temp.id('ms1'), public.dhaka_today(), public.dhaka_today() + 9, 'অসুস্থ');
select is((select end_date from public.memberships where id = pg_temp.id('ms1')),
  (select end_date + 10 from before_freeze), 'freezing 10 days adds 10 days');
select is((select display_status from public.member_overview where id = pg_temp.id('m1')), 'frozen', 'frozen today → frozen');
select public.unfreeze_membership(pg_temp.id('ms1'));
select is((select end_date from public.memberships where id = pg_temp.id('ms1')),
  (select end_date from before_freeze), 'unfreezing on day one gives all unused days back');
select is((select display_status from public.member_overview where id = pg_temp.id('m1')), 'active', 'unfrozen → active');
select throws_ok(
  $$select public.freeze_membership(pg_temp.id('ms1'), public.dhaka_today() - 1, public.dhaka_today() + 5)$$,
  '22023', 'invalid_dates', 'cannot freeze in the past');

-- Owner can delete; deleted members disappear from the overview.
update public.members set deleted_at = now() where id = pg_temp.id('m3');
select is((select count(*)::int from public.member_overview where id = pg_temp.id('m3')), 0, 'deleted member hidden');
select is((select count(*)::int from public.audit_logs where action = 'member.deleted' and entity_id = pg_temp.id('m3')), 1, 'member deletion audited');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Trainer: only assigned members, no payments
-------------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('trainer'));
select is((select count(*)::int from public.member_overview), 1, 'trainer sees only their assigned member');
select is((select count(*)::int from public.payments), 0, 'trainer cannot see payments');
select throws_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m1'), pg_temp.id('pkg'), 150000)$$,
  '42501', 'forbidden', 'trainer cannot take payments');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- Other gym sees nothing
-------------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('owner_b'));
select is((select count(*)::int from public.member_overview), 0, 'gym B sees no gym A members');
select is((select count(*)::int from public.payments), 0, 'gym B sees no gym A payments');
select throws_ok(
  $$select public.record_payment_and_renew(pg_temp.id('m1'), pg_temp.id('pkg'), 150000)$$,
  '42501', 'forbidden', 'gym B cannot take a payment for a gym A member');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- QR self-registration (no login)
-------------------------------------------------------------------------------
create temp table slug_a as select slug from public.gyms where id = pg_temp.id('gym_a');
grant select on slug_a to anon;
select pg_temp.as_anon();
select lives_ok(
  format($$select public.submit_self_registration(%L, 'নতুন সদস্য', '+8801711000009', 'female')$$,
    (select slug from slug_a)),
  'anyone with the link can sign up');
select throws_ok(
  $$select public.submit_self_registration('no-such-gym', 'কেউ', '+8801711000010')$$,
  'P0002', 'gym_not_found', 'unknown gym link is refused');
select is((select count(*)::int from public.members), 0, 'anonymous visitors cannot read members');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('reception'));
select is((select member_code from public.members where phone = '+8801711000009'), null, 'pending sign-up has no member code yet');
update public.members set status = 'active' where phone = '+8801711000009';
select is((select member_code from public.members where phone = '+8801711000009'), 'GA-0004', 'approval assigns the next code');
select pg_temp.logout();

-------------------------------------------------------------------------------
-- register_member: member + membership + payment together
-------------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('reception'));
create temp table reg as
select public.register_member(pg_temp.id('gym_a'), (select id from public.branches where gym_id = pg_temp.id('gym_a') limit 1),
  'নাদিয়া করিম', '+8801711000020', 'female', null, '', '', null, null, '', pg_temp.id('pkg'), 250000) as r;
select is((select r ->> 'member_code' from reg), 'GA-0005', 'register_member returns the new code');
select is((select display_status from public.member_overview where id = (select (r ->> 'member_id')::uuid from reg)),
  'active', 'registered and paid in one step');
select throws_ok(
  $$select public.register_member(pg_temp.id('gym_a'), (select id from public.branches where gym_id = pg_temp.id('gym_a') limit 1),
    'ভুল প্যাকেজ', '+8801711000021', null, null, '', '', null, null, '', gen_random_uuid(), 100)$$,
  '22023', 'invalid_package', 'a bad package rolls everything back');
select is((select count(*)::int from public.members where phone = '+8801711000021'), 0, 'no half-created member is left behind');
select is((select sum(total)::int from public.member_status_counts(pg_temp.id('gym_a'))), 4, 'tab counts cover all visible members (one was deleted)');
select pg_temp.logout();

select * from finish();
rollback;
