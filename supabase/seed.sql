-- Local development seed (runs on `pnpm db:reset`). NEVER run against production.
-- Logins (local only):
--   Super admin:  admin@gymnode.test      / GymNode-admin-1
--   Gym owner:    owner@gymnode.test      / GymNode-owner-1   (পাওয়ার হাউস জিম, onboarding done)
--   Reception:    phone 01722222222       / GymNode-staff-1
--   Trainer:      phone 01733333333       / GymNode-staff-1
--   Owner #2:     owner2@gymnode.test     / GymNode-owner-1   (ফিট জোন)
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

