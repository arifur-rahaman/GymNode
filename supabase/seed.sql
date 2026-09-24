-- Local development seed (runs on `pnpm db:reset`). NEVER run against production.
-- Logins (local only):
--   Super admin:  admin@gymnode.test      / GymNode-admin-1
--   Gym owner:    owner@gymnode.test      / GymNode-owner-1   (পাওয়ার হাউস জিম, onboarding done)
--   Reception:    phone 01722222222       / GymNode-staff-1
-- The big realistic dataset (2 gyms, ~60 members, 6 months of payments) arrives in M2/M3.

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
