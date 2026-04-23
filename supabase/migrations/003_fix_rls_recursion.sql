-- =====================================================
-- VMS - Hotfix: RLS recursion on user_preferences / companies
-- Run this ONCE against an existing DB to fix the login role bug.
-- Safe to run multiple times.
-- =====================================================

-- Helper: returns true if current user is system_admin, no RLS recursion.
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

-- Drop old self-referential policies
DROP POLICY IF EXISTS "Admins read all preferences" ON user_preferences;
DROP POLICY IF EXISTS "Admins manage all preferences" ON user_preferences;
DROP POLICY IF EXISTS "Admins manage companies" ON companies;
DROP POLICY IF EXISTS "Admins manage company assignments" ON user_companies;

-- Recreate using the SECURITY DEFINER helper
CREATE POLICY "Admins read all preferences" ON user_preferences
  FOR SELECT USING (public.is_system_admin());

CREATE POLICY "Admins manage all preferences" ON user_preferences
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE POLICY "Admins manage companies" ON companies
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE POLICY "Admins manage company assignments" ON user_companies
  FOR ALL USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());
