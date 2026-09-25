-- M4: check-ins (attendance), expenses (tables now, screens in M5) and the dashboard summary.
-- The attendance table follows the M8 data model; until door devices exist, reception checks
-- members in by hand (method = 'manual').

-------------------------------------------------------------------------------
-- Attendance / check-ins
-------------------------------------------------------------------------------
create type public.checkin_method as enum ('face', 'fingerprint', 'rfid', 'qr', 'manual');
create type public.checkin_result as enum ('allowed', 'blocked');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  member_id uuid references public.members (id) on delete set null,
  -- Door device (M8). No foreign key yet: the devices table arrives with M8.
  device_id uuid,
  checked_in_at timestamptz not null default now(),
  method public.checkin_method not null,
  result public.checkin_result not null,
  -- expired / frozen / pending / due / override / unknown
  reason text,
  override_by uuid,
  created_by uuid default auth.uid()
);
alter table public.attendance enable row level security;
create index attendance_gym_time_idx on public.attendance (gym_id, checked_in_at desc);
create index attendance_member_idx on public.attendance (member_id, checked_in_at desc);

create policy "read attendance" on public.attendance for select to authenticated
  using (app_private.can_read_gym(gym_id) and (member_id is null or app_private.can_see_member(member_id)));
revoke insert, update, delete, truncate on public.attendance from anon, authenticated;

-- Live check-in feed on the dashboard (RLS still applies to Realtime).
alter publication supabase_realtime add table public.attendance;

-- Manual check-in at reception. Expired / frozen / not-yet-approved members are blocked
-- (like the door will be); owner/manager may override, which is audited.
create or replace function public.check_in_member(p_member_id uuid, p_override boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_status text;
  v_due bigint;
  v_result public.checkin_result;
  v_reason text;
  v_id uuid;
begin
  select * into v_member from public.members where id = p_member_id and deleted_at is null;
  if v_member.id is null
     or not app_private.can_write_gym(v_member.gym_id, '{owner,manager,reception}')
     or not app_private.can_see_branch(v_member.gym_id, v_member.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select display_status, due_paisa into v_status, v_due from public.member_overview where id = p_member_id;
  if v_member.status = 'pending' then
    v_result := 'blocked'; v_reason := 'pending';
  elsif v_status in ('expired', 'frozen') then
    v_result := 'blocked'; v_reason := v_status;
  else
    v_result := 'allowed'; v_reason := case when v_due > 0 then 'due' end;
  end if;

  if v_result = 'blocked' and p_override then
    if not app_private.has_gym_role(v_member.gym_id, '{owner,manager}') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_result := 'allowed';
    v_reason := 'override';
  end if;

  insert into public.attendance (gym_id, branch_id, member_id, method, result, reason, override_by)
  values (v_member.gym_id, v_member.branch_id, p_member_id, 'manual', v_result, v_reason,
    case when v_reason = 'override' then auth.uid() end)
  returning id into v_id;

  if v_reason = 'override' then
    perform app_private.audit(v_member.gym_id, 'access.manual_override', 'attendance', v_id, null,
      jsonb_build_object('member_id', p_member_id, 'status', v_status));
  end if;

  return jsonb_build_object('attendance_id', v_id, 'result', v_result, 'reason', v_reason);
end;
$$;

-------------------------------------------------------------------------------
-- Expenses (entry screens in M5; the dashboard chart uses them now)
-------------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Salary categories are visible to the owner only (brief §4).
  is_salary boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (gym_id, name)
);
alter table public.expense_categories enable row level security;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  category_id uuid not null references public.expense_categories (id),
  amount_paisa bigint not null check (amount_paisa > 0),
  spent_on date not null default public.dhaka_today(),
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create index expenses_gym_date_idx on public.expenses (gym_id, spent_on desc) where deleted_at is null;
create trigger set_updated_at before update on public.expenses
  for each row execute function app_private.set_updated_at();

create or replace function app_private.is_salary_category(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_salary from public.expense_categories where id = p_category_id), false);
$$;
revoke all on function app_private.is_salary_category(uuid) from public, anon;
grant execute on function app_private.is_salary_category(uuid) to authenticated;

create policy "owner manager read categories" on public.expense_categories for select to authenticated
  using ((app_private.has_gym_role(gym_id, '{owner,manager}') and (not is_salary or app_private.has_gym_role(gym_id, '{owner}')))
    or app_private.in_support_session(gym_id));
create policy "owner manager add categories" on public.expense_categories for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager}') and (not is_salary or app_private.has_gym_role(gym_id, '{owner}')));
create policy "owner manager edit categories" on public.expense_categories for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager}') and (not is_salary or app_private.has_gym_role(gym_id, '{owner}')))
  with check (app_private.can_write_gym(gym_id, '{owner,manager}') and (not is_salary or app_private.has_gym_role(gym_id, '{owner}')));

-- Managers see and record everything except salaries; only the owner sees salaries.
create policy "read expenses" on public.expenses for select to authenticated
  using ((app_private.has_gym_role(gym_id, '{owner,manager}') and app_private.can_see_branch(gym_id, branch_id)
          and (not app_private.is_salary_category(category_id) or app_private.has_gym_role(gym_id, '{owner}')))
    or app_private.in_support_session(gym_id));
create policy "add expenses" on public.expenses for insert to authenticated
  with check (app_private.can_write_gym(gym_id, '{owner,manager}') and app_private.can_see_branch(gym_id, branch_id)
    and (not app_private.is_salary_category(category_id) or app_private.has_gym_role(gym_id, '{owner}')));
create policy "edit expenses" on public.expenses for update to authenticated
  using (app_private.can_write_gym(gym_id, '{owner,manager}')
    and (not app_private.is_salary_category(category_id) or app_private.has_gym_role(gym_id, '{owner}')))
  with check (app_private.can_write_gym(gym_id, '{owner,manager}')
    and (not app_private.is_salary_category(category_id) or app_private.has_gym_role(gym_id, '{owner}')));
revoke delete on public.expenses from authenticated;

-- Default expense categories for every gym (existing and new).
create or replace function app_private.default_expense_categories(p_gym_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.expense_categories (gym_id, name, is_salary, sort_order) values
    (p_gym_id, 'ভাড়া', false, 1),
    (p_gym_id, 'বেতন', true, 2),
    (p_gym_id, 'বিদ্যুৎ ও পানি', false, 3),
    (p_gym_id, 'যন্ত্রপাতি ও মেরামত', false, 4),
    (p_gym_id, 'সাপ্লিমেন্ট কেনা', false, 5),
    (p_gym_id, 'অন্যান্য', false, 6)
  on conflict (gym_id, name) do nothing;
$$;

create or replace function app_private.gyms_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.default_expense_categories(new.id);
  return new;
end;
$$;
create trigger gyms_after_insert after insert on public.gyms
  for each row execute function app_private.gyms_after_insert();

select app_private.default_expense_categories(id) from public.gyms;

-------------------------------------------------------------------------------
-- Dashboard summary (caller's RLS applies: reception sees no expenses; trainers see no money)
-------------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_gym_id uuid, p_days integer default 14)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select public.dhaka_today() as today,
           date_trunc('month', public.dhaka_today())::date as month_start,
           (date_trunc('month', public.dhaka_today()) - interval '1 month')::date as prev_month_start
  ),
  pay as (
    select (p.paid_at at time zone 'Asia/Dhaka')::date as d, p.amount_paisa, p.method
    from public.payments p, bounds b
    where p.gym_id = p_gym_id and p.status <> 'cancelled'
      and p.paid_at >= ((b.prev_month_start - 1)::timestamp at time zone 'Asia/Dhaka')
  ),
  exp as (
    select e.spent_on as d, e.amount_paisa
    from public.expenses e, bounds b
    where e.gym_id = p_gym_id and e.deleted_at is null and e.spent_on >= b.today - greatest(p_days, 1) + 1
  ),
  days as (
    select gs::date as d from bounds b, generate_series(b.today - greatest(p_days, 1) + 1, b.today, interval '1 day') gs
  )
  select jsonb_build_object(
    'today_paisa', (select coalesce(sum(amount_paisa), 0) from pay, bounds b where d = b.today),
    'yesterday_paisa', (select coalesce(sum(amount_paisa), 0) from pay, bounds b where d = b.today - 1),
    'month_paisa', (select coalesce(sum(amount_paisa), 0) from pay, bounds b where d >= b.month_start),
    -- Same number of days of last month, for a fair comparison.
    'prev_month_to_date_paisa', (select coalesce(sum(amount_paisa), 0) from pay, bounds b
      where d >= b.prev_month_start and d < b.prev_month_start + (b.today - b.month_start) + 1),
    'methods_month', (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
        select method, sum(amount_paisa) as total from pay, bounds b where d >= b.month_start group by method) m),
    'active_members', (select count(*) from public.member_overview
      where gym_id = p_gym_id and status <> 'pending' and display_status in ('active', 'due')),
    'new_members_month', (select count(*) from public.members m, bounds b
      where m.gym_id = p_gym_id and m.deleted_at is null and m.status <> 'pending' and m.joined_at >= b.month_start),
    'due_paisa', (select coalesce(sum(due_paisa), 0) from public.member_overview where gym_id = p_gym_id and status <> 'pending'),
    'due_members', (select count(*) from public.member_overview where gym_id = p_gym_id and status <> 'pending' and due_paisa > 0),
    'checkins_today', (select count(*) from public.attendance a, bounds b
      where a.gym_id = p_gym_id and a.result = 'allowed' and (a.checked_in_at at time zone 'Asia/Dhaka')::date = b.today),
    'daily', (select jsonb_agg(jsonb_build_object(
        'date', days.d,
        'income', (select coalesce(sum(amount_paisa), 0) from pay where pay.d = days.d),
        'expense', (select coalesce(sum(amount_paisa), 0) from exp where exp.d = days.d)
      ) order by days.d) from days)
  );
$$;

revoke execute on function
  public.check_in_member(uuid, boolean),
  public.dashboard_summary(uuid, integer)
from public, anon;
grant execute on function
  public.check_in_member(uuid, boolean),
  public.dashboard_summary(uuid, integer)
to authenticated;
