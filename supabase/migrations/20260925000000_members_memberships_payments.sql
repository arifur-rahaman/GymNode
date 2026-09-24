-- M2: members, memberships, freezes, lockers, biometric enrollment flags and payments
-- (docs/PLAN.md §4.3–4.5). Payments moved here from M3 because joining = paying at reception.
-- Money-changing writes (memberships, payments) happen only through functions below.

-------------------------------------------------------------------------------
-- Types
-------------------------------------------------------------------------------
create type public.member_status as enum ('pending', 'active', 'inactive');
create type public.member_gender as enum ('male', 'female', 'other');
create type public.membership_status as enum ('active', 'frozen', 'cancelled');
create type public.payment_method as enum ('cash', 'bkash', 'nagad', 'rocket', 'card');
create type public.payment_status as enum ('pending_verification', 'completed', 'cancelled');
create type public.payment_kind as enum ('membership', 'due', 'sale', 'other');
create type public.biometric_method as enum ('face', 'fingerprint', 'rfid');

-------------------------------------------------------------------------------
-- Counters (member codes, invoice numbers). Row-locked, never repeats.
-------------------------------------------------------------------------------
create or replace function app_private.next_counter(p_gym_id uuid, p_kind text, p_year integer default 0)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.gym_counters as c (gym_id, kind, year, next_value)
  values (p_gym_id, p_kind, p_year, 2)
  on conflict (gym_id, kind, year) do update set next_value = c.next_value + 1
  returning c.next_value - 1;
$$;
revoke all on function app_private.next_counter(uuid, text, integer) from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Lockers
-------------------------------------------------------------------------------
create table public.lockers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, code)
);
alter table public.lockers enable row level security;
create trigger set_updated_at before update on public.lockers
  for each row execute function app_private.set_updated_at();

-------------------------------------------------------------------------------
-- Members
-------------------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  -- Assigned when the member becomes active (QR sign-ups get one on approval), e.g. PH-0142.
  member_code text,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null check (phone ~ '^\+8801[3-9][0-9]{8}$'),
  gender public.member_gender,
  dob date check (dob is null or dob between date '1920-01-01' and current_date),
  photo_path text,
  address text not null default '' check (char_length(address) <= 200),
  emergency_contact_name text not null default '' check (char_length(emergency_contact_name) <= 80),
  emergency_contact_phone text check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+8801[3-9][0-9]{8}$'),
  joined_at date not null default public.dhaka_today(),
  status public.member_status not null default 'active',
  source text not null default 'staff' check (source in ('staff', 'qr_self')),
  assigned_trainer_id uuid references public.gym_users (id) on delete set null,
  locker_id uuid references public.lockers (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 1000),
  deleted_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, member_code)
);
alter table public.members enable row level security;
create index members_gym_idx on public.members (gym_id, status, created_at desc) where deleted_at is null;
create index members_trainer_idx on public.members (assigned_trainer_id) where deleted_at is null;
create index members_name_trgm on public.members using gin (full_name extensions.gin_trgm_ops);
create index members_phone_trgm on public.members using gin (phone extensions.gin_trgm_ops);
create index members_code_trgm on public.members using gin (member_code extensions.gin_trgm_ops);
create trigger set_updated_at before update on public.members
  for each row execute function app_private.set_updated_at();

-- Member code when a member becomes active; only owner/manager may delete (soft) a member.
create or replace function app_private.members_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'pending' and new.member_code is null then
    new.member_code := (select code_prefix from public.gyms where id = new.gym_id)
      || '-' || lpad(app_private.next_counter(new.gym_id, 'member_code')::text, 4, '0');
  end if;
  if tg_op = 'UPDATE' then
    if new.gym_id <> old.gym_id then
      raise exception 'gym_id cannot change' using errcode = '42501';
    end if;
    if new.member_code is distinct from old.member_code and old.member_code is not null then
      raise exception 'member_code cannot change' using errcode = '42501';
    end if;
    if new.deleted_at is distinct from old.deleted_at
       and auth.uid() is not null
       and not app_private.has_gym_role(new.gym_id, '{owner,manager}') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      perform app_private.audit(new.gym_id, 'member.deleted', 'member', new.id, to_jsonb(old), null);
    end if;
  end if;
  return new;
end;
$$;

create trigger members_before_write before insert or update on public.members
  for each row execute function app_private.members_before_write();

-------------------------------------------------------------------------------
-- Memberships & freezes
-------------------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  package_id uuid not null references public.packages (id),
  start_date date not null,
  end_date date not null,
  -- Copied from the package at sale time so later price changes don't rewrite history.
  price_paisa bigint not null check (price_paisa >= 0),
  admission_fee_paisa bigint not null default 0 check (admission_fee_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  status public.membership_status not null default 'active',
  frozen_from date,
  frozen_until date,
  previous_membership_id uuid references public.memberships (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (discount_paisa <= price_paisa + admission_fee_paisa)
);
alter table public.memberships enable row level security;
create index memberships_member_idx on public.memberships (member_id, end_date desc) where status <> 'cancelled';
create index memberships_gym_end_idx on public.memberships (gym_id, end_date) where status <> 'cancelled';
create trigger set_updated_at before update on public.memberships
  for each row execute function app_private.set_updated_at();

create table public.membership_freezes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  days integer not null check (days > 0),
  reason text not null default '' check (char_length(reason) <= 300),
  ended_early_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
alter table public.membership_freezes enable row level security;
create index membership_freezes_membership_idx on public.membership_freezes (membership_id);

-------------------------------------------------------------------------------
-- Biometric enrollment flags (templates are NEVER stored here — PLAN.md §4.7)
-------------------------------------------------------------------------------
create table public.biometric_enrollments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  method public.biometric_method not null,
  -- The user id stored on the door device (M8). Null while marked by hand.
  device_user_id text,
  enrolled_at timestamptz not null default now(),
  unique (member_id, method)
);
alter table public.biometric_enrollments enable row level security;

-------------------------------------------------------------------------------
-- Payments (Payments page, verification and receipts arrive in M3)
-------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  member_id uuid references public.members (id),
  membership_id uuid references public.memberships (id),
  kind public.payment_kind not null default 'membership',
  amount_paisa bigint not null check (amount_paisa > 0),
  method public.payment_method not null,
  transaction_id text check (transaction_id is null or char_length(transaction_id) between 4 and 40),
  status public.payment_status not null,
  paid_at timestamptz not null default now(),
  received_by uuid default auth.uid(),
  verified_by uuid,
  verified_at timestamptz,
  invoice_no text not null,
  receipt_token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  receipt_sent_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (gym_id, invoice_no),
  check (method = 'cash' or method = 'card' or transaction_id is not null)
);
alter table public.payments enable row level security;
create index payments_gym_paid_idx on public.payments (gym_id, paid_at desc);
create index payments_member_idx on public.payments (member_id, paid_at desc);
-- The same bKash/Nagad/Rocket transaction can't be used twice in one gym.
create unique index payments_txn_unique on public.payments (gym_id, method, transaction_id)
  where transaction_id is not null and status <> 'cancelled';

-------------------------------------------------------------------------------
-- Access helpers
-------------------------------------------------------------------------------
create or replace function app_private.my_gym_user_id(p_gym_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.gym_users where gym_id = p_gym_id and user_id = auth.uid() and is_active;
$$;

-- Can the caller see a member row? Branch rules apply; trainers see only assigned members.
create or replace function app_private.can_see_member_row(p_gym_id uuid, p_branch_id uuid, p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.can_see_branch(p_gym_id, p_branch_id)
    and (
      app_private.in_support_session(p_gym_id)
      or app_private.gym_role(p_gym_id) <> 'trainer'
      or p_trainer_id = app_private.my_gym_user_id(p_gym_id)
    );
$$;

create or replace function app_private.can_see_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select app_private.can_see_member_row(m.gym_id, m.branch_id, m.assigned_trainer_id)
    from public.members m where m.id = p_member_id
  ), false);
$$;

revoke all on function
  app_private.my_gym_user_id(uuid),
  app_private.can_see_member_row(uuid, uuid, uuid),
  app_private.can_see_member(uuid)
from public, anon;
grant execute on function
  app_private.my_gym_user_id(uuid),
  app_private.can_see_member_row(uuid, uuid, uuid),
  app_private.can_see_member(uuid)
to authenticated;

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------
create policy "read lockers" on public.lockers for select to authenticated
  using (app_private.can_read_gym(gym_id));
create policy "owner manager write lockers" on public.lockers for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));
create policy "owner manager update lockers" on public.lockers for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager}'))
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));

create policy "read members" on public.members for select to authenticated
  using (app_private.can_see_member_row(gym_id, branch_id, assigned_trainer_id));
create policy "front desk adds members" on public.members for insert to authenticated
  with check (
    app_private.can_write_gym(gym_id, '{owner,manager,reception}')
    and app_private.can_see_branch(gym_id, branch_id)
    and source = 'staff'
  );
create policy "front desk edits members" on public.members for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager,reception}') and app_private.can_see_branch(gym_id, branch_id))
  with check (app_private.can_write_gym(gym_id, '{owner,manager,reception}') and app_private.can_see_branch(gym_id, branch_id));
-- Only unapproved QR sign-ups can be removed completely (they have no history yet).
create policy "front desk rejects pending sign-ups" on public.members for delete to authenticated
  using (status = 'pending' and app_private.can_write_gym(gym_id, '{owner,manager,reception}'));

create policy "read memberships" on public.memberships for select to authenticated
  using (app_private.can_read_gym(gym_id) and app_private.can_see_member(member_id));
create policy "read freezes" on public.membership_freezes for select to authenticated
  using (app_private.can_read_gym(gym_id)
    and app_private.can_see_member((select member_id from public.memberships ms where ms.id = membership_id)));

create policy "read enrollments" on public.biometric_enrollments for select to authenticated
  using (app_private.can_read_gym(gym_id) and app_private.can_see_member(member_id));
create policy "front desk marks enrollments" on public.biometric_enrollments for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager,reception}') and app_private.can_see_member(member_id));
create policy "front desk removes enrollments" on public.biometric_enrollments for delete to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager,reception}'));

create policy "front desk reads payments" on public.payments for select to authenticated
  using (
    (app_private.has_gym_role(gym_id, '{owner,manager,reception}') and app_private.can_see_branch(gym_id, branch_id))
    or app_private.in_support_session(gym_id)
  );

-- Money tables: no direct writes for app users at all.
revoke insert, update, delete, truncate on public.memberships, public.membership_freezes, public.payments from anon, authenticated;

-------------------------------------------------------------------------------
-- Member overview: one row per member with current membership, dues and badge.
-- security_invoker = the caller's RLS applies.
-------------------------------------------------------------------------------
create view public.member_overview with (security_invoker = true) as
select
  m.id,
  m.gym_id,
  m.branch_id,
  m.member_code,
  m.full_name,
  m.phone,
  m.gender,
  m.photo_path,
  m.status,
  m.source,
  m.joined_at,
  m.assigned_trainer_id,
  m.created_at,
  cm.id as membership_id,
  cm.package_id,
  p.name as package_name,
  cm.start_date,
  cm.end_date,
  case when cm.end_date is null then null else cm.end_date - public.dhaka_today() end as days_left,
  coalesce(cm.status = 'frozen' and public.dhaka_today() between cm.frozen_from and cm.frozen_until, false) as is_frozen,
  cm.frozen_until,
  greatest(coalesce(charges.total, 0) - coalesce(paid.total, 0), 0)::bigint as due_paisa,
  coalesce(paid.pending > 0, false) as has_pending_payment,
  exists (select 1 from public.biometric_enrollments b where b.member_id = m.id and b.method = 'face') as face_enrolled,
  exists (select 1 from public.biometric_enrollments b where b.member_id = m.id and b.method = 'fingerprint') as fingerprint_enrolled,
  -- List order: soonest expiry first, then the most recently expired, then members with no package.
  case
    when cm.end_date is null then 1000000
    when cm.end_date >= public.dhaka_today() then cm.end_date - public.dhaka_today()
    else 100000 + (public.dhaka_today() - cm.end_date)
  end as expiry_sort,
  case
    when cm.status = 'frozen' and public.dhaka_today() between cm.frozen_from and cm.frozen_until then 'frozen'
    when cm.end_date is null or cm.end_date < public.dhaka_today() then 'expired'
    when coalesce(charges.total, 0) - coalesce(paid.total, 0) > 0 then 'due'
    else 'active'
  end as display_status
from public.members m
left join lateral (
  select ms.* from public.memberships ms
  where ms.member_id = m.id and ms.status <> 'cancelled'
  order by ms.end_date desc, ms.created_at desc
  limit 1
) cm on true
left join public.packages p on p.id = cm.package_id
left join lateral (
  select sum(ms.price_paisa + ms.admission_fee_paisa - ms.discount_paisa) as total
  from public.memberships ms
  where ms.member_id = m.id and ms.status <> 'cancelled'
) charges on true
left join lateral (
  -- Pending bKash/Nagad/Rocket payments count as paid (founder decision Q4).
  select sum(pa.amount_paisa) as total,
         count(*) filter (where pa.status = 'pending_verification') as pending
  from public.payments pa
  where pa.member_id = m.id and pa.status <> 'cancelled' and pa.kind <> 'sale'
) paid on true
where m.deleted_at is null;

comment on view public.member_overview is 'One row per (non-deleted) member: current membership, dues and display status. RLS of the caller applies.';

-------------------------------------------------------------------------------
-- Functions
-------------------------------------------------------------------------------

-- Renew (or start) a membership and record the payment, in one transaction.
create or replace function public.record_payment_and_renew(
  p_member_id uuid,
  p_package_id uuid,
  p_amount_paisa bigint,
  p_discount_paisa bigint default 0,
  p_method public.payment_method default 'cash',
  p_transaction_id text default null,
  p_charge_admission boolean default null,
  p_start_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_package public.packages;
  v_current public.memberships;
  v_today date := public.dhaka_today();
  v_start date;
  v_end date;
  v_admission bigint;
  v_charges bigint;
  v_existing_due bigint;
  v_membership_id uuid;
  v_payment_id uuid;
  v_invoice text;
  v_txn text := nullif(trim(coalesce(p_transaction_id, '')), '');
  v_year int := extract(year from v_today)::int;
begin
  select * into v_member from public.members where id = p_member_id and deleted_at is null for update;
  if v_member.id is null
     or not app_private.can_write_gym(v_member.gym_id, '{owner,manager,reception}')
     or not app_private.can_see_branch(v_member.gym_id, v_member.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.status = 'pending' then
    raise exception 'member_not_approved' using errcode = 'P0001';
  end if;

  select * into v_package from public.packages
  where id = p_package_id and gym_id = v_member.gym_id and deleted_at is null and is_active;
  if v_package.id is null then
    raise exception 'invalid_package' using errcode = '22023';
  end if;

  select * into v_current from public.memberships
  where member_id = p_member_id and status <> 'cancelled'
  order by end_date desc, created_at desc limit 1;

  -- Still active → continue from the day after the current end; expired → start today.
  v_start := coalesce(p_start_date,
    case when v_current.end_date is not null and v_current.end_date >= v_today then v_current.end_date + 1 else v_today end);
  v_end := v_start + v_package.duration_days - 1;

  v_admission := case
    when coalesce(p_charge_admission, v_current.id is null) then v_package.admission_fee_paisa
    else 0 end;

  if p_discount_paisa < 0 or p_discount_paisa > v_package.price_paisa + v_admission then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  v_charges := v_package.price_paisa + v_admission - p_discount_paisa;

  select coalesce(due_paisa, 0) into v_existing_due from public.member_overview where id = p_member_id;
  if p_amount_paisa < 0 or p_amount_paisa > v_charges + coalesce(v_existing_due, 0) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_amount_paisa > 0 and p_method not in ('cash', 'card') and v_txn is null then
    raise exception 'transaction_id_required' using errcode = '22023';
  end if;

  insert into public.memberships (gym_id, member_id, package_id, start_date, end_date, price_paisa,
    admission_fee_paisa, discount_paisa, previous_membership_id)
  values (v_member.gym_id, p_member_id, p_package_id, v_start, v_end, v_package.price_paisa,
    v_admission, p_discount_paisa, v_current.id)
  returning id into v_membership_id;

  perform app_private.audit(v_member.gym_id, 'membership.created', 'membership', v_membership_id, null,
    jsonb_build_object('member_id', p_member_id, 'package_id', p_package_id, 'start_date', v_start, 'end_date', v_end,
      'price_paisa', v_package.price_paisa, 'admission_fee_paisa', v_admission, 'discount_paisa', p_discount_paisa));

  if p_amount_paisa > 0 then
    v_invoice := 'INV-' || v_year || '-' || lpad(app_private.next_counter(v_member.gym_id, 'invoice', v_year)::text, 5, '0');
    begin
      insert into public.payments (gym_id, branch_id, member_id, membership_id, kind, amount_paisa, method,
        transaction_id, status, invoice_no)
      values (v_member.gym_id, v_member.branch_id, p_member_id, v_membership_id, 'membership', p_amount_paisa, p_method,
        v_txn,
        case when p_method in ('cash', 'card') then 'completed' else 'pending_verification' end::public.payment_status,
        v_invoice)
      returning id into v_payment_id;
    exception when unique_violation then
      raise exception 'duplicate_transaction_id' using errcode = '23505';
    end;
    perform app_private.audit(v_member.gym_id, 'payment.created', 'payment', v_payment_id, null,
      jsonb_build_object('amount_paisa', p_amount_paisa, 'method', p_method, 'transaction_id', v_txn, 'invoice_no', v_invoice));
  end if;

  return jsonb_build_object(
    'membership_id', v_membership_id,
    'payment_id', v_payment_id,
    'start_date', v_start,
    'end_date', v_end,
    'charges_paisa', v_charges,
    'invoice_no', v_invoice
  );
end;
$$;

-- Freeze: pauses the membership and pushes the end date out by the frozen days.
create or replace function public.freeze_membership(
  p_membership_id uuid,
  p_from date,
  p_until date,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ms public.memberships;
  v_days int;
begin
  select * into v_ms from public.memberships where id = p_membership_id for update;
  if v_ms.id is null
     or not app_private.can_write_gym(v_ms.gym_id, '{owner,manager,reception}')
     or not app_private.can_see_member(v_ms.member_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_ms.status <> 'active' then
    raise exception 'not_freezable' using errcode = 'P0001';
  end if;
  if p_from < public.dhaka_today() or p_until < p_from or p_from > v_ms.end_date then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  v_days := p_until - p_from + 1;
  if v_days > 180 then
    raise exception 'freeze_too_long' using errcode = '22023';
  end if;

  update public.memberships
  set status = 'frozen', frozen_from = p_from, frozen_until = p_until, end_date = end_date + v_days
  where id = p_membership_id;

  insert into public.membership_freezes (gym_id, membership_id, from_date, to_date, days, reason)
  values (v_ms.gym_id, p_membership_id, p_from, p_until, v_days, left(coalesce(p_reason, ''), 300));

  perform app_private.audit(v_ms.gym_id, 'membership.frozen', 'membership', p_membership_id,
    jsonb_build_object('end_date', v_ms.end_date),
    jsonb_build_object('end_date', v_ms.end_date + v_days, 'from', p_from, 'until', p_until, 'reason', p_reason));
end;
$$;

-- Unfreeze early: gives back only the days actually frozen.
create or replace function public.unfreeze_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ms public.memberships;
  v_today date := public.dhaka_today();
  v_unused int := 0;
begin
  select * into v_ms from public.memberships where id = p_membership_id for update;
  if v_ms.id is null
     or not app_private.can_write_gym(v_ms.gym_id, '{owner,manager,reception}')
     or not app_private.can_see_member(v_ms.member_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_ms.status <> 'frozen' then
    raise exception 'not_frozen' using errcode = 'P0001';
  end if;

  if v_today <= v_ms.frozen_until then
    -- Unused frozen days (from today, or the whole freeze if it hasn't started) are removed again.
    v_unused := v_ms.frozen_until - greatest(v_today, v_ms.frozen_from) + 1;
  end if;

  update public.memberships
  set status = 'active', frozen_from = null, frozen_until = null, end_date = end_date - v_unused
  where id = p_membership_id;

  update public.membership_freezes
  set ended_early_on = case when v_unused > 0 then v_today else null end
  where membership_id = p_membership_id and ended_early_on is null
    and from_date = v_ms.frozen_from and to_date = v_ms.frozen_until;

  perform app_private.audit(v_ms.gym_id, 'membership.unfrozen', 'membership', p_membership_id,
    jsonb_build_object('end_date', v_ms.end_date), jsonb_build_object('end_date', v_ms.end_date - v_unused));
end;
$$;

-- Public QR sign-up (no login). Creates a *pending* member for staff to approve.
create or replace function public.submit_self_registration(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_gender public.member_gender default null,
  p_dob date default null,
  p_address text default '',
  p_emergency_name text default '',
  p_emergency_phone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_branch uuid;
begin
  select * into v_gym from public.gyms where slug = lower(trim(p_slug));
  if v_gym.id is null or v_gym.status in ('suspended', 'cancelled') then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  -- Basic spam protection: a limited number of new sign-ups per gym per hour.
  if (select count(*) from public.members
      where gym_id = v_gym.id and source = 'qr_self' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.members where gym_id = v_gym.id and phone = p_phone and deleted_at is null) then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;

  select id into v_branch from public.branches where gym_id = v_gym.id and is_active order by created_at limit 1;

  insert into public.members (gym_id, branch_id, full_name, phone, gender, dob, address,
    emergency_contact_name, emergency_contact_phone, status, source, created_by)
  values (v_gym.id, v_branch, trim(p_full_name), p_phone, p_gender, p_dob, trim(coalesce(p_address, '')),
    trim(coalesce(p_emergency_name, '')), nullif(trim(coalesce(p_emergency_phone, '')), ''), 'pending', 'qr_self', null);
end;
$$;

-- What the public sign-up page may show about a gym.
create or replace function public.get_join_gym(p_slug text)
returns table (name text, logo_path text, city text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, g.logo_path, g.city from public.gyms g
  where g.slug = lower(trim(p_slug)) and g.status not in ('suspended', 'cancelled');
$$;

revoke execute on function
  public.record_payment_and_renew(uuid, uuid, bigint, bigint, public.payment_method, text, boolean, date),
  public.freeze_membership(uuid, date, date, text),
  public.unfreeze_membership(uuid),
  public.submit_self_registration(text, text, text, public.member_gender, date, text, text, text),
  public.get_join_gym(text)
from public;
grant execute on function
  public.record_payment_and_renew(uuid, uuid, bigint, bigint, public.payment_method, text, boolean, date),
  public.freeze_membership(uuid, date, date, text),
  public.unfreeze_membership(uuid)
to authenticated;
grant execute on function
  public.submit_self_registration(text, text, text, public.member_gender, date, text, text, text),
  public.get_join_gym(text)
to anon, authenticated;

-------------------------------------------------------------------------------
-- Storage: member photos (PRIVATE; shown through short-lived signed URLs)
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function app_private.is_gym_staff_folder(p_folder text, p_roles public.gym_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_users gu
    where gu.gym_id::text = p_folder and gu.user_id = auth.uid() and gu.is_active and gu.role = any (p_roles)
  );
$$;
revoke all on function app_private.is_gym_staff_folder(text, public.gym_role[]) from public, anon;
grant execute on function app_private.is_gym_staff_folder(text, public.gym_role[]) to authenticated;

create policy "staff read member photos" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos'
    and app_private.is_gym_staff_folder((storage.foldername(name))[1], '{owner,manager,reception,trainer}'));
create policy "front desk uploads member photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos'
    and app_private.is_gym_staff_folder((storage.foldername(name))[1], '{owner,manager,reception}'));
create policy "front desk deletes member photos" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos'
    and app_private.is_gym_staff_folder((storage.foldername(name))[1], '{owner,manager,reception}'));

-------------------------------------------------------------------------------
-- New member + first membership + first payment, all or nothing.
-------------------------------------------------------------------------------
create or replace function public.register_member(
  p_gym_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_phone text,
  p_gender public.member_gender default null,
  p_dob date default null,
  p_address text default '',
  p_emergency_name text default '',
  p_emergency_phone text default null,
  p_trainer_id uuid default null,
  p_notes text default '',
  p_package_id uuid default null,
  p_amount_paisa bigint default 0,
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
  v_member public.members;
  v_result jsonb := '{}'::jsonb;
begin
  if not app_private.can_write_gym(p_gym_id, '{owner,manager,reception}')
     or not app_private.can_see_branch(p_gym_id, p_branch_id)
     or not exists (select 1 from public.branches where id = p_branch_id and gym_id = p_gym_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_trainer_id is not null and not exists (
    select 1 from public.gym_users where id = p_trainer_id and gym_id = p_gym_id and role = 'trainer' and is_active
  ) then
    raise exception 'invalid_trainer' using errcode = '22023';
  end if;

  insert into public.members (gym_id, branch_id, full_name, phone, gender, dob, address,
    emergency_contact_name, emergency_contact_phone, assigned_trainer_id, notes)
  values (p_gym_id, p_branch_id, trim(p_full_name), p_phone, p_gender, p_dob, trim(coalesce(p_address, '')),
    trim(coalesce(p_emergency_name, '')), p_emergency_phone, p_trainer_id, trim(coalesce(p_notes, '')))
  returning * into v_member;

  perform app_private.audit(p_gym_id, 'member.created', 'member', v_member.id, null,
    jsonb_build_object('member_code', v_member.member_code, 'full_name', v_member.full_name));

  if p_package_id is not null then
    v_result := public.record_payment_and_renew(v_member.id, p_package_id, p_amount_paisa, p_discount_paisa,
      p_method, p_transaction_id, true, null);
  end if;

  return v_result || jsonb_build_object('member_id', v_member.id, 'member_code', v_member.member_code);
end;
$$;

-- Counts for the member list tabs (সব / সক্রিয় / বকেয়া / মেয়াদ শেষ / ফ্রিজ / অনুমোদন বাকি).
create or replace function public.member_status_counts(p_gym_id uuid)
returns table (status text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select case when mo.status = 'pending' then 'pending' else mo.display_status end, count(*)
  from public.member_overview mo
  where mo.gym_id = p_gym_id
  group by 1;
$$;

revoke execute on function
  public.register_member(uuid, uuid, text, text, public.member_gender, date, text, text, text, uuid, text, uuid, bigint, bigint, public.payment_method, text),
  public.member_status_counts(uuid)
from public, anon;
grant execute on function
  public.register_member(uuid, uuid, text, text, public.member_gender, date, text, text, text, uuid, text, uuid, bigint, bigint, public.payment_method, text),
  public.member_status_counts(uuid)
to authenticated;
