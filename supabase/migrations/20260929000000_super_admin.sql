-- M7: super admin panel (SA-*.dc.html), SaaS billing, support mode, support tickets, plan limits.
--
-- Super admins get NO "see everything" RLS rule on gym data. Platform screens call the
-- security-definer functions below, which check the caller is a platform admin first.
-- Looking inside one gym needs a support session: audited, read-only, max 2 hours.

-------------------------------------------------------------------------------
-- Platform roles
-------------------------------------------------------------------------------
create or replace function app_private.platform_role()
returns public.platform_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.platform_admins where user_id = auth.uid();
$$;

create or replace function app_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.platform_role() = 'super_admin', false);
$$;

create or replace function app_private.require_platform_admin(p_super boolean default false)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app_private.platform_role() is null or (p_super and not app_private.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app_private.platform_role(), app_private.is_super_admin(),
  app_private.require_platform_admin(boolean) from public, anon;
grant execute on function app_private.platform_role(), app_private.is_super_admin() to authenticated;

-------------------------------------------------------------------------------
-- Gym status history (for churn) and effective status
-------------------------------------------------------------------------------
alter table public.gyms add column status_changed_at timestamptz not null default now();

create or replace function app_private.gyms_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger gyms_status_changed before update on public.gyms
  for each row execute function app_private.gyms_status_changed();

-- Effective status, without an access check (used by admin functions and by gym_access_state).
-- Trial: past_due when it ends, suspended (read-only) after the grace days (Q3).
-- Active: past_due while a subscription invoice is overdue. Suspending a paying gym is
-- always a manual super-admin decision, never automatic.
create or replace function app_private.gym_effective_status(p_gym_id uuid)
returns public.gym_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.status = 'trial' and now() >= g.trial_ends_at
      + make_interval(days => coalesce((select (value #>> '{}')::int from public.platform_settings where key = 'past_due_grace_days'), 7))
      then 'suspended'::public.gym_status
    when g.status = 'trial' and now() >= g.trial_ends_at then 'past_due'::public.gym_status
    when g.status = 'active' and exists (
      select 1 from public.subscription_invoices i
      where i.gym_id = g.id and i.status = 'unpaid' and i.due_date < public.dhaka_today()
    ) then 'past_due'::public.gym_status
    else g.status
  end
  from public.gyms g
  where g.id = p_gym_id;
$$;
revoke all on function app_private.gym_effective_status(uuid) from public, anon;
grant execute on function app_private.gym_effective_status(uuid) to authenticated;

create or replace function public.gym_access_state(p_gym_id uuid)
returns public.gym_status
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.gym_effective_status(p_gym_id) where app_private.can_read_gym(p_gym_id);
$$;

-------------------------------------------------------------------------------
-- Plans: super admins edit them (prices are placeholders until the founder decides)
-------------------------------------------------------------------------------
create policy "super admin adds plans" on public.plans for insert to authenticated
  with check (app_private.is_super_admin());
create policy "super admin edits plans" on public.plans for update to authenticated
  using (app_private.is_super_admin()) with check (app_private.is_super_admin());
revoke delete on public.plans from authenticated;

create or replace function app_private.audit_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.audit(null, case when tg_op = 'INSERT' then 'plan.created' else 'plan.updated' end,
    'plan', new.id,
    case when tg_op = 'UPDATE' then jsonb_build_object('price_paisa', old.price_paisa, 'max_members', old.max_members,
      'max_branches', old.max_branches, 'max_devices', old.max_devices, 'features', old.features, 'is_active', old.is_active) end,
    jsonb_build_object('price_paisa', new.price_paisa, 'max_members', new.max_members,
      'max_branches', new.max_branches, 'max_devices', new.max_devices, 'features', new.features, 'is_active', new.is_active));
  return new;
end;
$$;
create trigger audit_plan_change after insert or update on public.plans
  for each row execute function app_private.audit_plan_change();

-- Platform settings (trial days, grace days): super admins only, audited.
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  perform app_private.require_platform_admin(true);
  if p_key not in ('trial_days', 'past_due_grace_days') then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 1 and 90
     or (p_value #>> '{}')::numeric <> floor((p_value #>> '{}')::numeric) then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  select value into v_old from public.platform_settings where key = p_key;
  insert into public.platform_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform app_private.audit(null, 'platform.setting_changed', 'setting', null,
    jsonb_build_object(p_key, v_old), jsonb_build_object(p_key, p_value));
end;
$$;

-------------------------------------------------------------------------------
-- Plan limits (members, branches; devices arrive with M8) enforced in the database
-------------------------------------------------------------------------------
-- A gym without a plan (trial) has no limits: trials try every feature.
create or replace function app_private.gym_plan_limit(p_gym_id uuid, p_limit text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_limit
    when 'members' then p.max_members
    when 'branches' then p.max_branches
    when 'devices' then p.max_devices
  end
  from public.gyms g join public.plans p on p.id = g.plan_id
  where g.id = p_gym_id;
$$;

create or replace function app_private.gym_has_feature(p_gym_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select coalesce((p.features ->> p_feature)::boolean, false)
    from public.gyms g join public.plans p on p.id = g.plan_id
    where g.id = p_gym_id
  ), true);
$$;
revoke all on function app_private.gym_plan_limit(uuid, text), app_private.gym_has_feature(uuid, text) from public, anon;
grant execute on function app_private.gym_has_feature(uuid, text) to authenticated;

-- Members count against the limit once approved (pending QR sign-ups don't).
create or replace function app_private.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  if new.deleted_at is not null or new.status = 'pending' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is null and old.status <> 'pending' then
    return new;
  end if;
  v_max := app_private.gym_plan_limit(new.gym_id, 'members');
  if v_max is not null and (
    select count(*) from public.members m
    where m.gym_id = new.gym_id and m.deleted_at is null and m.status <> 'pending' and m.id <> new.id
  ) >= v_max then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger enforce_member_limit before insert or update of status, deleted_at on public.members
  for each row execute function app_private.enforce_member_limit();

create or replace function app_private.enforce_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  v_max := app_private.gym_plan_limit(new.gym_id, 'branches');
  if v_max is not null and (
    select count(*) from public.branches b where b.gym_id = new.gym_id and b.is_active and b.id <> new.id
  ) >= v_max then
    raise exception 'plan_limit_branches' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger enforce_branch_limit before insert or update of is_active on public.branches
  for each row execute function app_private.enforce_branch_limit();

-- "My plan" card for the gym owner: plan, limits and current usage.
create or replace function public.gym_plan_usage(p_gym_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', app_private.gym_effective_status(g.id),
    'trial_ends_at', g.trial_ends_at,
    'plan', case when p.id is null then null else jsonb_build_object(
      'code', p.code, 'name', p.name, 'name_en', p.name_en, 'price_paisa', coalesce(s.price_paisa, p.price_paisa),
      'billing_period', p.billing_period, 'max_members', p.max_members, 'max_branches', p.max_branches,
      'max_devices', p.max_devices, 'features', p.features) end,
    'members', (select count(*) from public.members m where m.gym_id = g.id and m.deleted_at is null and m.status <> 'pending'),
    'branches', (select count(*) from public.branches b where b.gym_id = g.id and b.is_active),
    'current_period_end', s.current_period_end
  )
  from public.gyms g
  left join public.plans p on p.id = g.plan_id
  left join public.gym_subscriptions s on s.gym_id = g.id
  where g.id = p_gym_id and app_private.can_read_gym(p_gym_id);
$$;

-------------------------------------------------------------------------------
-- Subscription invoices (SaaS billing of gyms)
-------------------------------------------------------------------------------
create sequence public.subscription_invoice_seq;
revoke all on sequence public.subscription_invoice_seq from public, anon, authenticated;

alter table public.subscription_invoices
  add column plan_id uuid references public.plans (id),
  add column period_start date,
  add column period_end date,
  add column note text not null default '' check (char_length(note) <= 300),
  add column recorded_by uuid,
  add column void_reason text;
create unique index subscription_invoices_period_unique on public.subscription_invoices (gym_id, period_start)
  where status <> 'void' and period_start is not null;

create or replace function app_private.new_invoice_no()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'SUB-' || extract(year from public.dhaka_today())::int || '-' || lpad(nextval('public.subscription_invoice_seq')::text, 5, '0');
$$;
revoke all on function app_private.new_invoice_no() from public, anon, authenticated;

-- Monthly price of a gym (subscription override, else the plan price; yearly plans ÷ 12).
create or replace function app_private.gym_monthly_price(p_gym_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.billing_period = 'yearly' then round(coalesce(s.price_paisa, p.price_paisa) / 12.0)::bigint
              else coalesce(s.price_paisa, p.price_paisa) end
  from public.gyms g
  join public.plans p on p.id = g.plan_id
  left join public.gym_subscriptions s on s.gym_id = g.id
  where g.id = p_gym_id;
$$;
revoke all on function app_private.gym_monthly_price(uuid) from public, anon, authenticated;

create or replace function public.admin_create_invoice(
  p_gym_id uuid,
  p_amount_paisa bigint,
  p_due_date date,
  p_period_start date default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_sub public.gym_subscriptions;
  v_id uuid;
  v_no text;
begin
  perform app_private.require_platform_admin(true);
  select * into v_gym from public.gyms where id = p_gym_id;
  if v_gym.id is null then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  if p_amount_paisa is null or p_amount_paisa < 0 or p_due_date is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select * into v_sub from public.gym_subscriptions where gym_id = p_gym_id;
  v_no := app_private.new_invoice_no();
  begin
    insert into public.subscription_invoices (gym_id, subscription_id, invoice_no, amount_paisa, due_date, plan_id,
      period_start, period_end, note, recorded_by)
    values (p_gym_id, v_sub.id, v_no, p_amount_paisa, p_due_date, v_gym.plan_id,
      p_period_start, case when p_period_start is not null then (p_period_start + interval '1 month')::date - 1 end,
      left(trim(coalesce(p_note, '')), 300), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'invoice_exists' using errcode = '23505';
  end;
  perform app_private.audit(p_gym_id, 'billing.invoice_created', 'subscription_invoice', v_id, null,
    jsonb_build_object('invoice_no', v_no, 'amount_paisa', p_amount_paisa, 'due_date', p_due_date));
  return v_id;
end;
$$;

-- One invoice per paying gym for a month (skips gyms without a price and months already billed).
create or replace function public.admin_generate_invoices(p_month date, p_due_day integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_count integer := 0;
  v_gym record;
begin
  perform app_private.require_platform_admin(true);
  if p_due_day is null or p_due_day not between 1 and 28 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  for v_gym in
    select g.id, app_private.gym_monthly_price(g.id) as price
    from public.gyms g
    where g.status in ('active', 'past_due') and g.plan_id is not null
      and not exists (select 1 from public.subscription_invoices i
                      where i.gym_id = g.id and i.period_start = v_month and i.status <> 'void')
  loop
    continue when v_gym.price is null or v_gym.price = 0;
    perform public.admin_create_invoice(v_gym.id, v_gym.price, v_month + (p_due_day - 1), v_month, '');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_mark_invoice_paid(
  p_invoice_id uuid,
  p_method public.billing_method,
  p_transaction_id text default null,
  p_paid_on date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.subscription_invoices;
  v_paid_at timestamptz := coalesce((p_paid_on::timestamp + time '12:00') at time zone 'Asia/Dhaka', now());
begin
  perform app_private.require_platform_admin(true);
  select * into v_inv from public.subscription_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.status <> 'unpaid' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if p_method is null or (p_method not in ('cash', 'card', 'bank') and nullif(trim(coalesce(p_transaction_id, '')), '') is null) then
    raise exception 'transaction_id_required' using errcode = '22023';
  end if;
  update public.subscription_invoices
  set status = 'paid', paid_at = v_paid_at, method = p_method,
      transaction_id = nullif(trim(coalesce(p_transaction_id, '')), ''), recorded_by = auth.uid()
  where id = p_invoice_id;
  -- Paying brings a gym back to active and moves its paid-up period forward.
  update public.gym_subscriptions
  set status = 'active',
      current_period_start = coalesce(v_inv.period_start::timestamptz, current_period_start),
      current_period_end = greatest(coalesce(current_period_end, now()), coalesce((v_inv.period_end + 1)::timestamptz, now()))
  where gym_id = v_inv.gym_id;
  update public.gyms set status = 'active' where id = v_inv.gym_id and status in ('trial', 'past_due');
  perform app_private.audit(v_inv.gym_id, 'billing.invoice_paid', 'subscription_invoice', p_invoice_id,
    jsonb_build_object('status', 'unpaid'),
    jsonb_build_object('status', 'paid', 'method', p_method, 'transaction_id', p_transaction_id, 'amount_paisa', v_inv.amount_paisa));
end;
$$;

create or replace function public.admin_void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.subscription_invoices;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform app_private.require_platform_admin(true);
  select * into v_inv from public.subscription_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.status = 'void' then
    raise exception 'already_cancelled' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.subscription_invoices set status = 'void', void_reason = left(v_reason, 300) where id = p_invoice_id;
  perform app_private.audit(v_inv.gym_id, 'billing.invoice_voided', 'subscription_invoice', p_invoice_id,
    jsonb_build_object('status', v_inv.status), jsonb_build_object('status', 'void'), v_reason);
end;
$$;

create or replace function public.admin_list_invoices(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_platform_admin();
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
        'all', count(*) filter (where status <> 'void'),
        'unpaid', count(*) filter (where status = 'unpaid'),
        'overdue', count(*) filter (where status = 'unpaid' and due_date < public.dhaka_today()),
        'paid', count(*) filter (where status = 'paid'),
        'unpaid_paisa', coalesce(sum(amount_paisa) filter (where status = 'unpaid'), 0),
        'paid_month_paisa', coalesce(sum(amount_paisa) filter (where status = 'paid'
          and (paid_at at time zone 'Asia/Dhaka')::date >= date_trunc('month', public.dhaka_today())::date), 0))
      from public.subscription_invoices),
    'rows', coalesce((select jsonb_agg(r order by r.sort_key desc, r.invoice_no desc) from (
        select i.id, i.invoice_no, i.gym_id, g.name as gym_name, p.name as plan_name, i.amount_paisa, i.due_date,
          i.status, i.method, i.transaction_id, i.paid_at, i.period_start, i.note, i.void_reason,
          (i.status = 'unpaid' and i.due_date < public.dhaka_today()) as overdue,
          i.due_date as sort_key
        from public.subscription_invoices i
        join public.gyms g on g.id = i.gym_id
        left join public.plans p on p.id = i.plan_id
        where p_status is null
           or (p_status = 'unpaid' and i.status = 'unpaid')
           or (p_status = 'overdue' and i.status = 'unpaid' and i.due_date < public.dhaka_today())
           or (p_status = 'paid' and i.status = 'paid')
           or (p_status = 'void' and i.status = 'void')
        order by i.due_date desc, i.invoice_no desc
        limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
      ) r), '[]'::jsonb)
  );
end;
$$;

-------------------------------------------------------------------------------
-- Gym management by super admins
-------------------------------------------------------------------------------
create or replace function public.admin_set_gym_plan(p_gym_id uuid, p_plan_id uuid, p_price_paisa bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  perform app_private.require_platform_admin(true);
  select * into v_gym from public.gyms where id = p_gym_id for update;
  if v_gym.id is null then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  if p_plan_id is not null and not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'invalid_package' using errcode = '22023';
  end if;
  if p_price_paisa is not null and p_price_paisa < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update public.gyms set plan_id = p_plan_id where id = p_gym_id;
  insert into public.gym_subscriptions (gym_id, plan_id, price_paisa, status)
  values (p_gym_id, p_plan_id, p_price_paisa, case when v_gym.status = 'trial' then 'trialing' else 'active' end::public.subscription_status)
  on conflict (gym_id) do update set plan_id = excluded.plan_id, price_paisa = excluded.price_paisa;
  perform app_private.audit(p_gym_id, 'billing.plan_changed', 'gym', p_gym_id,
    jsonb_build_object('plan_id', v_gym.plan_id), jsonb_build_object('plan_id', p_plan_id, 'price_paisa', p_price_paisa));
end;
$$;

create or replace function public.admin_set_gym_status(p_gym_id uuid, p_status public.gym_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform app_private.require_platform_admin(true);
  select * into v_gym from public.gyms where id = p_gym_id for update;
  if v_gym.id is null then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  if p_status not in ('active', 'suspended', 'cancelled') then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.gyms set status = p_status where id = p_gym_id;
  update public.gym_subscriptions
  set status = case p_status when 'active' then 'active' when 'cancelled' then 'cancelled' else 'past_due' end::public.subscription_status
  where gym_id = p_gym_id;
  perform app_private.audit(p_gym_id, 'gym.status_changed', 'gym', p_gym_id,
    jsonb_build_object('status', v_gym.status), jsonb_build_object('status', p_status), v_reason);
end;
$$;

create or replace function public.admin_extend_trial(p_gym_id uuid, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_new timestamptz;
begin
  perform app_private.require_platform_admin(true);
  select * into v_gym from public.gyms where id = p_gym_id for update;
  if v_gym.id is null then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  v_new := greatest(coalesce(v_gym.trial_ends_at, now()), now()) + make_interval(days => p_days);
  update public.gyms set status = 'trial', trial_ends_at = v_new where id = p_gym_id;
  update public.gym_subscriptions set status = 'trialing', current_period_end = v_new where gym_id = p_gym_id;
  perform app_private.audit(p_gym_id, 'gym.trial_extended', 'gym', p_gym_id,
    jsonb_build_object('trial_ends_at', v_gym.trial_ends_at, 'status', v_gym.status),
    jsonb_build_object('trial_ends_at', v_new, 'days', p_days));
  return v_new;
end;
$$;

-------------------------------------------------------------------------------
-- Support mode: read-only look inside one gym, max 2 hours, always audited
-------------------------------------------------------------------------------
create or replace function public.start_support_session(p_gym_id uuid, p_reason text, p_minutes integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_id uuid;
  v_expires timestamptz;
begin
  perform app_private.require_platform_admin();
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  if char_length(v_reason) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes not between 5 and 120 then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  -- One open session per admin at a time.
  update public.support_sessions set ended_at = now()
  where admin_user_id = auth.uid() and ended_at is null and expires_at > now();
  v_expires := now() + make_interval(mins => p_minutes);
  insert into public.support_sessions (admin_user_id, gym_id, reason, expires_at)
  values (auth.uid(), p_gym_id, left(v_reason, 500), v_expires)
  returning id into v_id;
  perform app_private.audit(p_gym_id, 'support.session_started', 'support_session', v_id, null,
    jsonb_build_object('expires_at', v_expires), v_reason);
  return jsonb_build_object('session_id', v_id, 'expires_at', v_expires);
end;
$$;

create or replace function public.end_support_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.support_sessions;
begin
  select * into v_s from public.support_sessions where id = p_session_id and admin_user_id = auth.uid();
  if v_s.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_s.ended_at is null then
    update public.support_sessions set ended_at = now() where id = p_session_id;
    perform app_private.audit(v_s.gym_id, 'support.session_ended', 'support_session', p_session_id, null, null);
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- Support tickets (gym owner/manager ↔ GymNode team)
-------------------------------------------------------------------------------
create type public.ticket_priority as enum ('normal', 'urgent');
create type public.ticket_status as enum ('open', 'answered', 'closed');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  opened_by uuid references auth.users (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
create index support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index support_tickets_gym_idx on public.support_tickets (gym_id, last_message_at desc);
create trigger set_updated_at before update on public.support_tickets
  for each row execute function app_private.set_updated_at();

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  from_platform boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.support_ticket_messages enable row level security;
create index support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at);

-- Tickets are platform data (not gym records), so platform admins read them directly.
create policy "read tickets" on public.support_tickets for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner,manager}') or app_private.platform_role() is not null);
create policy "read ticket messages" on public.support_ticket_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (app_private.has_gym_role(t.gym_id, '{owner,manager}') or app_private.platform_role() is not null)));
revoke insert, update, delete, truncate on public.support_tickets, public.support_ticket_messages from anon, authenticated;

create or replace function public.open_support_ticket(
  p_gym_id uuid,
  p_subject text,
  p_body text,
  p_priority public.ticket_priority default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Allowed even when the gym is read-only: suspended gyms still need to reach support.
  if not app_private.has_gym_role(p_gym_id, '{owner,manager}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 1 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if (select count(*) from public.support_tickets where opened_by = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.support_tickets (gym_id, opened_by, subject, priority)
  values (p_gym_id, auth.uid(), left(trim(p_subject), 120), coalesce(p_priority, 'normal'))
  returning id into v_id;
  insert into public.support_ticket_messages (ticket_id, author_user_id, author_name, body)
  values (v_id, auth.uid(), coalesce((select full_name from public.profiles where user_id = auth.uid()), ''), left(trim(p_body), 2000));
  return v_id;
end;
$$;

create or replace function public.reply_support_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.support_tickets;
  v_platform boolean := app_private.platform_role() is not null;
begin
  select * into v_t from public.support_tickets where id = p_ticket_id for update;
  if v_t.id is null or not (v_platform or app_private.has_gym_role(v_t.gym_id, '{owner,manager}')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  insert into public.support_ticket_messages (ticket_id, author_user_id, author_name, from_platform, body)
  values (p_ticket_id, auth.uid(), coalesce((select full_name from public.profiles where user_id = auth.uid()), ''),
    v_platform, left(trim(p_body), 2000));
  update public.support_tickets
  set last_message_at = now(),
      status = case when v_platform then 'answered' else 'open' end::public.ticket_status,
      closed_at = null
  where id = p_ticket_id;
end;
$$;

create or replace function public.set_ticket_status(p_ticket_id uuid, p_status public.ticket_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.support_tickets;
begin
  select * into v_t from public.support_tickets where id = p_ticket_id for update;
  -- The team can set any status; the gym can close its own ticket.
  if v_t.id is null or not (app_private.platform_role() is not null
     or (p_status = 'closed' and app_private.has_gym_role(v_t.gym_id, '{owner,manager}'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets
  set status = p_status, closed_at = case when p_status = 'closed' then now() end
  where id = p_ticket_id;
end;
$$;

-------------------------------------------------------------------------------
-- Platform team (super_admin / support)
-------------------------------------------------------------------------------
create policy "super admin reads team" on public.platform_admins for select to authenticated
  using (app_private.is_super_admin());

create or replace function public.admin_list_team()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_platform_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', pa.user_id, 'role', pa.role, 'email', u.email, 'full_name', coalesce(p.full_name, ''),
      'last_sign_in_at', u.last_sign_in_at, 'created_at', pa.created_at) order by pa.created_at)
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    left join public.profiles p on p.user_id = pa.user_id), '[]'::jsonb);
end;
$$;

-- Adds an existing account (they sign up first) to the GymNode team.
create or replace function public.admin_add_team_member(p_email text, p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform app_private.require_platform_admin(true);
  select id into v_user from auth.users where lower(email) = lower(trim(coalesce(p_email, ''))) limit 1;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.platform_admins (user_id, role) values (v_user, p_role)
  on conflict (user_id) do update set role = excluded.role;
  perform app_private.audit(null, 'platform.team_member_added', 'user', v_user, null, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_remove_team_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_platform_admin(true);
  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self' using errcode = 'P0001';
  end if;
  delete from public.platform_admins where user_id = p_user_id;
  perform app_private.audit(null, 'platform.team_member_removed', 'user', p_user_id, null, null);
end;
$$;

-------------------------------------------------------------------------------
-- Read models for the admin screens
-------------------------------------------------------------------------------
create or replace function app_private.gym_member_count(p_gym_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.members m where m.gym_id = p_gym_id and m.deleted_at is null and m.status <> 'pending';
$$;
revoke all on function app_private.gym_member_count(uuid) from public, anon, authenticated;

create or replace function app_private.gym_last_login(p_gym_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(u.last_sign_in_at) from public.gym_users gu join auth.users u on u.id = gu.user_id where gu.gym_id = p_gym_id;
$$;
revoke all on function app_private.gym_last_login(uuid) from public, anon, authenticated;

-- SA-Dashboard.dc.html
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.dhaka_today();
  v_month date := date_trunc('month', public.dhaka_today())::date;
  v_result jsonb;
begin
  perform app_private.require_platform_admin();
  with g as (
    select gy.id, gy.name, gy.city, gy.created_at, gy.status as raw_status, gy.status_changed_at, gy.trial_ends_at,
      app_private.gym_effective_status(gy.id) as status, pl.name as plan_name, pl.code as plan_code,
      app_private.gym_monthly_price(gy.id) as monthly_price
    from public.gyms gy left join public.plans pl on pl.id = gy.plan_id
  ),
  paying as (select * from g where status in ('active', 'past_due') and raw_status <> 'trial'),
  churned as (select * from g where raw_status = 'cancelled' and status_changed_at >= v_month)
  select jsonb_build_object(
    'gyms', (select count(*) from g where status <> 'cancelled'),
    'new_this_month', (select count(*) from g where (created_at at time zone 'Asia/Dhaka')::date >= v_month),
    'mrr_paisa', (select coalesce(sum(monthly_price), 0) from paying),
    'mrr_unpriced', (select count(*) from paying where monthly_price is null),
    'trials', (select count(*) from g where raw_status = 'trial' and status = 'trial'),
    'trials_ending_week', (select count(*) from g where raw_status = 'trial' and trial_ends_at >= now() and trial_ends_at < now() + interval '7 days'),
    'overdue_invoices', (select count(*) from public.subscription_invoices where status = 'unpaid' and due_date < v_today),
    'overdue_paisa', (select coalesce(sum(amount_paisa), 0) from public.subscription_invoices where status = 'unpaid' and due_date < v_today),
    'overdue_week', (select count(*) from public.subscription_invoices where status = 'unpaid' and due_date < v_today - 7),
    'churn_month', (select count(*) from churned),
    'churn_base', (select count(*) from paying) + (select count(*) from churned),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name, 'count', x.n) order by x.sort_order), '[]'::jsonb)
      from (select pl.code, pl.name, pl.sort_order, (select count(*) from g where g.plan_code = pl.code and g.raw_status not in ('trial', 'cancelled')) as n
            from public.plans pl where pl.is_active) x),
    'mrr_history', (select jsonb_agg(jsonb_build_object('month', m.m,
        'billed', (select coalesce(sum(i.amount_paisa), 0) from public.subscription_invoices i
                   where i.status <> 'void' and date_trunc('month', coalesce(i.period_start, i.due_date))::date = m.m),
        'collected', (select coalesce(sum(i.amount_paisa), 0) from public.subscription_invoices i
                   where i.status = 'paid' and date_trunc('month', coalesce(i.period_start, i.due_date))::date = m.m)
      ) order by m.m)
      from (select (v_month - make_interval(months => s))::date as m from generate_series(0, 11) s) m),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select id, name, city, plan_name, status, trial_ends_at, created_at, app_private.gym_member_count(id) as members
        from g order by created_at desc limit 6) r),
    'open_tickets', (select count(*) from public.support_tickets where status = 'open'),
    'urgent_tickets', (select count(*) from public.support_tickets where status = 'open' and priority = 'urgent')
  ) into v_result;
  return v_result;
end;
$$;

-- SA-Gyms.dc.html: filters, search, counts per status tab.
create or replace function public.admin_list_gyms(
  p_status text default null,
  p_city text default null,
  p_q text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_result jsonb;
begin
  perform app_private.require_platform_admin();
  with g as (
    select gy.*, app_private.gym_effective_status(gy.id) as eff_status, pl.name as plan_name,
      coalesce(pr.full_name, '') as owner_name, u.email as owner_email
    from public.gyms gy
    left join public.plans pl on pl.id = gy.plan_id
    left join public.profiles pr on pr.user_id = gy.owner_user_id
    left join auth.users u on u.id = gy.owner_user_id
  ),
  filtered as (
    select * from g
    where (p_city is null or g.city = p_city)
      and (v_q is null or g.name ilike '%' || v_q || '%' or g.code_prefix ilike v_q or g.owner_name ilike '%' || v_q || '%'
           or g.owner_email ilike '%' || v_q || '%' or g.phone ilike '%' || v_q || '%')
  )
  select jsonb_build_object(
    'counts', (select jsonb_build_object(
        'all', count(*),
        'active', count(*) filter (where eff_status = 'active'),
        'trial', count(*) filter (where eff_status = 'trial'),
        'past_due', count(*) filter (where eff_status = 'past_due'),
        'suspended', count(*) filter (where eff_status in ('suspended', 'cancelled'))) from filtered),
    'cities', (select coalesce(jsonb_agg(distinct city order by city), '[]'::jsonb) from public.gyms where city <> ''),
    'total', (select count(*) from filtered where p_status is null or eff_status::text = p_status
               or (p_status = 'suspended' and eff_status = 'cancelled')),
    'rows', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select f.id, f.name, f.code_prefix, f.city, f.owner_name, f.owner_email, f.plan_name, f.eff_status as status,
          f.trial_ends_at, f.created_at, app_private.gym_member_count(f.id) as members,
          app_private.gym_monthly_price(f.id) as monthly_price, app_private.gym_last_login(f.id) as last_login
        from filtered f
        where p_status is null or f.eff_status::text = p_status or (p_status = 'suspended' and f.eff_status = 'cancelled')
        order by f.created_at desc
        limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
      ) r)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_gym_detail(p_gym_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app_private.require_platform_admin();
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'code_prefix', g.code_prefix, 'slug', g.slug, 'city', g.city, 'address', g.address,
    'phone', g.phone, 'raw_status', g.status, 'status', app_private.gym_effective_status(g.id),
    'trial_ends_at', g.trial_ends_at, 'created_at', g.created_at, 'onboarding_completed_at', g.onboarding_completed_at,
    'plan_id', g.plan_id, 'plan_name', pl.name, 'price_override_paisa', s.price_paisa,
    'monthly_price', app_private.gym_monthly_price(g.id), 'current_period_end', s.current_period_end,
    'owner', jsonb_build_object('name', coalesce(pr.full_name, ''), 'email', u.email, 'phone', pr.phone,
      'last_sign_in_at', u.last_sign_in_at),
    'members', app_private.gym_member_count(g.id),
    'branches', (select count(*) from public.branches b where b.gym_id = g.id and b.is_active),
    'staff', (select count(*) from public.gym_users gu where gu.gym_id = g.id and gu.is_active),
    'last_login', app_private.gym_last_login(g.id),
    'payments_month_paisa', (select coalesce(sum(p.amount_paisa), 0) from public.payments p
      where p.gym_id = g.id and p.status <> 'cancelled'
        and (p.paid_at at time zone 'Asia/Dhaka')::date >= date_trunc('month', public.dhaka_today())::date),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'invoice_no', i.invoice_no,
        'amount_paisa', i.amount_paisa, 'due_date', i.due_date, 'status', i.status, 'method', i.method,
        'paid_at', i.paid_at, 'period_start', i.period_start,
        'overdue', i.status = 'unpaid' and i.due_date < public.dhaka_today()) order by i.due_date desc), '[]'::jsonb)
      from (select * from public.subscription_invoices where gym_id = g.id order by due_date desc limit 24) i),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status,
        'priority', t.priority, 'last_message_at', t.last_message_at) order by t.last_message_at desc), '[]'::jsonb)
      from (select * from public.support_tickets where gym_id = g.id order by last_message_at desc limit 10) t),
    'audit', (select coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'created_at', a.created_at,
        'actor_kind', a.actor_kind, 'reason', a.reason) order by a.created_at desc), '[]'::jsonb)
      from (select * from public.audit_logs where gym_id = g.id
              and (action like 'support.%' or action like 'billing.%' or action like 'gym.%')
            order by created_at desc limit 20) a)
  ) into v_result
  from public.gyms g
  left join public.plans pl on pl.id = g.plan_id
  left join public.gym_subscriptions s on s.gym_id = g.id
  left join public.profiles pr on pr.user_id = g.owner_user_id
  left join auth.users u on u.id = g.owner_user_id
  where g.id = p_gym_id;
  if v_result is null then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

-- SA-Ops.dc.html. Devices (M8) and message usage (M6) join this when those tables exist.
create or replace function public.admin_list_tickets(p_status text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_platform_admin();
  return jsonb_build_object(
    'counts', (select jsonb_build_object('open', count(*) filter (where status = 'open'),
        'answered', count(*) filter (where status = 'answered'), 'closed', count(*) filter (where status = 'closed'),
        'urgent', count(*) filter (where status = 'open' and priority = 'urgent')) from public.support_tickets),
    'rows', (select coalesce(jsonb_agg(r order by r.urgent_first, r.last_message_at desc), '[]'::jsonb) from (
        select t.id, t.subject, t.status, t.priority, t.last_message_at, t.created_at, g.id as gym_id, g.name as gym_name,
          (case when t.status = 'open' and t.priority = 'urgent' then 0 else 1 end) as urgent_first
        from public.support_tickets t join public.gyms g on g.id = t.gym_id
        where p_status is null or t.status::text = p_status
        order by urgent_first, t.last_message_at desc
        limit least(greatest(p_limit, 1), 200)) r)
  );
end;
$$;

-------------------------------------------------------------------------------
-- Grants
-------------------------------------------------------------------------------
revoke execute on function
  public.admin_update_setting(text, jsonb),
  public.gym_plan_usage(uuid),
  public.admin_create_invoice(uuid, bigint, date, date, text),
  public.admin_generate_invoices(date, integer),
  public.admin_mark_invoice_paid(uuid, public.billing_method, text, date),
  public.admin_void_invoice(uuid, text),
  public.admin_list_invoices(text, integer, integer),
  public.admin_set_gym_plan(uuid, uuid, bigint),
  public.admin_set_gym_status(uuid, public.gym_status, text),
  public.admin_extend_trial(uuid, integer),
  public.start_support_session(uuid, text, integer),
  public.end_support_session(uuid),
  public.open_support_ticket(uuid, text, text, public.ticket_priority),
  public.reply_support_ticket(uuid, text),
  public.set_ticket_status(uuid, public.ticket_status),
  public.admin_list_team(),
  public.admin_add_team_member(text, public.platform_role),
  public.admin_remove_team_member(uuid),
  public.admin_overview(),
  public.admin_list_gyms(text, text, text, integer, integer),
  public.admin_gym_detail(uuid),
  public.admin_list_tickets(text, integer)
from public, anon;
grant execute on function
  public.admin_update_setting(text, jsonb),
  public.gym_plan_usage(uuid),
  public.admin_create_invoice(uuid, bigint, date, date, text),
  public.admin_generate_invoices(date, integer),
  public.admin_mark_invoice_paid(uuid, public.billing_method, text, date),
  public.admin_void_invoice(uuid, text),
  public.admin_list_invoices(text, integer, integer),
  public.admin_set_gym_plan(uuid, uuid, bigint),
  public.admin_set_gym_status(uuid, public.gym_status, text),
  public.admin_extend_trial(uuid, integer),
  public.start_support_session(uuid, text, integer),
  public.end_support_session(uuid),
  public.open_support_ticket(uuid, text, text, public.ticket_priority),
  public.reply_support_ticket(uuid, text),
  public.set_ticket_status(uuid, public.ticket_status),
  public.admin_list_team(),
  public.admin_add_team_member(text, public.platform_role),
  public.admin_remove_team_member(uuid),
  public.admin_overview(),
  public.admin_list_gyms(text, text, text, integer, integer),
  public.admin_gym_detail(uuid),
  public.admin_list_tickets(text, integer)
to authenticated;
