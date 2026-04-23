-- =====================================================
-- VMS - Seed an admin user + a demo company
-- Run this AFTER 001_users_and_auth.sql
-- Change the email/password below before running!
-- =====================================================

DO $$
DECLARE
  v_email TEXT := 'admin@vms.com';
  v_pass  TEXT := '12345678';
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  -- 1) Create the auth user (idempotent: skip if email already exists)
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pass, gen_salt('bf')),
      NOW(),
      jsonb_build_object('role', 'system_admin', 'full_name', 'System Admin'),
      NOW(), NOW(), '', '', '', ''
    )
    RETURNING id INTO v_user_id;

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::TEXT,
      jsonb_build_object('sub', v_user_id::TEXT, 'email', v_email),
      'email',
      NOW(), NOW(), NOW()
    );
  END IF;

  -- 2) Ensure a demo company exists
  SELECT id INTO v_company_id FROM companies WHERE name_en = 'Demo Company' LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO companies (name_ar, name_en, description_ar, description_en, is_active)
    VALUES ('شركة تجريبية', 'Demo Company', 'شركة تجريبية للعرض', 'Demo company for testing', true)
    RETURNING id INTO v_company_id;
  END IF;

  -- 3) Upsert user_preferences (admin role + default company)
  INSERT INTO user_preferences (user_id, full_name, role, company_id, is_disabled)
  VALUES (v_user_id, 'System Admin', 'system_admin', v_company_id, false)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        company_id = EXCLUDED.company_id,
        is_disabled = false;

  -- 4) Link user to the demo company
  INSERT INTO user_companies (user_id, company_id)
  VALUES (v_user_id, v_company_id)
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RAISE NOTICE 'Admin ready: % / %', v_email, v_pass;
END $$;
