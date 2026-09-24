-- M1: platform + tenancy core (docs/PLAN.md §4.2, §4.6).
-- Every table enables RLS in this migration. Business rules that must not be bypassed
-- live in security-definer functions with explicit role checks and audit logging.

-------------------------------------------------------------------------------
-- Types
-------------------------------------------------------------------------------
create type public.gym_role as enum ('owner', 'manager', 'reception', 'trainer');
create type public.platform_role as enum ('super_admin', 'support');
create type public.gym_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type public.invoice_status as enum ('unpaid', 'paid', 'void');
create type public.billing_method as enum ('cash', 'bkash', 'nagad', 'rocket', 'card', 'bank');

-- Helpers in app_private must be callable from RLS policies (which run as the caller),
-- but app_private is not exposed through the Data API, so clients cannot call them directly.
grant usage on schema app_private to authenticated;

-------------------------------------------------------------------------------
-- Platform settings & plans
-------------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
comment on table public.platform_settings is 'Platform-wide settings (trial length etc). Editable by super admins (M7).';

insert into public.platform_settings (key, value) values
  ('trial_days', '14'),
  ('past_due_grace_days', '7');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_en text not null,
  -- Null = price not decided yet (the designs show "[দাম]").
  price_paisa bigint check (price_paisa is null or price_paisa >= 0),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  max_members integer check (max_members is null or max_members > 0),
  max_branches integer check (max_branches is null or max_branches > 0),
  max_devices integer check (max_devices is null or max_devices >= 0),
  sms_quota integer,
  whatsapp_quota integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create trigger set_updated_at before update on public.plans
  for each row execute function app_private.set_updated_at();

-- Limits from SA-Billing.dc.html. Prices stay null until the founder decides them.
insert into public.plans (code, name, name_en, max_members, max_branches, max_devices, features, sort_order) values
  ('starter', 'স্টার্টার', 'Starter', 150, 1, 1, '{"sms_reminders": true, "basic_reports": true}', 1),
  ('growth', 'গ্রোথ', 'Growth', 500, 2, 4, '{"sms_reminders": true, "basic_reports": true, "whatsapp_automation": true, "member_app": true, "website": true}', 2),
  ('pro', 'প্রো', 'Pro', null, null, null, '{"sms_reminders": true, "basic_reports": true, "whatsapp_automation": true, "member_app": true, "website": true, "branded_app": true, "ai_diet": true, "priority_support": true}', 3);

-------------------------------------------------------------------------------
-- People
-------------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  -- E.164 (+8801XXXXXXXXX). Staff log in with this (see app_private.staff_login_email).
  phone text unique check (phone is null or phone ~ '^\+8801[3-9][0-9]{8}$'),
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  last_gym_id uuid,
  -- Set when an owner creates or resets a staff password; cleared after the user sets their own.
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger set_updated_at before update on public.profiles
  for each row execute function app_private.set_updated_at();

-- Create a profile for every new auth user.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

-------------------------------------------------------------------------------
-- Gyms, branches, staff
-------------------------------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  -- Used in the public QR sign-up link (/join/<slug>).
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  -- Prefix for member codes, e.g. PH → PH-0142.
  code_prefix text not null check (code_prefix ~ '^[A-Z]{2,4}$'),
  owner_user_id uuid not null references auth.users (id),
  city text not null default '' check (char_length(city) <= 60),
  address text not null default '' check (char_length(address) <= 200),
  phone text check (phone is null or phone ~ '^\+8801[3-9][0-9]{8}$'),
  logo_path text,
  status public.gym_status not null default 'trial',
  trial_ends_at timestamptz,
  plan_id uuid references public.plans (id),
  settings jsonb not null default '{}'::jsonb,
  timezone text not null default 'Asia/Dhaka',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gyms enable row level security;
create index gyms_owner_idx on public.gyms (owner_user_id);
create trigger set_updated_at before update on public.gyms
  for each row execute function app_private.set_updated_at();

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  address text not null default '' check (char_length(address) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.branches enable row level security;
create index branches_gym_idx on public.branches (gym_id);
create trigger set_updated_at before update on public.branches
  for each row execute function app_private.set_updated_at();

create table public.gym_users (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.gym_role not null,
  -- Null = all branches.
  branch_ids uuid[],
  display_name text not null default '' check (char_length(display_name) <= 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id)
);
alter table public.gym_users enable row level security;
create index gym_users_user_idx on public.gym_users (user_id) where is_active;
create trigger set_updated_at before update on public.gym_users
  for each row execute function app_private.set_updated_at();

-- Safe, row-locked sequence numbers per gym (member codes, invoice numbers...).
create table public.gym_counters (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  kind text not null,
  year integer not null default 0,
  next_value bigint not null default 1,
  primary key (gym_id, kind, year)
);
alter table public.gym_counters enable row level security;

-------------------------------------------------------------------------------
-- SaaS billing for gyms (screens in M7)
-------------------------------------------------------------------------------
create table public.gym_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null unique references public.gyms (id) on delete cascade,
  plan_id uuid references public.plans (id),
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  price_paisa bigint check (price_paisa is null or price_paisa >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gym_subscriptions enable row level security;
create trigger set_updated_at before update on public.gym_subscriptions
  for each row execute function app_private.set_updated_at();

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  subscription_id uuid references public.gym_subscriptions (id),
  invoice_no text not null unique,
  amount_paisa bigint not null check (amount_paisa >= 0),
  due_date date not null,
  status public.invoice_status not null default 'unpaid',
  paid_at timestamptz,
  method public.billing_method,
  transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscription_invoices enable row level security;
create index subscription_invoices_gym_idx on public.subscription_invoices (gym_id, due_date desc);
create trigger set_updated_at before update on public.subscription_invoices
  for each row execute function app_private.set_updated_at();

-------------------------------------------------------------------------------
-- Support mode & audit
-------------------------------------------------------------------------------
create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  check (expires_at > started_at and expires_at <= started_at + interval '2 hours')
);
alter table public.support_sessions enable row level security;
create index support_sessions_active_idx on public.support_sessions (admin_user_id, gym_id, expires_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  gym_id uuid references public.gyms (id) on delete set null,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('staff', 'platform_admin', 'system', 'device')),
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index audit_logs_gym_idx on public.audit_logs (gym_id, created_at desc);

-- Append-only: nobody (not even the table owner via the API roles) may change history.
revoke update, delete, truncate on public.audit_logs from anon, authenticated, service_role;

create or replace function app_private.audit(
  p_gym_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (gym_id, actor_user_id, actor_kind, action, entity_type, entity_id, before, after, reason)
  values (
    p_gym_id,
    auth.uid(),
    case
      when auth.uid() is null then 'system'
      when exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
        and not exists (select 1 from public.gym_users gu where gu.user_id = auth.uid() and gu.gym_id = p_gym_id)
        then 'platform_admin'
      else 'staff'
    end,
    p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason
  );
end;
$$;

-------------------------------------------------------------------------------
-- Packages (created during onboarding; full CRUD screens in M2)
-------------------------------------------------------------------------------
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  name_en text check (name_en is null or char_length(name_en) <= 60),
  duration_days integer not null check (duration_days between 1 and 3660),
  price_paisa bigint not null check (price_paisa >= 0),
  admission_fee_paisa bigint not null default 0 check (admission_fee_paisa >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.packages enable row level security;
create index packages_gym_idx on public.packages (gym_id, sort_order) where deleted_at is null;
create trigger set_updated_at before update on public.packages
  for each row execute function app_private.set_updated_at();

-------------------------------------------------------------------------------
-- Access helpers used by RLS (fast: stable + security definer, indexed lookups)
-------------------------------------------------------------------------------
create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function app_private.gym_role(p_gym_id uuid)
returns public.gym_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.gym_users
  where gym_id = p_gym_id and user_id = auth.uid() and is_active;
$$;

create or replace function app_private.has_gym_role(p_gym_id uuid, p_roles public.gym_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.gym_role(p_gym_id) = any (p_roles), false);
$$;

create or replace function app_private.in_support_session(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.support_sessions s
    join public.platform_admins pa on pa.user_id = s.admin_user_id
    where s.admin_user_id = auth.uid()
      and s.gym_id = p_gym_id
      and s.ended_at is null
      and now() < s.expires_at
  );
$$;

-- Read access: any active staff role, or a platform admin in an active support session (read-only).
create or replace function app_private.can_read_gym(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.gym_role(p_gym_id) is not null or app_private.in_support_session(p_gym_id);
$$;

create or replace function app_private.can_see_branch(p_gym_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.in_support_session(p_gym_id) or exists (
    select 1 from public.gym_users
    where gym_id = p_gym_id and user_id = auth.uid() and is_active
      and (branch_ids is null or p_branch_id = any (branch_ids))
  );
$$;

-- Effective subscription state, including trial expiry (Q3): trial → past_due for
-- `past_due_grace_days` → suspended (read-only). A scheduled job will persist it (M7).
create or replace function public.gym_access_state(p_gym_id uuid)
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
    else g.status
  end
  from public.gyms g
  where g.id = p_gym_id
    and app_private.can_read_gym(p_gym_id);
$$;
comment on function public.gym_access_state(uuid) is 'Effective gym status (trial expiry applied). Returns null if the caller cannot read the gym.';

create or replace function app_private.gym_is_writable(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.gym_access_state(p_gym_id) not in ('suspended', 'cancelled'), false);
$$;

-- Write access = role check + gym not read-only + never in support mode.
create or replace function app_private.can_write_gym(p_gym_id uuid, p_roles public.gym_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_gym_role(p_gym_id, p_roles) and app_private.gym_is_writable(p_gym_id);
$$;

-- Two users share a gym (lets staff see each other's names).
create or replace function app_private.shares_gym_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_users me
    join public.gym_users them on them.gym_id = me.gym_id
    where me.user_id = auth.uid() and me.is_active and them.user_id = p_user_id
  );
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on function
  app_private.is_platform_admin(),
  app_private.gym_role(uuid),
  app_private.has_gym_role(uuid, public.gym_role[]),
  app_private.in_support_session(uuid),
  app_private.can_read_gym(uuid),
  app_private.can_see_branch(uuid, uuid),
  app_private.gym_is_writable(uuid),
  app_private.can_write_gym(uuid, public.gym_role[]),
  app_private.shares_gym_with(uuid)
to authenticated;
revoke execute on function public.gym_access_state(uuid) from public, anon;
grant execute on function public.gym_access_state(uuid) to authenticated;

-------------------------------------------------------------------------------
-- RLS policies
-------------------------------------------------------------------------------
-- platform_settings / plans: readable by logged-in users; written only by super-admin functions (M7).
create policy "read settings" on public.platform_settings for select to authenticated using (true);
create policy "read active plans" on public.plans for select to authenticated
  using (is_active or (select app_private.is_platform_admin()));

-- profiles: own row, plus names of people you work with.
create policy "read own or colleague profile" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or app_private.shares_gym_with(user_id));
create policy "update own profile" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Only these columns may be changed by the user (phone and the password flag are managed by functions).
revoke update on public.profiles from authenticated;
grant update (full_name, locale, theme, last_gym_id) on public.profiles to authenticated;

-- platform_admins: you can see only whether you yourself are one.
create policy "read own admin row" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- gyms: staff (or support mode) read; the owner edits profile fields while the gym is writable.
create policy "read gym" on public.gyms for select to authenticated
  using (app_private.can_read_gym(id));
create policy "owner updates gym" on public.gyms for update to authenticated
  using (app_private.can_write_gym(id, '{owner}'))
  with check (app_private.can_write_gym(id, '{owner}'));
revoke update on public.gyms from authenticated;
grant update (name, city, address, phone, logo_path, settings, onboarding_completed_at) on public.gyms to authenticated;

-- branches
create policy "read branch" on public.branches for select to authenticated
  using (app_private.can_see_branch(gym_id, id));
create policy "owner inserts branch" on public.branches for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner}'));
create policy "owner updates branch" on public.branches for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner}'))
  with check (app_private.can_write_gym(gym_id, '{owner}'));

-- gym_users: colleagues are visible; changes only through functions below.
create policy "read colleagues" on public.gym_users for select to authenticated
  using (app_private.can_read_gym(gym_id));

-- gym_counters: no direct access at all.

-- subscriptions & invoices: the owner sees their own gym's billing.
create policy "owner reads subscription" on public.gym_subscriptions for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner}') or app_private.in_support_session(gym_id));
create policy "owner reads invoices" on public.subscription_invoices for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner}') or app_private.in_support_session(gym_id));

-- support_sessions: an admin sees their own sessions (created by functions in M7).
create policy "admin reads own sessions" on public.support_sessions for select to authenticated
  using (admin_user_id = (select auth.uid()));

-- audit_logs: owner & manager read their gym's log.
create policy "owner manager read audit" on public.audit_logs for select to authenticated
  using (app_private.has_gym_role(gym_id, '{owner,manager}') or app_private.in_support_session(gym_id));

-- packages: every staff role reads; owner/manager change (price changes are audited).
create policy "read packages" on public.packages for select to authenticated
  using (app_private.can_read_gym(gym_id));
create policy "owner manager insert packages" on public.packages for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));
create policy "owner manager update packages" on public.packages for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager}'))
  with check (app_private.can_write_gym(gym_id, '{owner,manager}'));
revoke delete on public.packages from authenticated;

create or replace function app_private.audit_package_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app_private.audit(new.gym_id, 'package.created', 'package', new.id, null, to_jsonb(new));
  elsif new.price_paisa is distinct from old.price_paisa
     or new.admission_fee_paisa is distinct from old.admission_fee_paisa
     or new.duration_days is distinct from old.duration_days then
    perform app_private.audit(new.gym_id, 'package.price_changed', 'package', new.id,
      jsonb_build_object('price_paisa', old.price_paisa, 'admission_fee_paisa', old.admission_fee_paisa, 'duration_days', old.duration_days),
      jsonb_build_object('price_paisa', new.price_paisa, 'admission_fee_paisa', new.admission_fee_paisa, 'duration_days', new.duration_days));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform app_private.audit(new.gym_id, 'package.deleted', 'package', new.id, to_jsonb(old), null);
  end if;
  return new;
end;
$$;

create trigger audit_package_change after insert or update on public.packages
  for each row execute function app_private.audit_package_change();

-------------------------------------------------------------------------------
-- Functions called by the app
-------------------------------------------------------------------------------

-- Onboarding step 1: gym + first branch + owner membership + trial, in one transaction.
create or replace function public.create_gym_with_owner(
  p_name text,
  p_code_prefix text,
  p_city text,
  p_phone text,
  p_address text,
  p_branch_name text,
  p_branch_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_gym uuid;
  v_branch uuid;
  v_slug text;
  v_trial_days int;
  v_prefix text := upper(trim(p_code_prefix));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.gyms where owner_user_id = v_user) >= 5 then
    raise exception 'too_many_gyms' using errcode = 'P0001';
  end if;

  select coalesce((value #>> '{}')::int, 14) into v_trial_days
  from public.platform_settings where key = 'trial_days';

  -- Slug from the prefix + random suffix; gym names are often Bangla, which can't be slugged.
  loop
    v_slug := lower(v_prefix) || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
    exit when not exists (select 1 from public.gyms where slug = v_slug);
  end loop;

  insert into public.gyms (name, slug, code_prefix, owner_user_id, city, address, phone, status, trial_ends_at)
  values (trim(p_name), v_slug, v_prefix, v_user, trim(coalesce(p_city, '')), trim(coalesce(p_address, '')),
          nullif(trim(coalesce(p_phone, '')), ''), 'trial', now() + make_interval(days => coalesce(v_trial_days, 14)))
  returning id into v_gym;

  insert into public.branches (gym_id, name, address)
  values (v_gym, trim(p_branch_name), trim(coalesce(p_branch_address, '')))
  returning id into v_branch;

  insert into public.gym_users (gym_id, user_id, role, display_name)
  values (v_gym, v_user, 'owner', coalesce((select full_name from public.profiles where user_id = v_user), ''));

  insert into public.gym_subscriptions (gym_id, status, current_period_start, current_period_end)
  select v_gym, 'trialing', now(), g.trial_ends_at from public.gyms g where g.id = v_gym;

  update public.profiles set last_gym_id = v_gym where user_id = v_user;

  perform app_private.audit(v_gym, 'gym.created', 'gym', v_gym, null,
    jsonb_build_object('name', trim(p_name), 'branch_id', v_branch));
  return v_gym;
end;
$$;

-- Can the caller create a staff account with this role? Owner: manager/reception/trainer.
-- Manager: reception/trainer. Checked before the server creates the login.
create or replace function public.can_manage_staff_role(p_gym_id uuid, p_role public.gym_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.gym_is_writable(p_gym_id) and case app_private.gym_role(p_gym_id)
    when 'owner' then p_role in ('manager', 'reception', 'trainer')
    when 'manager' then p_role in ('reception', 'trainer')
    else false
  end;
$$;

-- Links a login (created by the server for this gym) to the gym as staff.
create or replace function public.add_gym_user(
  p_gym_id uuid,
  p_user_id uuid,
  p_role public.gym_role,
  p_display_name text,
  p_phone text,
  p_branch_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.can_manage_staff_role(p_gym_id, p_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Only logins created specifically for this gym can be attached (stops adding strangers).
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.raw_app_meta_data ->> 'created_for_gym' = p_gym_id::text
  ) then
    raise exception 'user_not_created_for_gym' using errcode = '42501';
  end if;
  if p_branch_ids is not null and exists (
    select 1 from unnest(p_branch_ids) b
    where not exists (select 1 from public.branches br where br.id = b and br.gym_id = p_gym_id)
  ) then
    raise exception 'invalid_branch' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = trim(p_display_name), phone = p_phone, must_change_password = true, last_gym_id = p_gym_id
  where user_id = p_user_id;

  insert into public.gym_users (gym_id, user_id, role, display_name, branch_ids)
  values (p_gym_id, p_user_id, p_role, trim(p_display_name), p_branch_ids)
  returning id into v_id;

  perform app_private.audit(p_gym_id, 'staff.added', 'gym_user', v_id, null,
    jsonb_build_object('role', p_role, 'display_name', trim(p_display_name), 'branch_ids', p_branch_ids));
  return v_id;
end;
$$;

-- Activate/deactivate a staff member (deactivated staff lose all access immediately).
create or replace function public.set_gym_user_active(p_gym_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.gym_users;
begin
  select * into v_row from public.gym_users where id = p_gym_user_id;
  if v_row.id is null or v_row.role = 'owner' or not public.can_manage_staff_role(v_row.gym_id, v_row.role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.gym_users set is_active = p_active where id = p_gym_user_id;
  perform app_private.audit(v_row.gym_id, case when p_active then 'staff.activated' else 'staff.deactivated' end,
    'gym_user', p_gym_user_id, jsonb_build_object('is_active', v_row.is_active), jsonb_build_object('is_active', p_active));
end;
$$;

-- Returns the login user id of a staff member the caller may manage (used before a password reset).
create or replace function public.staff_user_for_reset(p_gym_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.gym_users;
begin
  select * into v_row from public.gym_users where id = p_gym_user_id;
  if v_row.id is null or v_row.role = 'owner' or not public.can_manage_staff_role(v_row.gym_id, v_row.role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_row.user_id;
end;
$$;

-- Records that the server reset a staff password (forces a change at next login) + audit.
create or replace function public.mark_staff_password_reset(p_gym_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.staff_user_for_reset(p_gym_user_id);
begin
  update public.profiles set must_change_password = true where user_id = v_user;
  perform app_private.audit((select gym_id from public.gym_users where id = p_gym_user_id),
    'staff.password_reset', 'gym_user', p_gym_user_id);
end;
$$;

-- Called after the user has successfully set their own password.
create or replace function public.clear_password_change_flag()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where user_id = auth.uid();
$$;

revoke execute on function
  public.create_gym_with_owner(text, text, text, text, text, text, text),
  public.can_manage_staff_role(uuid, public.gym_role),
  public.add_gym_user(uuid, uuid, public.gym_role, text, text, uuid[]),
  public.set_gym_user_active(uuid, boolean),
  public.staff_user_for_reset(uuid),
  public.mark_staff_password_reset(uuid),
  public.clear_password_change_flag()
from public, anon;
grant execute on function
  public.create_gym_with_owner(text, text, text, text, text, text, text),
  public.can_manage_staff_role(uuid, public.gym_role),
  public.add_gym_user(uuid, uuid, public.gym_role, text, text, uuid[]),
  public.set_gym_user_active(uuid, boolean),
  public.staff_user_for_reset(uuid),
  public.mark_staff_password_reset(uuid),
  public.clear_password_change_flag()
to authenticated;

-------------------------------------------------------------------------------
-- Storage: gym logos (public images; only the gym owner can upload)
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-logos', 'gym-logos', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create or replace function app_private.is_gym_owner_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_users gu
    where gu.gym_id::text = p_folder and gu.user_id = auth.uid() and gu.is_active and gu.role = 'owner'
  );
$$;
revoke all on function app_private.is_gym_owner_folder(text) from public, anon;
grant execute on function app_private.is_gym_owner_folder(text) to authenticated;

create policy "owner uploads gym logo" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-logos' and app_private.is_gym_owner_folder((storage.foldername(name))[1]));
create policy "owner updates gym logo" on storage.objects for update to authenticated
  using (bucket_id = 'gym-logos' and app_private.is_gym_owner_folder((storage.foldername(name))[1]));
create policy "owner deletes gym logo" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-logos' and app_private.is_gym_owner_folder((storage.foldername(name))[1]));
-- Needed for upsert (replacing an existing logo).
create policy "owner reads own logo objects" on storage.objects for select to authenticated
  using (bucket_id = 'gym-logos' and app_private.is_gym_owner_folder((storage.foldername(name))[1]));
