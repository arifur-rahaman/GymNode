-- Supplements shop (products, stock, POS sales), expense safety and the reports summary (M5).
begin;
select plan(29);

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
create function pg_temp.stock(p_k text) returns int language sql as $$
  select stock_qty from public.products where id = pg_temp.id(p_k) $$;
grant execute on function pg_temp.stock(text) to authenticated;

-- Two gyms: ours and a stranger's.
insert into ids values ('owner', pg_temp.mk_user('o@test.local')), ('owner2', pg_temp.mk_user('o2@test.local'));
select pg_temp.login(pg_temp.id('owner2'));
insert into ids values ('gym2', public.create_gym_with_owner('অন্য জিম', 'OT', 'ঢাকা', null, '', 'মেইন'));
insert into public.products (gym_id, name, price_paisa) values (pg_temp.id('gym2'), 'অন্যের পানি', 2000);
insert into ids select 'other_product', id from public.products where gym_id = pg_temp.id('gym2');
insert into ids select 'branch2', id from public.branches where gym_id = pg_temp.id('gym2');
select pg_temp.logout();

select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('gym', public.create_gym_with_owner('জিম', 'SS', 'ঢাকা', null, '', 'মেইন'));
select pg_temp.logout();
insert into ids values
  ('manager', pg_temp.mk_user('m@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym')))),
  ('reception', pg_temp.mk_user('r@test.local', jsonb_build_object('created_for_gym', pg_temp.id('gym'))));
insert into ids select 'branch', id from public.branches where gym_id = pg_temp.id('gym');
insert into ids select 'cat_supp', id from public.expense_categories where gym_id = pg_temp.id('gym') and name = 'সাপ্লিমেন্ট কেনা';
insert into ids select 'cat_salary', id from public.expense_categories where gym_id = pg_temp.id('gym') and name = 'বেতন';
insert into ids select 'cat_rent', id from public.expense_categories where gym_id = pg_temp.id('gym') and name = 'ভাড়া';

select pg_temp.login(pg_temp.id('owner'));
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('manager'), 'manager', 'ম্যানেজার', '+8801799500001');
select public.add_gym_user(pg_temp.id('gym'), pg_temp.id('reception'), 'reception', 'রিসেপশন', '+8801799500002');
insert into public.products (gym_id, name, price_paisa, low_stock_at) values (pg_temp.id('gym'), 'প্রোটিন শেক', 15000, 5);
insert into ids select 'shake', id from public.products where gym_id = pg_temp.id('gym');
select is(pg_temp.stock('shake'), 0, 'new product starts with no stock');
select throws_ok($$update public.products set stock_qty = 50 where id = pg_temp.id('shake')$$,
  '42501', null, 'stock cannot be typed in directly');

-- Stock in, recorded as an expense in the same step.
select is((public.add_stock(pg_temp.id('shake'), 10, 9000, pg_temp.id('cat_supp'), 'ডিলার') ->> 'stock_qty')::int, 10, 'add_stock returns the new stock');
select is(pg_temp.stock('shake'), 10, 'stock went up');
select is((select amount_paisa from public.expenses where gym_id = pg_temp.id('gym')), 90000::bigint, 'purchase recorded as a ৳900 expense');
select is((select cost_paisa from public.products where id = pg_temp.id('shake')), 9000::bigint, 'last cost price remembered');
select pg_temp.logout();

-- Reception sells; can't manage products or stock.
select pg_temp.login(pg_temp.id('reception'));
select throws_ok($$insert into public.products (gym_id, name, price_paisa) values (pg_temp.id('gym'), 'এনার্জি', 100)$$,
  '42501', null, 'reception cannot add products');
select throws_ok($$select public.add_stock(pg_temp.id('shake'), 5)$$, '42501', 'forbidden', 'reception cannot add stock');
create temp table sale1 as select public.record_sale(pg_temp.id('gym'),
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('shake'), 'qty', 2),
                    jsonb_build_object('product_id', pg_temp.id('shake'), 'qty', 1))) as j;
grant select on sale1 to authenticated;
insert into ids select 'sale_payment', (j ->> 'payment_id')::uuid from sale1;
select is((select (j ->> 'total_paisa')::bigint from sale1), 45000::bigint, 'same product twice in the cart is merged: 3 × ৳150');
select is(pg_temp.stock('shake'), 7, 'stock went down by 3');
select is((select kind::text || '/' || status::text from public.payments where id = pg_temp.id('sale_payment')),
  'sale/completed', 'cash sale is a completed payment of kind sale');
select is((select jsonb_array_length(public.get_receipt(receipt_token) -> 'items') from public.payments where id = pg_temp.id('sale_payment')),
  1, 'receipt lists the sold items');
select throws_ok($$select public.record_sale(pg_temp.id('gym'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('shake'), 'qty', 8)))$$,
  'P0001', 'insufficient_stock', 'cannot sell more than is on the shelf');
select throws_ok($$select public.record_sale(pg_temp.id('gym'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('other_product'), 'qty', 1)))$$,
  '22023', 'invalid_product', 'cannot sell another gym''s product');
select throws_ok($$select public.record_sale(pg_temp.id('gym'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('shake'), 'qty', 1)), null, 0, 'bkash')$$,
  '22023', 'transaction_id_required', 'bKash sale needs the transaction ID');
select throws_ok($$select public.record_sale(pg_temp.id('gym'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('shake'), 'qty', 1)), null, 15000)$$,
  '22023', 'invalid_discount', 'discount cannot make the sale free');
select throws_ok($$select public.record_sale(pg_temp.id('gym'), '[]'::jsonb)$$, '22023', 'empty_cart', 'empty cart is refused');
select throws_ok($$insert into public.sales (gym_id, branch_id, payment_id, subtotal_paisa, total_paisa)
  values (pg_temp.id('gym'), pg_temp.id('branch'), pg_temp.id('sale_payment'), 1, 1)$$, '42501', null, 'no direct inserts into sales');
select throws_ok($$select public.cancel_payment(pg_temp.id('sale_payment'), 'ভুল করে')$$, '42501', 'forbidden',
  'reception cannot cancel a completed sale');
select pg_temp.logout();

-- Owner cancels the sale: items go back on the shelf.
select pg_temp.login(pg_temp.id('owner'));
select lives_ok($$select public.cancel_payment(pg_temp.id('sale_payment'), 'গ্রাহক ফেরত দিয়েছে')$$, 'owner cancels the sale');
select is(pg_temp.stock('shake'), 10, 'cancelled sale puts the stock back');
select pg_temp.logout();

-- Manager corrects the count (reason required, audited).
select pg_temp.login(pg_temp.id('manager'));
select throws_ok($$select public.adjust_stock(pg_temp.id('shake'), 4, '')$$, '22023', 'reason_required', 'adjustment needs a reason');
select public.adjust_stock(pg_temp.id('shake'), 4, 'মেয়াদ শেষ, ফেলে দেওয়া হয়েছে');
select is((select is_low_stock from public.products where id = pg_temp.id('shake')), true, '4 left (alert at 5) is low stock');
select is((select count(*)::int from public.audit_logs where action = 'stock.adjusted' and entity_id = pg_temp.id('shake')), 1, 'adjustment is audited');

-- Expenses stay inside one gym and changes are audited.
select throws_ok($$insert into public.expenses (gym_id, branch_id, category_id, amount_paisa)
  values (pg_temp.id('gym'), pg_temp.id('branch2'), pg_temp.id('cat_rent'), 100)$$, '42501', null,
  'expense cannot point at another gym''s branch');
insert into public.expenses (gym_id, branch_id, category_id, amount_paisa) values (pg_temp.id('gym'), pg_temp.id('branch'), pg_temp.id('cat_rent'), 500000);
update public.expenses set amount_paisa = 600000 where category_id = pg_temp.id('cat_rent');
select is((select count(*)::int from public.audit_logs where action = 'expense.updated' and gym_id = pg_temp.id('gym')), 1, 'expense edit is audited');
select pg_temp.logout();

-- Reports: owner sees salaries, manager doesn't, reception can't open it.
select pg_temp.login(pg_temp.id('owner'));
insert into public.expenses (gym_id, branch_id, category_id, amount_paisa) values (pg_temp.id('gym'), pg_temp.id('branch'), pg_temp.id('cat_salary'), 1000000);
select is((public.report_summary(pg_temp.id('gym'), public.dhaka_today(), public.dhaka_today(), public.dhaka_today() - 1, public.dhaka_today() - 1) ->> 'expense_paisa')::bigint,
  1690000::bigint, 'owner report: stock ৳900 + rent ৳6,000 + salary ৳10,000');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('manager'));
select is((public.report_summary(pg_temp.id('gym'), public.dhaka_today(), public.dhaka_today(), public.dhaka_today() - 1, public.dhaka_today() - 1) ->> 'expense_paisa')::bigint,
  690000::bigint, 'manager report leaves out salaries');
select pg_temp.logout();
select pg_temp.login(pg_temp.id('reception'));
select throws_ok($$select public.report_summary(pg_temp.id('gym'), public.dhaka_today(), public.dhaka_today(), null, null)$$,
  '42501', 'forbidden', 'reception cannot open reports');
select pg_temp.logout();

select * from finish();
rollback;
