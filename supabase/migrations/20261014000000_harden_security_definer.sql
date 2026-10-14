-- ==============================================================================
-- Lead Hunter Kazakhstan — Security Hardening Migration
-- Migration: 20261014000000_harden_security_definer.sql
-- Description: Hardens handle_new_user() function with explicit search_path
--              and restricts execution privileges to required system roles.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, default_language)
  VALUES (NEW.id, 'ru')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Revoke default execute permissions from public and untrusted roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

-- Grant execute strictly to postgres (owner) and supabase_auth_admin (auth service)
-- NOTE: service_role is intentionally NOT granted EXECUTE following Principle of Least Privilege,
-- as all user creation triggers fire exclusively under supabase_auth_admin or postgres.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

