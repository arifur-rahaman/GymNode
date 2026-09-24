-- Verify / cancel payments, pay due, receipts (M3).
begin;
select plan(19);

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
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

-- Setup: gym with owner, manager, reception; one member on a ৳1,500 package (no admission).
insert into ids values ('owner', pg_temp.mk_user('o@test.local'));
select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('gym', public.create_gym_with_owner('জিম', 'GM', 'ঢাকা', null, '', 'মেইন'));
insert into public.packages (gym_id, name, duration_days, price_paisa) values (pg_temp.id('gym'), 'মাসিক', 30, 150000);
select pg_temp.logout();
insert into ids values
  ('manager', pg_temp.mk_user('m@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym')))),
  ('reception', pg_temp.mk_user('r@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym'))));
select pg_temp.login(pg_temp.id('owner'));
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('manager'), 'manager', 'ম্যানেজার', '+8801799200001');
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('reception'), 'reception', 'রিসেপশন', '+8801799200002');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('reception'));
create temp table r1 as select public.register_member(pg_temp.id('gym'),
  (select id from public.branches where gym_id = pg_temp.id('gym') limit 1), 'রাফি', '+8801711300001',
  null, null, '', '', null, null, '', (select id from public.packages where gym_id = pg_temp.id('gym')),
  150000, 0, 'bkash', 'FAKE12345') as r;
grant select on r1 to authenticated, anon;
insert into ids select 'member', (r ->> 'member_id')::uuid from r1;
insert into ids select 'pay1', (r ->> 'payment_id')::uuid from r1;
select is((select status::text from public.payments where id = pg_temp.id('pay1')), 'pending_verification', 'bKash starts pending');

-- Reception cannot verify.
select throws_ok($$select public.verify_payment(pg_temp.id('pay1'))$$, '42501', 'forbidden', 'reception cannot verify');
select pg_temp.logout();

-- Stats and snapshot.
select pg_temp.login(pg_temp.id('owner'));
select is((public.gym_money_snapshot(pg_temp.id('gym')) ->> 'pending_count')::int, 1, 'snapshot counts pending payments');
select is((public.payment_stats(pg_temp.id('gym'), now() - interval '1 day', now() + interval '1 day') ->> 'total_paisa')::bigint,
  150000::bigint, 'today''s total includes the pending payment');
select is((public.payment_stats(pg_temp.id('gym'), now() - interval '1 day', now() + interval '1 day') -> 'by_method' ->> 'bkash')::bigint,
  150000::bigint, 'totals are split by method');
select pg_temp.logout();

-- Reception cancels her own pending payment (e.g. wrong ID) → membership cancelled too → member expired.
select pg_temp.login(pg_temp.id('reception'));
select throws_ok($$select public.cancel_payment(pg_temp.id('pay1'), '')$$, '22023', 'reason_required', 'a reason is required');
select lives_ok($$select public.cancel_payment(pg_temp.id('pay1'), 'ভুল ট্রানজেকশন আইডি')$$, 'reception cancels own pending payment');
select is((select status::text from public.payments where id = pg_temp.id('pay1')), 'cancelled', 'payment is cancelled, not deleted');
select is((select display_status from public.member_overview where id = pg_temp.id('member')), 'expired',
  'the membership that payment paid for is cancelled too');
select is((select count(*)::int from public.audit_logs where action = 'payment.cancelled' and entity_id = pg_temp.id('pay1')), 0,
  'reception cannot read the audit log (checked as owner below)');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('owner'));
select is((select reason from public.audit_logs where action = 'payment.cancelled' and entity_id = pg_temp.id('pay1')),
  'ভুল ট্রানজেকশন আইডি', 'cancellation is audited with the reason');
select pg_temp.logout();

-- A cash renewal that leaves a due; pay the due separately.
select pg_temp.login(pg_temp.id('reception'));
create temp table r2 as select public.record_payment_and_renew(pg_temp.id('member'),
  (select id from public.packages where gym_id = pg_temp.id('gym')), 100000) as r;
grant select on r2 to authenticated;
insert into ids select 'pay2', (r ->> 'payment_id')::uuid from r2;
select is((select due_paisa from public.member_overview where id = pg_temp.id('member')), 50000::bigint, '৳500 left due');
select throws_ok($$select public.pay_due(pg_temp.id('member'), 60000)$$, '22023', 'invalid_amount', 'cannot pay more than the due');
select lives_ok($$select public.pay_due(pg_temp.id('member'), 50000)$$, 'pay the due in cash');
select is((select display_status from public.member_overview where id = pg_temp.id('member')), 'active', 'due cleared → active');

-- Reception cannot cancel a completed (cash) payment; manager can.
select throws_ok($$select public.cancel_payment(pg_temp.id('pay2'), 'ভুল পরিমাণ')$$, '42501', 'forbidden',
  'reception cannot cancel a completed payment');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('manager'));
select lives_ok($$select public.cancel_payment(pg_temp.id('pay2'), 'ভুল পরিমাণ')$$, 'manager can cancel a completed payment');
select pg_temp.logout();

-- Receipts: anyone with the token, nobody without it.
create temp table tok as select receipt_token from public.payments where id = pg_temp.id('pay2');
grant select on tok to anon;
select pg_temp.as_anon();
select is((public.get_receipt((select receipt_token from tok)) ->> 'member_name'), 'রাফি', 'receipt opens with its token');
select is(public.get_receipt('000000000000000000000000'), null, 'a wrong token shows nothing');
select pg_temp.logout();

select * from finish();
rollback;
