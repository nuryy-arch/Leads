-- ==============================================================================
-- Lead Hunter Kazakhstan — Supabase PostgreSQL Schema Migration
-- Migration: 20261013000000_init_schema.sql
-- Description: Creates profiles, leads, user_settings tables with strict RLS
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. LEADS TABLE (Cloud CRM Contacts)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT, -- Original client-side ID (e.g. lead-2gis-...)
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  phone_raw TEXT DEFAULT '',
  phone_formatted TEXT DEFAULT '',
  is_valid_phone BOOLEAN DEFAULT false,
  phone_error TEXT,
  city TEXT NOT NULL,
  address TEXT,
  coordinates JSONB,
  website_status TEXT NOT NULL DEFAULT 'NO_WEBSITE_LISTED',
  website_url TEXT,
  external_url TEXT,
  external_id TEXT,
  source TEXT DEFAULT 'MANUAL',
  sources JSONB DEFAULT '[]'::jsonb,
  duplicate_flag TEXT,
  possible_duplicate_of TEXT,
  merged_count INTEGER DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'ru',
  custom_message TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  score JSONB,
  user_edited_fields TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT leads_user_client_unique UNIQUE (user_id, client_id)
);

-- 3. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_language TEXT DEFAULT 'ru',
  search_preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR FAST QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON public.leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_user_city ON public.leads(user_id, city);
CREATE INDEX IF NOT EXISTS idx_leads_user_created ON public.leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_client_id ON public.leads(user_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_user_client_id_unique ON public.leads(user_id, client_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — STRICT ISOLATION
-- ==============================================================================

-- Enable RLS on all user tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies (auth.uid() = id)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Leads Policies (auth.uid() = user_id)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- User Settings Policies (auth.uid() = user_id)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
