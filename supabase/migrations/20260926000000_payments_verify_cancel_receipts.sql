-- M3: verify / cancel payments, pay a due without renewing, public receipts, payment stats.
-- Payments are never deleted: cancelling keeps the row with who/when/why (brief §4).

-------------------------------------------------------------------------------
-- Verify a bKash/Nagad/Rocket payment (owner/manager, after checking their wallet app)
-------------------------------------------------------------------------------
create or replace function public.verify_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null or not app_private.can_write_gym(v_pay.gym_id, '{owner,manager}')
     or not app_private.can_see_branch(v_pay.gym_id, v_pay.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_pay.status <> 'pending_verification' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  update public.payments
  set status = 'completed', verified_by = auth.uid(), verified_at = now()
  where id = p_payment_id;
  perform app_private.audit(v_pay.gym_id, 'payment.verified', 'payment', p_payment_id,
    jsonb_build_object('status', v_pay.status), jsonb_build_object('status', 'completed'));
end;
$$;

-------------------------------------------------------------------------------
-- Cancel a payment (with a reason). Owner/manager: any payment. Reception: only a
-- still-pending payment they took themselves. If the membership this payment paid for
-- has no other live payment, that membership is cancelled too (e.g. a fake bKash ID).
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
end;
$$;

-------------------------------------------------------------------------------
-- Pay (part of) an outstanding due without renewing.
-------------------------------------------------------------------------------
create or replace function public.pay_due(
  p_member_id uuid,
  p_amount_paisa bigint,
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
  v_due bigint;
  v_txn text := nullif(trim(coalesce(p_transaction_id, '')), '');
  v_year int := extract(year from public.dhaka_today())::int;
  v_invoice text;
  v_payment_id uuid;
begin
  select * into v_member from public.members where id = p_member_id and deleted_at is null for update;
  if v_member.id is null
     or not app_private.can_write_gym(v_member.gym_id, '{owner,manager,reception}')
     or not app_private.can_see_branch(v_member.gym_id, v_member.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select due_paisa into v_due from public.member_overview where id = p_member_id;
  if p_amount_paisa <= 0 or p_amount_paisa > coalesce(v_due, 0) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_method not in ('cash', 'card') and v_txn is null then
    raise exception 'transaction_id_required' using errcode = '22023';
  end if;

  v_invoice := 'INV-' || v_year || '-' || lpad(app_private.next_counter(v_member.gym_id, 'invoice', v_year)::text, 5, '0');
  begin
    insert into public.payments (gym_id, branch_id, member_id, kind, amount_paisa, method, transaction_id, status, invoice_no)
    values (v_member.gym_id, v_member.branch_id, p_member_id, 'due', p_amount_paisa, p_method, v_txn,
      case when p_method in ('cash', 'card') then 'completed' else 'pending_verification' end::public.payment_status,
      v_invoice)
    returning id into v_payment_id;
  exception when unique_violation then
    raise exception 'duplicate_transaction_id' using errcode = '23505';
  end;

  perform app_private.audit(v_member.gym_id, 'payment.created', 'payment', v_payment_id, null,
    jsonb_build_object('kind', 'due', 'amount_paisa', p_amount_paisa, 'method', p_method, 'transaction_id', v_txn, 'invoice_no', v_invoice));
  return jsonb_build_object('payment_id', v_payment_id, 'invoice_no', v_invoice);
end;
$$;

-------------------------------------------------------------------------------
-- Public receipt (/r/<token>). The token is 24 random hex characters; knowing it is the
-- permission. Returns only what a paper receipt would show.
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
    'received_by', coalesce(gu.display_name, '')
  )
  from public.payments p
  join public.gyms g on g.id = p.gym_id
  join public.branches b on b.id = p.branch_id
  left join public.members m on m.id = p.member_id
  left join public.memberships ms on ms.id = p.membership_id
  left join public.packages pk on pk.id = ms.package_id
  left join public.gym_users gu on gu.gym_id = p.gym_id and gu.user_id = p.received_by
  where p.receipt_token = p_token and char_length(p_token) = 24;
$$;

-------------------------------------------------------------------------------
-- Totals for the Payments page (caller's RLS applies).
-------------------------------------------------------------------------------
create or replace function public.payment_stats(p_gym_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_paisa', coalesce(sum(x.total), 0),
    'count', coalesce(sum(x.n), 0),
    'by_method', coalesce(jsonb_object_agg(x.method, x.total), '{}'::jsonb)
  )
  from (
    select method, sum(amount_paisa) as total, count(*) as n
    from public.payments
    where gym_id = p_gym_id and status <> 'cancelled' and paid_at >= p_from and paid_at < p_to
    group by method
  ) x;
$$;

create or replace function public.gym_money_snapshot(p_gym_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pending_count', (select count(*) from public.payments where gym_id = p_gym_id and status = 'pending_verification'),
    'pending_paisa', (select coalesce(sum(amount_paisa), 0) from public.payments where gym_id = p_gym_id and status = 'pending_verification'),
    'pending_overdue_count', (select count(*) from public.payments
      where gym_id = p_gym_id and status = 'pending_verification' and paid_at < now() - interval '24 hours'),
    'due_paisa', (select coalesce(sum(due_paisa), 0) from public.member_overview where gym_id = p_gym_id and status <> 'pending'),
    'due_members', (select count(*) from public.member_overview where gym_id = p_gym_id and status <> 'pending' and due_paisa > 0)
  );
$$;

revoke execute on function
  public.verify_payment(uuid),
  public.cancel_payment(uuid, text),
  public.pay_due(uuid, bigint, public.payment_method, text),
  public.payment_stats(uuid, timestamptz, timestamptz),
  public.gym_money_snapshot(uuid),
  public.get_receipt(text)
from public;
grant execute on function
  public.verify_payment(uuid),
  public.cancel_payment(uuid, text),
  public.pay_due(uuid, bigint, public.payment_method, text),
  public.payment_stats(uuid, timestamptz, timestamptz),
  public.gym_money_snapshot(uuid)
to authenticated;
grant execute on function public.get_receipt(text) to anon, authenticated;
