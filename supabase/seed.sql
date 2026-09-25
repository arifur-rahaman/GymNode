-- Local development seed (runs on `pnpm db:reset`). NEVER run against production.
-- Logins (local only):
--   Super admin:  admin@gymnode.test      / GymNode-admin-1
--   Gym owner:    owner@gymnode.test      / GymNode-owner-1   (পাওয়ার হাউস জিম, onboarding done)
--   Reception:    phone 01722222222       / GymNode-staff-1
--   Trainer:      phone 01733333333       / GymNode-staff-1
--   Owner #2:     owner2@gymnode.test     / GymNode-owner-1   (ফিট জোন)
--   Support team: support@gymnode.test    / GymNode-admin-1   (platform role "support": read-only helper)
-- Plus 8 small sample gyms (no members) so the super admin screens have a realistic list.
-- Subscription prices below are SAMPLE numbers for the demo only; real plan prices are still undecided.
-- Members: ~45 in পাওয়ার হাউস জিম and ~15 in ফিট জোন, with 6 months of memberships and payments.

create function pg_temp.seed_user(p_email text, p_password text, p_name text, p_app_meta jsonb default '{}')
returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb || p_app_meta,
    jsonb_build_object('full_name', p_name), now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true), now(), now(), now());
  return v_id;
end $$;

do $$
declare
  v_admin uuid;
  v_owner uuid;
  v_staff uuid;
  v_gym uuid;
begin
  v_admin := pg_temp.seed_user('admin@gymnode.test', 'GymNode-admin-1', 'অ্যাডমিন');
  insert into public.platform_admins (user_id, role) values (v_admin, 'super_admin');

  v_owner := pg_temp.seed_user('owner@gymnode.test', 'GymNode-owner-1', 'জাহিদ হাসান');

  -- Act as the owner so the normal onboarding function (with its checks and audit) runs.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_gym := public.create_gym_with_owner('পাওয়ার হাউস জিম', 'PH', 'ঢাকা', '+8801711111111', 'রোড ২৭, ধানমন্ডি', 'ধানমন্ডি শাখা', 'রোড ২৭, ধানমন্ডি');

  insert into public.packages (gym_id, name, name_en, duration_days, price_paisa, admission_fee_paisa, sort_order) values
    (v_gym, 'মাসিক', 'Monthly', 30, 150000, 100000, 1),
    (v_gym, '৩ মাস', '3 months', 90, 400000, 100000, 2),
    (v_gym, '৬ মাস', '6 months', 180, 750000, 0, 3);
  update public.gyms set onboarding_completed_at = now() where id = v_gym;

  v_staff := pg_temp.seed_user('8801722222222@staff.gymnode.invalid', 'GymNode-staff-1', 'শিপা আক্তার',
    jsonb_build_object('created_for_gym', v_gym));
  perform public.add_gym_user(v_gym, v_staff, 'reception', 'শিপা আক্তার', '+8801722222222');
  -- Seeded staff skip the forced password change so the demo login is quick.
  update public.profiles set must_change_password = false where user_id = v_staff;

  perform set_config('request.jwt.claims', '', true);
end $$;

-------------------------------------------------------------------------------
-- M2: second gym, trainer, members, memberships and payments (realistic sample)
-------------------------------------------------------------------------------
do $$
declare
  v_gym1 uuid := (select id from public.gyms where code_prefix = 'PH' limit 1);
  v_owner2 uuid;
  v_gym2 uuid;
  v_trainer uuid;
  v_trainer_gu uuid;
  v_first text[] := array['রাফি','তানিয়া','সাকিব','নুসরাত','ইমরান','নাদিয়া','ফাহিম','সাদিয়া','তানভীর','রুমানা',
    'মেহেদী','আসিফ','মারিয়া','জুবায়ের','ফারহানা','রাকিব','সুমাইয়া','আরিফ','তাসনিম','শাহরিয়ার',
    'লামিয়া','রিয়াদ','মিম','সজীব','আয়েশা','নাফিস','ঐশী','হাসিব','জান্নাত','তৌহিদ'];
  v_last text[] := array['আহমেদ','ইসলাম','হাসান','জাহান','হোসেন','করিম','রহমান','আফরিন','আলম','আক্তার',
    'খান','চৌধুরী','সুলতানা','মাহমুদ','সিদ্দিকী'];
  v_female int[] := array[2,4,6,8,10,13,15,17,19,21,23,25,27,29];
  v_gym uuid;
  v_branch uuid;
  v_member uuid;
  v_pkgs uuid[];
  v_pkg public.packages;
  v_start date;
  v_end date;
  v_prev uuid;
  v_ms uuid;
  v_first_ms boolean;
  v_amount bigint;
  v_method public.payment_method;
  v_r float;
  v_fi int;
  v_n int;
  v_today date := public.dhaka_today();
  v_year int;
begin
  perform setseed(0.42);

  -- Trainer in gym 1.
  v_trainer := pg_temp.seed_user('8801733333333@staff.gymnode.invalid', 'GymNode-staff-1', 'কামাল উদ্দিন',
    jsonb_build_object('created_for_gym', v_gym1));
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select owner_user_id from public.gyms where id = v_gym1), 'role', 'authenticated')::text, true);
  v_trainer_gu := public.add_gym_user(v_gym1, v_trainer, 'trainer', 'কামাল উদ্দিন', '+8801733333333');
  update public.profiles set must_change_password = false where user_id = v_trainer;

  -- Second gym.
  v_owner2 := pg_temp.seed_user('owner2@gymnode.test', 'GymNode-owner-1', 'রিয়াদ হোসেন');
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2, 'role', 'authenticated')::text, true);
  v_gym2 := public.create_gym_with_owner('ফিট জোন', 'FZ', 'ঢাকা', '+8801755555555', 'মিরপুর ১০', 'মিরপুর শাখা', 'মিরপুর ১০');
  insert into public.packages (gym_id, name, name_en, duration_days, price_paisa, admission_fee_paisa, sort_order) values
    (v_gym2, 'মাসিক', 'Monthly', 30, 120000, 50000, 1),
    (v_gym2, '৩ মাস', '3 months', 90, 330000, 50000, 2);
  update public.gyms set onboarding_completed_at = now() where id = v_gym2;
  perform set_config('request.jwt.claims', '', true);

  -- Lockers in gym 1.
  insert into public.lockers (gym_id, branch_id, code)
  select v_gym1, (select id from public.branches where gym_id = v_gym1 limit 1), 'L-' || lpad(i::text, 2, '0')
  from generate_series(1, 30) i;

  for v_gym, v_n in select * from (values (v_gym1, 45), (v_gym2, 15)) t(g, n) loop
    select id into v_branch from public.branches where gym_id = v_gym order by created_at limit 1;
    select array_agg(id order by sort_order) into v_pkgs from public.packages where gym_id = v_gym and deleted_at is null;

    for i in 1 .. v_n loop
      v_fi := 1 + ((i * 7 + (case when v_gym = v_gym2 then 3 else 0 end)) % array_length(v_first, 1));
      insert into public.members (gym_id, branch_id, full_name, phone, gender, joined_at, dob, address,
        assigned_trainer_id, locker_id, created_by)
      values (
        v_gym, v_branch,
        v_first[v_fi] || ' ' || v_last[1 + ((i * 3) % array_length(v_last, 1))],
        '+8801' || (array['7','8','9','6','5','3'])[1 + (i % 6)] || lpad((10000000 + i * 7919 + (case when v_gym = v_gym2 then 555 else 0 end))::text, 8, '0'),
        case when v_fi = any (v_female) then 'female' else 'male' end::public.member_gender,
        v_today - (5 + floor(random() * 175))::int,
        date '1985-01-01' + floor(random() * 6500)::int,
        (array['ধানমন্ডি','মোহাম্মদপুর','মিরপুর','লালমাটিয়া','কলাবাগান'])[1 + (i % 5)],
        case when v_gym = v_gym1 and i % 4 = 0 then v_trainer_gu end,
        case when v_gym = v_gym1 and i <= 20 and i % 3 = 0
          then (select id from public.lockers where gym_id = v_gym1 and code = 'L-' || lpad(i::text, 2, '0')) end,
        null
      ) returning id into v_member;

      -- Membership chain from the joining date. Most members renew; ~20% stop (expired).
      v_start := (select joined_at from public.members where id = v_member);
      v_prev := null;
      v_first_ms := true;
      loop
        -- Pick the index first: random() inside WHERE would be re-evaluated for every row.
        v_fi := 1 + (case when random() < 0.7 then 0 else floor(random() * array_length(v_pkgs, 1))::int end);
        select * into v_pkg from public.packages where id = v_pkgs[v_fi];
        v_end := v_start + v_pkg.duration_days - 1;
        insert into public.memberships (gym_id, member_id, package_id, start_date, end_date, price_paisa,
          admission_fee_paisa, discount_paisa, previous_membership_id, created_by)
        values (v_gym, v_member, v_pkg.id, v_start, v_end, v_pkg.price_paisa,
          case when v_first_ms then v_pkg.admission_fee_paisa else 0 end,
          case when random() < 0.1 then 20000 else 0 end, v_prev, null)
        returning id into v_ms;

        -- Payment on the start date. The latest membership is sometimes part-paid or pending bKash.
        v_r := random();
        v_method := case when v_r < 0.5 then 'cash' when v_r < 0.8 then 'bkash' when v_r < 0.95 then 'nagad' else 'card' end;
        v_amount := (select price_paisa + admission_fee_paisa - discount_paisa from public.memberships where id = v_ms);
        if v_end >= v_today and random() < 0.25 then
          v_amount := v_amount - 50000;  -- leaves ৳500 due
        end if;
        v_year := extract(year from v_start)::int;
        if v_amount > 0 then
          insert into public.payments (gym_id, branch_id, member_id, membership_id, kind, amount_paisa, method,
            transaction_id, status, paid_at, received_by, invoice_no, verified_at)
          values (v_gym, v_branch, v_member, v_ms, 'membership', v_amount, v_method,
            case when v_method in ('bkash', 'nagad') then upper(substr(md5(random()::text), 1, 10)) end,
            case when v_method in ('bkash', 'nagad') and v_end >= v_today and random() < 0.3
              then 'pending_verification' else 'completed' end::public.payment_status,
            (v_start + time '10:00') at time zone 'Asia/Dhaka' + make_interval(mins => floor(random() * 600)::int),
            (select owner_user_id from public.gyms where id = v_gym),
            'INV-' || v_year || '-' || lpad(app_private.next_counter(v_gym, 'invoice', v_year)::text, 5, '0'),
            case when v_method in ('bkash', 'nagad') then now() end);
        end if;

        exit when v_end >= v_today or random() < 0.2;
        v_prev := v_ms;
        v_first_ms := false;
        v_start := v_end + 1;
      end loop;

      -- A few current members are on a freeze right now.
      if v_end >= v_today + 10 and i % 11 = 0 then
        update public.memberships
        set status = 'frozen', frozen_from = v_today - 2, frozen_until = v_today + 7, end_date = end_date + 10
        where id = v_ms;
        insert into public.membership_freezes (gym_id, membership_id, from_date, to_date, days, reason)
        values (v_gym, v_ms, v_today - 2, v_today + 7, 10, 'গ্রামের বাড়ি');
      end if;

      -- Face / fingerprint marked for most members of gym 1.
      if v_gym = v_gym1 and i % 5 <> 0 then
        insert into public.biometric_enrollments (gym_id, member_id, method) values (v_gym, v_member, 'face');
        if i % 2 = 0 then
          insert into public.biometric_enrollments (gym_id, member_id, method) values (v_gym, v_member, 'fingerprint');
        end if;
      end if;
    end loop;
  end loop;

  -- Three QR sign-ups waiting for approval in gym 1.
  insert into public.members (gym_id, branch_id, full_name, phone, gender, status, source, created_by)
  select v_gym1, (select id from public.branches where gym_id = v_gym1 limit 1), n, p, g::public.member_gender, 'pending', 'qr_self', null
  from (values ('সুমন মিয়া', '+8801812300001', 'male'), ('নীলা রহমান', '+8801812300002', 'female'),
               ('জাহিদুল ইসলাম', '+8801812300003', 'male')) t(n, p, g);
end $$;


-------------------------------------------------------------------------------
-- M4: expenses (6 months) and check-ins (5 weeks) so the dashboard and profiles look alive
-------------------------------------------------------------------------------
do $$
declare
  v_gym record;
  v_today date := public.dhaka_today();
  v_month date;
  v_member record;
  v_day date;
begin
  perform setseed(0.7);
  for v_gym in select g.id, (select id from public.branches b where b.gym_id = g.id order by created_at limit 1) as branch_id,
                      case when g.code_prefix = 'PH' then 1.0 else 0.5 end as scale
               from public.gyms g loop
    for i in 0 .. 5 loop
      v_month := (date_trunc('month', v_today) - make_interval(months => i))::date;
      insert into public.expenses (gym_id, branch_id, category_id, amount_paisa, spent_on, note, created_by)
      select v_gym.id, v_gym.branch_id, c.id, (round(amt * v_gym.scale / 10000.0) * 10000)::bigint, least(v_month + offs, v_today), note, null
      from (values
        ('ভাড়া', 2500000, 2, 'মাসিক ভাড়া'),
        ('বেতন', 2000000, 4, 'স্টাফ বেতন'),
        ('বিদ্যুৎ ও পানি', 500000 + floor(random() * 150000)::int, 9, 'বিল'),
        ('যন্ত্রপাতি ও মেরামত', 100000 + floor(random() * 300000)::int, 15, 'মেরামত'),
        ('সাপ্লিমেন্ট কেনা', 200000 + floor(random() * 300000)::int, 20, 'প্রোটিন স্টক')
      ) as x(cat, amt, offs, note)
      join public.expense_categories c on c.gym_id = v_gym.id and c.name = x.cat
      where v_month + offs <= v_today;
    end loop;
    -- Small daily expenses over the last two weeks.
    insert into public.expenses (gym_id, branch_id, category_id, amount_paisa, spent_on, note, created_by)
    select v_gym.id, v_gym.branch_id, c.id, (round((10000 + floor(random() * 60000)) / 1000.0) * 1000)::bigint, v_today - d, 'দৈনিক খরচ', null
    from generate_series(0, 13) d
    join public.expense_categories c on c.gym_id = v_gym.id and c.name = 'অন্যান্য'
    where random() < 0.6;
  end loop;

  -- Check-ins: current members come 3–5 days a week, mornings and evenings.
  for v_member in select mo.id, mo.gym_id, mo.branch_id, mo.display_status from public.member_overview mo where mo.status = 'active' loop
    for d in 0 .. 34 loop
      v_day := v_today - d;
      continue when v_member.display_status in ('expired') and d < 3;
      continue when random() > 0.6;
      insert into public.attendance (gym_id, branch_id, member_id, checked_in_at, method, result, reason, created_by)
      values (v_member.gym_id, v_member.branch_id, v_member.id,
        (v_day + (case when random() < 0.6 then time '06:30' else time '17:30' end)) at time zone 'Asia/Dhaka'
          + make_interval(mins => floor(random() * 150)::int),
        'manual', 'allowed', null, null);
    end loop;
    -- Expired members sometimes try today and are blocked.
    if v_member.display_status = 'expired' and random() < 0.25 then
      insert into public.attendance (gym_id, branch_id, member_id, checked_in_at, method, result, reason, created_by)
      values (v_member.gym_id, v_member.branch_id, v_member.id, now() - make_interval(mins => floor(random() * 120)::int),
        'manual', 'blocked', 'expired', null);
    end if;
  end loop;
  -- Never in the future.
  delete from public.attendance where checked_in_at > now();
end $$;


-------------------------------------------------------------------------------
-- M5: supplements shop — products, stock purchases and ~2 months of sales
-------------------------------------------------------------------------------
do $$
declare
  v_gym record;
  v_today date := public.dhaka_today();
  v_year int := extract(year from public.dhaka_today())::int;
  v_product record;
  v_sale uuid;
  v_payment uuid;
  v_member uuid;
  v_qty int;
  v_at timestamptz;
  v_method public.payment_method;
begin
  perform setseed(0.3);
  for v_gym in select g.id, (select id from public.branches b where b.gym_id = g.id order by created_at limit 1) as branch_id,
                      (select user_id from public.gym_users gu where gu.gym_id = g.id and gu.role = 'owner' limit 1) as owner_id
               from public.gyms g loop
    insert into public.products (gym_id, name, price_paisa, cost_paisa, low_stock_at, sort_order)
    values
      (v_gym.id, 'প্রোটিন শেক', 15000, 9000, 10, 1),
      (v_gym.id, 'হোয়ে প্রোটিন ১ কেজি', 420000, 340000, 3, 2),
      (v_gym.id, 'মিনারেল ওয়াটার', 2500, 1500, 24, 3),
      (v_gym.id, 'এনার্জি ড্রিংক', 8000, 5500, 12, 4),
      (v_gym.id, 'প্রোটিন বার', 18000, 12000, 10, 5),
      (v_gym.id, 'জিম গ্লাভস', 65000, 40000, 2, 6);
    -- Opening stock (two months ago).
    insert into public.stock_movements (gym_id, product_id, kind, qty_change, unit_cost_paisa, note, created_by, created_at)
    select v_gym.id, p.id, 'purchase', q.qty, p.cost_paisa, 'শুরুর স্টক', v_gym.owner_id, now() - interval '62 days'
    from public.products p
    join (values ('প্রোটিন শেক', 160), ('হোয়ে প্রোটিন ১ কেজি', 10), ('মিনারেল ওয়াটার', 260),
                 ('এনার্জি ড্রিংক', 90), ('প্রোটিন বার', 70), ('জিম গ্লাভস', 8)) q(name, qty) on q.name = p.name
    where p.gym_id = v_gym.id;

    -- Sales: a few per day for 60 days.
    for d in 0 .. 59 loop
      for s in 1 .. (1 + floor(random() * 4))::int loop
        v_at := ((v_today - d) + time '07:00') at time zone 'Asia/Dhaka' + make_interval(mins => floor(random() * 780)::int);
        continue when v_at > now();
        select * into v_product from public.products p
        where p.gym_id = v_gym.id and p.stock_qty > 2 and p.name <> 'জিম গ্লাভস'
        order by random() limit 1;
        continue when v_product.id is null;
        v_qty := (1 + floor(random() * 2))::int;
        v_member := case when random() < 0.6 then
          (select id from public.members m where m.gym_id = v_gym.id and m.status = 'active' order by random() limit 1) end;
        v_method := case when random() < 0.7 then 'cash' else 'bkash' end;
        insert into public.payments (gym_id, branch_id, member_id, kind, amount_paisa, method, transaction_id, status,
          paid_at, received_by, invoice_no, verified_at)
        values (v_gym.id, v_gym.branch_id, v_member, 'sale', v_product.price_paisa * v_qty, v_method,
          case when v_method = 'bkash' then upper(substr(md5(random()::text), 1, 10)) end,
          (case when v_method = 'bkash' and d = 0 then 'pending_verification' else 'completed' end)::public.payment_status,
          v_at, v_gym.owner_id,
          'INV-' || v_year || '-' || lpad(app_private.next_counter(v_gym.id, 'invoice', v_year)::text, 5, '0'),
          case when v_method = 'bkash' and d > 0 then v_at + interval '3 hours' end)
        returning id into v_payment;
        insert into public.sales (gym_id, branch_id, member_id, payment_id, subtotal_paisa, discount_paisa, total_paisa, created_by, created_at)
        values (v_gym.id, v_gym.branch_id, v_member, v_payment, v_product.price_paisa * v_qty, 0, v_product.price_paisa * v_qty,
          v_gym.owner_id, v_at)
        returning id into v_sale;
        insert into public.sale_items (sale_id, gym_id, product_id, product_name, qty, unit_price_paisa, unit_cost_paisa, line_total_paisa)
        values (v_sale, v_gym.id, v_product.id, v_product.name, v_qty, v_product.price_paisa, v_product.cost_paisa, v_product.price_paisa * v_qty);
        insert into public.stock_movements (gym_id, product_id, kind, qty_change, sale_id, created_by, created_at)
        values (v_gym.id, v_product.id, 'sale', -v_qty, v_sale, v_gym.owner_id, v_at);
      end loop;
    end loop;
  end loop;
end $$;


-------------------------------------------------------------------------------
-- M7: SaaS side — plans on gyms, subscription invoices, more gyms, support tickets
-------------------------------------------------------------------------------
do $$
declare
  v_support uuid;
  v_ph uuid := (select id from public.gyms where code_prefix = 'PH');
  v_fz uuid := (select id from public.gyms where code_prefix = 'FZ');
  v_plan_ids jsonb := (select jsonb_object_agg(code, id) from public.plans);
  v_month date := date_trunc('month', public.dhaka_today())::date;
  v_gym record;
  v_owner uuid;
  v_gym_id uuid;
  v_sub uuid;
  v_plan uuid;
  v_ticket uuid;
begin
  perform setseed(0.42);
  v_support := pg_temp.seed_user('support@gymnode.test', 'GymNode-admin-1', 'সাপোর্ট টিম');
  insert into public.platform_admins (user_id, role) values (v_support, 'support');

  -- পাওয়ার হাউস: Growth, paying for 7 months (sample price ৳3,000). ফিট জোন stays on its free trial.
  update public.gyms set plan_id = (v_plan_ids ->> 'growth')::uuid, status = 'active',
    created_at = now() - interval '7 months' where id = v_ph;
  update public.gym_subscriptions set plan_id = (v_plan_ids ->> 'growth')::uuid, price_paisa = 300000, status = 'active',
    current_period_start = v_month, current_period_end = v_month + interval '1 month' where gym_id = v_ph;

  -- Eight small sample gyms: name, prefix, city, plan, sample price, status, months old, overdue?, last login days ago
  for v_gym in
    select * from (values
      ('আয়রন প্যারাডাইস', 'IP', 'চট্টগ্রাম', null, null, 'trial', 0, false, 1),
      ('মাসল ফ্যাক্টরি', 'MF', 'ঢাকা', 'starter', 150000, 'active', 9, true, 3),
      ('বডি শেপ জিম', 'BS', 'সিলেট', 'starter', 150000, 'active', 5, false, 0),
      ('গোল্ডেন জিম', 'GG', 'চট্টগ্রাম', 'pro', 600000, 'active', 11, false, 0),
      ('লেডিস ফিটনেস', 'LF', 'ঢাকা', 'growth', 300000, 'active', 4, false, 0),
      ('এক্সট্রিম ফিট', 'XF', 'খুলনা', 'starter', 150000, 'suspended', 8, true, 21),
      ('কোর ফিটনেস', 'CF', 'রাজশাহী', null, null, 'trial', 0, false, 0),
      ('পাওয়ার লিফট', 'PL', 'ঢাকা', 'starter', 150000, 'cancelled', 6, false, 40)
    ) as x(name, prefix, city, plan_code, price, status, months, overdue, last_login)
  loop
    v_owner := pg_temp.seed_user(lower(v_gym.prefix) || '.owner@gymnode.test', 'GymNode-owner-1', 'মালিক ' || v_gym.prefix);
    update auth.users set last_sign_in_at = now() - make_interval(days => v_gym.last_login, hours => 2) where id = v_owner;
    v_plan := (v_plan_ids ->> v_gym.plan_code)::uuid;
    insert into public.gyms (name, slug, code_prefix, owner_user_id, city, status, trial_ends_at, plan_id,
      onboarding_completed_at, created_at)
    values (v_gym.name, lower(v_gym.prefix) || '-' || substr(md5(v_gym.name), 1, 5), v_gym.prefix, v_owner, v_gym.city,
      v_gym.status::public.gym_status,
      case when v_gym.status = 'trial' then now() + make_interval(days => 4 + v_gym.last_login * 5)
           else now() - make_interval(months => v_gym.months) + interval '14 days' end,
      v_plan, now(), now() - make_interval(months => v_gym.months, days => 3))
    returning id into v_gym_id;
    insert into public.branches (gym_id, name) values (v_gym_id, 'মেইন শাখা');
    insert into public.gym_users (gym_id, user_id, role, display_name) values (v_gym_id, v_owner, 'owner', 'মালিক ' || v_gym.prefix);
    insert into public.gym_subscriptions (gym_id, plan_id, price_paisa, status, current_period_start, current_period_end)
    values (v_gym_id, v_plan, v_gym.price,
      case v_gym.status when 'trial' then 'trialing' when 'active' then 'active' when 'cancelled' then 'cancelled' else 'past_due' end::public.subscription_status,
      v_month, v_month + interval '1 month')
    returning id into v_sub;
    -- Monthly invoices since the trial ended; the current month is unpaid for "overdue" gyms.
    if v_gym.price is not null then
      for m in 1 .. greatest(v_gym.months - 1, 0) loop
        insert into public.subscription_invoices (gym_id, subscription_id, invoice_no, amount_paisa, due_date, status,
          paid_at, method, transaction_id, plan_id, period_start, period_end)
        values (v_gym_id, v_sub, app_private.new_invoice_no(), v_gym.price,
          (v_month - make_interval(months => v_gym.months - 1 - m))::date + 9,
          case when (v_gym.overdue and m = v_gym.months - 1)
                 or (v_gym.status = 'suspended' and m >= v_gym.months - 2) then 'unpaid'
               when v_gym.status = 'cancelled' and m > v_gym.months - 3 then 'void'
               else 'paid' end::public.invoice_status,
          case when (v_gym.overdue and m = v_gym.months - 1) or (v_gym.status = 'suspended' and m >= v_gym.months - 2)
                 or (v_gym.status = 'cancelled' and m > v_gym.months - 3) then null
               else ((v_month - make_interval(months => v_gym.months - 1 - m))::date + 6)::timestamp at time zone 'Asia/Dhaka' end,
          case when random() < 0.5 then 'bkash' when random() < 0.5 then 'nagad' else 'bank' end::public.billing_method,
          upper(substr(md5(random()::text), 1, 10)), v_plan,
          (v_month - make_interval(months => v_gym.months - 1 - m))::date,
          (v_month - make_interval(months => v_gym.months - 2 - m))::date - 1);
      end loop;
    end if;
    if v_gym.status = 'cancelled' then
      update public.gyms set status_changed_at = v_month + interval '3 days' where id = v_gym_id;
    end if;
  end loop;
  -- Unpaid invoices have no payment method.
  update public.subscription_invoices set method = null, transaction_id = null where status <> 'paid';

  -- PH's 7 months of invoices, all paid.
  insert into public.subscription_invoices (gym_id, subscription_id, invoice_no, amount_paisa, due_date, status, paid_at,
    method, transaction_id, plan_id, period_start, period_end)
  select v_ph, s.id, app_private.new_invoice_no(), 300000, (v_month - make_interval(months => 6 - m))::date + 9, 'paid',
    ((v_month - make_interval(months => 6 - m))::date + 7)::timestamp at time zone 'Asia/Dhaka', 'bkash',
    upper(substr(md5(random()::text), 1, 10)), (v_plan_ids ->> 'growth')::uuid,
    (v_month - make_interval(months => 6 - m))::date, (v_month - make_interval(months => 5 - m))::date - 1
  from public.gym_subscriptions s, generate_series(0, 6) m
  where s.gym_id = v_ph;

  -- Support tickets.
  for v_gym in
    select * from (values
      ('MF', 'দরজা খুলছে না, মেশিন অফলাইন', 'সকাল থেকে মেইন গেটের মেশিন কাজ করছে না। মেম্বাররা ঢুকতে পারছে না।', 'urgent', 3),
      ('GG', 'বিকাশ পেমেন্ট যাচাই হচ্ছে না', 'যাচাই বাটন চাপলে কিছু হচ্ছে না, দয়া করে দেখুন।', 'urgent', 5),
      ('IP', 'পুরনো Excel ডেটা তুলে দিতে হবে', 'আমাদের ২০০ মেম্বারের একটা Excel ফাইল আছে। এটা কি তুলে দেওয়া যাবে?', 'normal', 26),
      ('CF', 'নতুন প্যাকেজ কীভাবে বানাব?', 'ঈদ অফারের জন্য ১৫ দিনের প্যাকেজ বানাতে চাই।', 'normal', 30),
      ('PH', 'রিপোর্টে ভুল তারিখ', 'গত মাসের রিপোর্টে একটা পেমেন্টের তারিখ ভুল দেখাচ্ছে মনে হচ্ছে।', 'normal', 50)
    ) as x(prefix, subject, body, priority, hours_ago)
  loop
    select g.id, g.owner_user_id into v_gym_id, v_owner from public.gyms g where g.code_prefix = v_gym.prefix;
    insert into public.support_tickets (gym_id, opened_by, subject, priority, last_message_at, created_at)
    values (v_gym_id, v_owner, v_gym.subject, v_gym.priority::public.ticket_priority,
      now() - make_interval(hours => v_gym.hours_ago), now() - make_interval(hours => v_gym.hours_ago))
    returning id into v_ticket;
    insert into public.support_ticket_messages (ticket_id, author_user_id, author_name, body, created_at)
    values (v_ticket, v_owner, coalesce((select full_name from public.profiles where user_id = v_owner), ''), v_gym.body,
      now() - make_interval(hours => v_gym.hours_ago));
  end loop;
  -- One answered ticket.
  select t.id into v_ticket from public.support_tickets t join public.gyms g on g.id = t.gym_id where g.code_prefix = 'CF';
  insert into public.support_ticket_messages (ticket_id, author_user_id, author_name, from_platform, body, created_at)
  values (v_ticket, v_support, 'সাপোর্ট টিম', true, 'প্যাকেজ পেজে "+ প্যাকেজ যোগ করুন" চাপুন, মেয়াদ ১৫ দিন দিন। কোনো সমস্যা হলে জানাবেন।', now() - interval '20 hours');
  update public.support_tickets set status = 'answered', last_message_at = now() - interval '20 hours' where id = v_ticket;
end $$;
