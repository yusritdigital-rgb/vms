-- =====================================================
-- VMS - Users & Auth schema (minimal)
-- Run this in the Supabase SQL editor ONCE to set up login.
-- It only contains what is required for authentication,
-- user profiles, company selection and role-based access.
-- All business tables (vehicles, job_cards, spare_parts, ...)
-- are intentionally NOT created here.
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1) companies
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  max_vehicles INTEGER DEFAULT 0,
  show_job_cards BOOLEAN DEFAULT true,
  show_spare_parts BOOLEAN DEFAULT true,
  show_reserves BOOLEAN DEFAULT true,
  show_reports BOOLEAN DEFAULT true,
  show_forms BOOLEAN DEFAULT true,
  show_scheduling BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2) user_preferences (user profile + role + settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('system_admin', 'company_manager', 'company_technician'))
    DEFAULT 'company_technician',
  is_disabled BOOLEAN DEFAULT false,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  language TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'light',
  permissions JSONB DEFAULT '{
    "dashboard": true,
    "fleet": true,
    "history": true,
    "jobCards": true,
    "spareParts": true,
    "forms": true,
    "reserves": true,
    "settings": true,
    "notifications": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_role ON user_preferences(role);
CREATE INDEX IF NOT EXISTS idx_user_preferences_company ON user_preferences(company_id);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3) user_companies (many-to-many assignment)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- =====================================================
-- 4) Row Level Security
-- =====================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper — checks admin without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_preferences
    WHERE user_id = auth.uid()
    AND role = 'system_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated, anon;

-- companies: anyone with a valid anon/auth session can read active companies
DROP POLICY IF EXISTS "Read active companies" ON companies;
CREATE POLICY "Read active companies" ON companies
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage companies" ON companies;
CREATE POLICY "Admins manage companies" ON companies
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- user_preferences: user can read/manage own row
DROP POLICY IF EXISTS "Users read own preferences" ON user_preferences;
CREATE POLICY "Users read own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all preferences" ON user_preferences;
CREATE POLICY "Admins read all preferences" ON user_preferences
  FOR SELECT USING (public.is_system_admin());

DROP POLICY IF EXISTS "Admins manage all preferences" ON user_preferences;
CREATE POLICY "Admins manage all preferences" ON user_preferences
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- user_companies: user reads own assignments, admins manage all
DROP POLICY IF EXISTS "Users read own company assignments" ON user_companies;
CREATE POLICY "Users read own company assignments" ON user_companies
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage company assignments" ON user_companies;
CREATE POLICY "Admins manage company assignments" ON user_companies
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- =====================================================
-- 5) User management helper functions (used by admin panel)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'role', 'user')::TEXT as role,
    au.created_at,
    au.last_sign_in_at
  FROM auth.users au
  ORDER BY au.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'user'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('role', p_role),
    NOW(),
    NOW(),
    '', '', '', ''
  )
  RETURNING id INTO new_user_id;

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::TEXT,
    jsonb_build_object('sub', new_user_id::TEXT, 'email', p_email),
    'email',
    NOW(), NOW(), NOW()
  );

  RETURN json_build_object('id', new_user_id, 'success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Email already registered');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id::UUID = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;

-- =====================================================
-- 6) Auto-create user_preferences row on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'company_technician')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
