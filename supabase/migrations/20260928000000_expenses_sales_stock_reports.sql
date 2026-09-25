-- M5: expense screens (audit + reference checks), supplements shop (products, stock, POS sales)
-- and the reports summary.

-------------------------------------------------------------------------------
-- Expenses: keep references inside one gym, and audit every change.
-------------------------------------------------------------------------------
create or replace function app_private.expenses_check_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.branches where id = new.branch_id and gym_id = new.gym_id)
     or not exists (select 1 from public.expense_categories where id = new.category_id and gym_id = new.gym_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.gym_id <> old.gym_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger expenses_check_refs before insert or update on public.expenses
  for each row execute function app_private.expenses_check_refs();

create or replace function app_private.audit_expense_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app_private.audit(new.gym_id, 'expense.created', 'expense', new.id, null,
      jsonb_build_object('amount_paisa', new.amount_paisa, 'category_id', new.category_id, 'spent_on', new.spent_on));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform app_private.audit(new.gym_id, 'expense.deleted', 'expense', new.id,
      jsonb_build_object('amount_paisa', old.amount_paisa, 'category_id', old.category_id, 'spent_on', old.spent_on), null);
  elsif (new.amount_paisa, new.category_id, new.spent_on) is distinct from (old.amount_paisa, old.category_id, old.spent_on) then
    perform app_private.audit(new.gym_id, 'expense.updated', 'expense', new.id,
      jsonb_build_object('amount_paisa', old.amount_paisa, 'category_id', old.category_id, 'spent_on', old.spent_on),
      jsonb_build_object('amount_paisa', new.amount_paisa, 'category_id', new.category_id, 'spent_on', new.spent_on));
  end if;
  return new;
end;
$$;
create trigger audit_expense_change after insert or update on public.expenses
  for each row execute function app_private.audit_expense_change();

-------------------------------------------------------------------------------
-- Products (supplements, drinks, accessories). Stock is counted per gym for now;
-- per-branch stock can come with multi-branch reporting.
-------------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  price_paisa bigint not null check (price_paisa > 0),
  -- Last purchase cost per unit (owner/manager screens only).
  cost_paisa bigint check (cost_paisa is null or cost_paisa >= 0),
  -- Changed only by stock movements (see trigger below), never directly.
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_at integer not null default 5 check (low_stock_at between 0 and 100000),
  is_low_stock boolean generated always as (stock_qty <= low_stock_at) stored,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create unique index products_gym_name_unique on public.products (gym_id, lower(trim(name))) where deleted_at is null;
create index products_gym_idx on public.products (gym_id, sort_order, name) where deleted_at is null;
create trigger set_updated_at before update on public.products
  for each row execute function app_private.set_updated_at();

create policy "front desk reads products" on public.products for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner,manager,reception}') or app_private.in_support_session(gym_id));
create policy "owner manager add products" on public.products for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));
create policy "owner manager edit products" on public.products for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager}'))
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));
-- Stock can't be typed in: only these columns are writable by app users.
revoke insert, update, delete, truncate on public.products from anon, authenticated;
grant insert (gym_id, name, price_paisa, cost_paisa, low_stock_at, is_active, sort_order) on public.products to authenticated;
grant update (name, price_paisa, cost_paisa, low_stock_at, is_active, sort_order, deleted_at) on public.products to authenticated;

create or replace function app_private.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app_private.audit(new.gym_id, 'product.created', 'product', new.id, null,
      jsonb_build_object('name', new.name, 'price_paisa', new.price_paisa));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform app_private.audit(new.gym_id, 'product.deleted', 'product', new.id,
      jsonb_build_object('name', old.name, 'stock_qty', old.stock_qty), null);
  elsif new.price_paisa is distinct from old.price_paisa then
    perform app_private.audit(new.gym_id, 'product.price_changed', 'product', new.id,
      jsonb_build_object('price_paisa', old.price_paisa), jsonb_build_object('price_paisa', new.price_paisa));
  end if;
  return new;
end;
$$;
create trigger audit_product_change after insert or update on public.products
  for each row execute function app_private.audit_product_change();

-------------------------------------------------------------------------------
-- Sales (POS) and stock movements
-------------------------------------------------------------------------------
create type public.stock_movement_kind as enum ('purchase', 'sale', 'sale_return', 'adjustment');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  member_id uuid references public.members (id),
  payment_id uuid not null unique references public.payments (id),
  subtotal_paisa bigint not null check (subtotal_paisa > 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  total_paisa bigint not null check (total_paisa > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.sales enable row level security;
create index sales_gym_time_idx on public.sales (gym_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  product_id uuid not null references public.products (id),
  -- Snapshots, so old receipts and reports don't change when a product is renamed or repriced.
  product_name text not null,
  qty integer not null check (qty between 1 and 999),
  unit_price_paisa bigint not null check (unit_price_paisa > 0),
  unit_cost_paisa bigint,
  line_total_paisa bigint not null check (line_total_paisa > 0)
);
alter table public.sale_items enable row level security;
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  product_id uuid not null references public.products (id),
  kind public.stock_movement_kind not null,
  qty_change integer not null check (qty_change <> 0),
  unit_cost_paisa bigint check (unit_cost_paisa is null or unit_cost_paisa >= 0),
  note text not null default '' check (char_length(note) <= 300),
  sale_id uuid references public.sales (id),
  expense_id uuid references public.expenses (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.stock_movements enable row level security;
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create policy "front desk reads sales" on public.sales for select to authenticated
  using ((app_private.has_gym_role(gym_id, '{owner,manager,reception}') and app_private.can_see_branch(gym_id, branch_id))
    or app_private.in_support_session(gym_id));
create policy "front desk reads sale items" on public.sale_items for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner,manager,reception}') or app_private.in_support_session(gym_id));
create policy "front desk reads stock movements" on public.stock_movements for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner,manager,reception}') or app_private.in_support_session(gym_id));
revoke insert, update, delete, truncate on public.sales, public.sale_items, public.stock_movements from anon, authenticated;

-- Every movement changes the product's stock; the check on products.stock_qty stops it going below zero.
create or replace function app_private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products set stock_qty = stock_qty + new.qty_change where id = new.product_id;
  return new;
end;
$$;
create trigger apply_stock_movement after insert on public.stock_movements
  for each row execute function app_private.apply_stock_movement();

-------------------------------------------------------------------------------
-- Stock in (purchase). Optionally records the purchase as an expense in one step.
-------------------------------------------------------------------------------
create or replace function public.add_stock(
  p_product_id uuid,
  p_qty integer,
  p_unit_cost_paisa bigint default null,
  p_expense_category_id uuid default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_branch uuid;
  v_expense uuid;
  v_note text := left(trim(coalesce(p_note, '')), 300);
begin
  select * into v_product from public.products where id = p_product_id and deleted_at is null for update;
  if v_product.id is null or not app_private.can_write_gym(v_product.gym_id, '{owner,manager}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if p_unit_cost_paisa is not null and p_unit_cost_paisa < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if p_expense_category_id is not null and coalesce(p_unit_cost_paisa, 0) > 0 then
    if not exists (select 1 from public.expense_categories c where c.id = p_expense_category_id
                   and c.gym_id = v_product.gym_id and c.is_active
                   and (not c.is_salary or app_private.has_gym_role(v_product.gym_id, '{owner}'))) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select b.id into v_branch from public.branches b
    where b.gym_id = v_product.gym_id and b.is_active and app_private.can_see_branch(b.gym_id, b.id)
    order by b.created_at limit 1;
    insert into public.expenses (gym_id, branch_id, category_id, amount_paisa, note)
    values (v_product.gym_id, v_branch, p_expense_category_id, p_unit_cost_paisa * p_qty,
      left(v_product.name || ' × ' || p_qty || case when v_note <> '' then ' · ' || v_note else '' end, 300))
    returning id into v_expense;
  end if;

  insert into public.stock_movements (gym_id, product_id, kind, qty_change, unit_cost_paisa, note, expense_id)
  values (v_product.gym_id, p_product_id, 'purchase', p_qty, p_unit_cost_paisa, v_note, v_expense);
  if p_unit_cost_paisa is not null then
    update public.products set cost_paisa = p_unit_cost_paisa where id = p_product_id;
  end if;

  return jsonb_build_object('stock_qty', v_product.stock_qty + p_qty, 'expense_id', v_expense);
end;
$$;

-------------------------------------------------------------------------------
-- Stock count correction (damaged, expired, counted wrong). Reason required, audited.
-------------------------------------------------------------------------------
create or replace function public.adjust_stock(p_product_id uuid, p_new_qty integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into v_product from public.products where id = p_product_id and deleted_at is null for update;
  if v_product.id is null or not app_private.can_write_gym(v_product.gym_id, '{owner,manager}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_new_qty is null or p_new_qty < 0 or p_new_qty > 100000 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_new_qty = v_product.stock_qty then
    return;
  end if;
  insert into public.stock_movements (gym_id, product_id, kind, qty_change, note)
  values (v_product.gym_id, p_product_id, 'adjustment', p_new_qty - v_product.stock_qty, left(v_reason, 300));
  perform app_private.audit(v_product.gym_id, 'stock.adjusted', 'product', p_product_id,
    jsonb_build_object('stock_qty', v_product.stock_qty), jsonb_build_object('stock_qty', p_new_qty), v_reason);
end;
$$;

-------------------------------------------------------------------------------
-- POS sale: items + stock out + payment (kind 'sale') + receipt, in one transaction.
-- p_items: [{"product_id": "...", "qty": 2}, ...]
-------------------------------------------------------------------------------
create or replace function public.record_sale(
  p_gym_id uuid,
  p_items jsonb,
  p_member_id uuid default null,
  p_discount_paisa bigint default 0,
  p_method public.payment_method default 'cash',
  p_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_member public.members;
  v_item record;
  v_subtotal bigint := 0;
  v_total bigint;
  v_lines int := 0;
  v_wanted int;
  v_sale uuid := gen_random_uuid();
  v_payment uuid;
  v_invoice text;
  v_txn text := nullif(trim(coalesce(p_transaction_id, '')), '');
  v_year int := extract(year from public.dhaka_today())::int;
begin
  if not app_private.can_write_gym(p_gym_id, '{owner,manager,reception}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;

  if p_member_id is not null then
    select * into v_member from public.members
    where id = p_member_id and gym_id = p_gym_id and deleted_at is null;
    if v_member.id is null or not app_private.can_see_branch(p_gym_id, v_member.branch_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_branch := v_member.branch_id;
  else
    select b.id into v_branch from public.branches b
    where b.gym_id = p_gym_id and b.is_active and app_private.can_see_branch(b.gym_id, b.id)
    order by b.created_at limit 1;
  end if;
  if v_branch is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(distinct e ->> 'product_id') into v_wanted from jsonb_array_elements(p_items) e;

  -- Lock the products (in id order, so two tills never deadlock) and check stock.
  for v_item in
    select p.id, p.name, p.price_paisa, p.cost_paisa, p.stock_qty, p.is_active, p.deleted_at, p.gym_id, i.qty
    from (
      select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::int) as qty
      from jsonb_array_elements(p_items) e
      group by 1
    ) i
    join public.products p on p.id = i.product_id
    order by i.product_id
    for update of p
  loop
    if v_item.gym_id <> p_gym_id or v_item.deleted_at is not null or not v_item.is_active then
      raise exception 'invalid_product' using errcode = '22023';
    end if;
    if v_item.qty is null or v_item.qty < 1 or v_item.qty > 999 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    if v_item.qty > v_item.stock_qty then
      raise exception 'insufficient_stock' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_item.price_paisa * v_item.qty;
    v_lines := v_lines + 1;
  end loop;
  if v_lines <> v_wanted then
    raise exception 'invalid_product' using errcode = '22023';
  end if;

  if p_discount_paisa is null or p_discount_paisa < 0 or p_discount_paisa >= v_subtotal then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  v_total := v_subtotal - p_discount_paisa;
  if p_method not in ('cash', 'card') and v_txn is null then
    raise exception 'transaction_id_required' using errcode = '22023';
  end if;

  v_invoice := 'INV-' || v_year || '-' || lpad(app_private.next_counter(p_gym_id, 'invoice', v_year)::text, 5, '0');
  begin
    insert into public.payments (gym_id, branch_id, member_id, kind, amount_paisa, method, transaction_id, status, invoice_no)
    values (p_gym_id, v_branch, p_member_id, 'sale', v_total, p_method, v_txn,
      case when p_method in ('cash', 'card') then 'completed' else 'pending_verification' end::public.payment_status,
      v_invoice)
    returning id into v_payment;
  exception when unique_violation then
    raise exception 'duplicate_transaction_id' using errcode = '23505';
  end;

  insert into public.sales (id, gym_id, branch_id, member_id, payment_id, subtotal_paisa, discount_paisa, total_paisa)
  values (v_sale, p_gym_id, v_branch, p_member_id, v_payment, v_subtotal, p_discount_paisa, v_total);

  insert into public.sale_items (sale_id, gym_id, product_id, product_name, qty, unit_price_paisa, unit_cost_paisa, line_total_paisa)
  select v_sale, p_gym_id, p.id, p.name, i.qty, p.price_paisa, p.cost_paisa, p.price_paisa * i.qty
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::int) as qty
    from jsonb_array_elements(p_items) e group by 1
  ) i
  join public.products p on p.id = i.product_id;

  insert into public.stock_movements (gym_id, product_id, kind, qty_change, sale_id)
  select p_gym_id, si.product_id, 'sale', -si.qty, v_sale from public.sale_items si where si.sale_id = v_sale;

  perform app_private.audit(p_gym_id, 'payment.created', 'payment', v_payment, null,
    jsonb_build_object('kind', 'sale', 'amount_paisa', v_total, 'discount_paisa', p_discount_paisa,
      'method', p_method, 'transaction_id', v_txn, 'invoice_no', v_invoice, 'sale_id', v_sale));

  return jsonb_build_object('sale_id', v_sale, 'payment_id', v_payment, 'invoice_no', v_invoice, 'total_paisa', v_total);
end;
$$;

-------------------------------------------------------------------------------
-- Cancelling a sale's payment puts the items back on the shelf (M3 rules otherwise unchanged).
-------------------------------------------------------------------------------
create or replace function public.cancel_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_role public.gym_role;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null or not app_private.gym_is_writable(v_pay.gym_id)
     or not app_private.can_see_branch(v_pay.gym_id, v_pay.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_role := app_private.gym_role(v_pay.gym_id);
  if not (
    v_role in ('owner', 'manager')
    or (v_role = 'reception' and v_pay.status = 'pending_verification' and v_pay.received_by = auth.uid())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_pay.status = 'cancelled' then
    raise exception 'already_cancelled' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  update public.payments
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = left(v_reason, 300)
  where id = p_payment_id;

  perform app_private.audit(v_pay.gym_id, 'payment.cancelled', 'payment', p_payment_id,
    jsonb_build_object('status', v_pay.status, 'amount_paisa', v_pay.amount_paisa, 'method', v_pay.method),
    jsonb_build_object('status', 'cancelled'), v_reason);

  if v_pay.membership_id is not null and not exists (
    select 1 from public.payments
    where membership_id = v_pay.membership_id and status <> 'cancelled' and id <> p_payment_id
  ) then
    update public.memberships set status = 'cancelled' where id = v_pay.membership_id and status <> 'cancelled';
    perform app_private.audit(v_pay.gym_id, 'membership.cancelled', 'membership', v_pay.membership_id,
      null, jsonb_build_object('because_payment', p_payment_id), v_reason);
  end if;

  if v_pay.kind = 'sale' then
    insert into public.stock_movements (gym_id, product_id, kind, qty_change, sale_id, note)
    select si.gym_id, si.product_id, 'sale_return', si.qty, si.sale_id, left(v_reason, 300)
    from public.sales s join public.sale_items si on si.sale_id = s.id
    where s.payment_id = p_payment_id;
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- Receipt now lists sold items.
-------------------------------------------------------------------------------
create or replace function public.get_receipt(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gym_name', g.name,
    'gym_logo_path', g.logo_path,
    'gym_phone', g.phone,
    'gym_address', g.address,
    'branch_name', b.name,
    'invoice_no', p.invoice_no,
    'paid_at', p.paid_at,
    'amount_paisa', p.amount_paisa,
    'method', p.method,
    'transaction_id', p.transaction_id,
    'status', p.status,
    'kind', p.kind,
    'member_name', m.full_name,
    'member_code', m.member_code,
    'package_name', pk.name,
    'start_date', ms.start_date,
    'end_date', ms.end_date,
    'received_by', coalesce(gu.display_name, ''),
    'discount_paisa', s.discount_paisa,
    'items', (select jsonb_agg(jsonb_build_object('name', si.product_name, 'qty', si.qty,
                'unit_price_paisa', si.unit_price_paisa, 'line_total_paisa', si.line_total_paisa) order by si.product_name)
              from public.sale_items si where si.sale_id = s.id)
  )
  from public.payments p
  join public.gyms g on g.id = p.gym_id
  join public.branches b on b.id = p.branch_id
  left join public.members m on m.id = p.member_id
  left join public.memberships ms on ms.id = p.membership_id
  left join public.packages pk on pk.id = ms.package_id
  left join public.gym_users gu on gu.gym_id = p.gym_id and gu.user_id = p.received_by
  left join public.sales s on s.payment_id = p.id
  where p.receipt_token = p_token and char_length(p_token) = 24;
$$;

-------------------------------------------------------------------------------
-- Reports (owner/manager). The caller's RLS applies, so a manager's expense figures
-- leave out salaries. Dates are Dhaka calendar days, inclusive.
-------------------------------------------------------------------------------
create or replace function public.report_summary(
  p_gym_id uuid,
  p_from date,
  p_to date,
  p_prev_from date,
  p_prev_to date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := public.dhaka_today();
  v_result jsonb;
begin
  if not (app_private.has_gym_role(p_gym_id, '{owner,manager}') or app_private.in_support_session(p_gym_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;

  with pay as (
    select (p.paid_at at time zone 'Asia/Dhaka')::date as d, p.amount_paisa, p.method, p.kind
    from public.payments p
    where p.gym_id = p_gym_id and p.status <> 'cancelled'
      and p.paid_at >= (least(p_from, coalesce(p_prev_from, p_from))::timestamp at time zone 'Asia/Dhaka')
      and p.paid_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
  ),
  exp as (
    select e.spent_on as d, e.amount_paisa, e.category_id
    from public.expenses e
    where e.gym_id = p_gym_id and e.deleted_at is null
      and e.spent_on between least(p_from, coalesce(p_prev_from, p_from)) and p_to
  ),
  months as (
    select gs::date as m
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') gs
  ),
  ended as (
    -- Memberships that ran out in the period (and already ran out by today).
    select ms.id, ms.end_date,
      exists (select 1 from public.memberships n where n.previous_membership_id = ms.id and n.status <> 'cancelled') as renewed
    from public.memberships ms
    join public.members mb on mb.id = ms.member_id and mb.deleted_at is null
    where ms.gym_id = p_gym_id and ms.status <> 'cancelled'
      and ms.end_date between p_from and least(p_to, v_today - 1)
  )
  select jsonb_build_object(
    'income_paisa', (select coalesce(sum(amount_paisa), 0) from pay where d between p_from and p_to),
    'sales_paisa', (select coalesce(sum(amount_paisa), 0) from pay where d between p_from and p_to and kind = 'sale'),
    'expense_paisa', (select coalesce(sum(amount_paisa), 0) from exp where d between p_from and p_to),
    'prev_income_paisa', (select coalesce(sum(amount_paisa), 0) from pay where d between p_prev_from and p_prev_to),
    'prev_expense_paisa', (select coalesce(sum(amount_paisa), 0) from exp where d between p_prev_from and p_prev_to),
    'methods', (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
        select method, sum(amount_paisa) as total from pay where d between p_from and p_to group by method) x),
    'monthly', (select jsonb_agg(jsonb_build_object(
        'month', months.m,
        'income', (select coalesce(sum(amount_paisa), 0) from pay
                   where d between greatest(months.m, p_from) and least((months.m + interval '1 month')::date - 1, p_to)),
        'expense', (select coalesce(sum(amount_paisa), 0) from exp
                   where d between greatest(months.m, p_from) and least((months.m + interval '1 month')::date - 1, p_to)),
        'new_members', (select count(*) from public.members mb
                   where mb.gym_id = p_gym_id and mb.deleted_at is null and mb.status <> 'pending'
                     and mb.joined_at between greatest(months.m, p_from) and least((months.m + interval '1 month')::date - 1, p_to)),
        'lost_members', (select count(*) from ended
                   where not renewed and end_date between months.m and (months.m + interval '1 month')::date - 1)
      ) order by months.m) from months),
    'expense_categories', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'is_salary', c.is_salary, 'total', x.total)
        order by x.total desc), '[]'::jsonb)
      from (select category_id, sum(amount_paisa) as total from exp where d between p_from and p_to group by category_id) x
      join public.expense_categories c on c.id = x.category_id),
    'packages', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'count', x.n, 'total', x.total)
        order by x.n desc, x.total desc), '[]'::jsonb)
      from (
        select pk.name, count(*) as n, sum(ms.price_paisa + ms.admission_fee_paisa - ms.discount_paisa) as total
        from public.memberships ms join public.packages pk on pk.id = ms.package_id
        where ms.gym_id = p_gym_id and ms.status <> 'cancelled'
          and (ms.created_at at time zone 'Asia/Dhaka')::date between p_from and p_to
        group by pk.name
        order by count(*) desc
        limit 6
      ) x),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('name', x.product_name, 'qty', x.qty, 'total', x.total)
        order by x.total desc), '[]'::jsonb)
      from (
        select si.product_name, sum(si.qty) as qty, sum(si.line_total_paisa) as total
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
        join public.payments p on p.id = s.payment_id and p.status <> 'cancelled'
        where s.gym_id = p_gym_id and (s.created_at at time zone 'Asia/Dhaka')::date between p_from and p_to
        group by si.product_name
        order by sum(si.line_total_paisa) desc
        limit 6
      ) x),
    'peak_hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', x.h, 'count', x.n) order by x.h), '[]'::jsonb)
      from (
        select (floor(extract(hour from a.checked_in_at at time zone 'Asia/Dhaka') / 2) * 2)::int as h, count(*) as n
        from public.attendance a
        where a.gym_id = p_gym_id and a.result = 'allowed'
          and (a.checked_in_at at time zone 'Asia/Dhaka')::date between p_from and p_to
        group by 1
      ) x),
    'checkins', (select count(*) from public.attendance a
      where a.gym_id = p_gym_id and a.result = 'allowed'
        and (a.checked_in_at at time zone 'Asia/Dhaka')::date between p_from and p_to),
    'new_members', (select count(*) from public.members mb
      where mb.gym_id = p_gym_id and mb.deleted_at is null and mb.status <> 'pending' and mb.joined_at between p_from and p_to),
    'ended_memberships', (select count(*) from ended),
    'renewed_memberships', (select count(*) from ended where renewed)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function
  public.add_stock(uuid, integer, bigint, uuid, text),
  public.adjust_stock(uuid, integer, text),
  public.record_sale(uuid, jsonb, uuid, bigint, public.payment_method, text),
  public.report_summary(uuid, date, date, date, date)
from public, anon;
grant execute on function
  public.add_stock(uuid, integer, bigint, uuid, text),
  public.adjust_stock(uuid, integer, text),
  public.record_sale(uuid, jsonb, uuid, bigint, public.payment_method, text),
  public.report_summary(uuid, date, date, date, date)
to authenticated;
