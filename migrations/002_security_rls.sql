-- ============================================================================
-- 002_security_rls.sql
-- Enterprise Row Level Security (RLS) & Access Control Policies for Sasi Portfolio
-- Enforces Zero-Trust, Least-Privilege, Owner Safeguards, and Privacy
-- ============================================================================

-- 1. Helper Security Functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check JWT app_metadata for authenticated role
  v_role := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role');
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Fallback check user_profiles table for auth.uid()
  SELECT role INTO v_role 
  FROM public.user_profiles 
  WHERE auth_user_id = auth.uid() AND status = 'active' 
  LIMIT 1;

  RETURN COALESCE(v_role, 'anon');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() = 'owner';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() IN ('owner', 'super_admin', 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_editor_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() IN ('owner', 'super_admin', 'admin', 'editor');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Owner Demotion Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INT;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR 
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.status != 'active')) THEN
    SELECT COUNT(*) INTO owner_count 
    FROM public.user_profiles 
    WHERE role = 'owner' AND status = 'active' AND id != OLD.id;
    
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Security Policy Violation: Cannot delete or demote the last remaining active Owner account.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_owner ON public.user_profiles;
CREATE TRIGGER trg_protect_last_owner
BEFORE UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES — LEAST PRIVILEGE ENFORCEMENT
-- ============================================================================

-- Table: portfolio_settings
-- Public can only read public settings; Editors/Admins/Owners can read all; Admins/Owners can mutate
DROP POLICY IF EXISTS "settings_public_read" ON public.portfolio_settings;
CREATE POLICY "settings_public_read" ON public.portfolio_settings
FOR SELECT USING (is_public = TRUE OR public.is_editor_or_above());

DROP POLICY IF EXISTS "settings_admin_insert" ON public.portfolio_settings;
CREATE POLICY "settings_admin_insert" ON public.portfolio_settings
FOR INSERT WITH CHECK (public.is_admin_or_owner());

DROP POLICY IF EXISTS "settings_admin_update" ON public.portfolio_settings;
CREATE POLICY "settings_admin_update" ON public.portfolio_settings
FOR UPDATE USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "settings_admin_delete" ON public.portfolio_settings;
CREATE POLICY "settings_admin_delete" ON public.portfolio_settings
FOR DELETE USING (public.is_admin_or_owner());

-- Table: themes
-- Public can read published themes; Admins/Owners manage themes
DROP POLICY IF EXISTS "themes_read" ON public.themes;
CREATE POLICY "themes_read" ON public.themes
FOR SELECT USING (is_draft = FALSE OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "themes_admin_all" ON public.themes;
CREATE POLICY "themes_admin_all" ON public.themes
FOR ALL USING (public.is_admin_or_owner());

-- Table: sections
-- Public can read visible sections; Admins/Owners manage sections
DROP POLICY IF EXISTS "sections_read" ON public.sections;
CREATE POLICY "sections_read" ON public.sections
FOR SELECT USING (is_visible = TRUE OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "sections_admin_all" ON public.sections;
CREATE POLICY "sections_admin_all" ON public.sections
FOR ALL USING (public.is_admin_or_owner());

-- Table: portfolio_projects
-- Public can only read published projects; Editors/Admins/Owners can manage
DROP POLICY IF EXISTS "projects_public_read" ON public.portfolio_projects;
CREATE POLICY "projects_public_read" ON public.portfolio_projects
FOR SELECT USING (status = 'published' OR public.is_editor_or_above());

DROP POLICY IF EXISTS "projects_editor_insert" ON public.portfolio_projects;
CREATE POLICY "projects_editor_insert" ON public.portfolio_projects
FOR INSERT WITH CHECK (public.is_editor_or_above());

DROP POLICY IF EXISTS "projects_editor_update" ON public.portfolio_projects;
CREATE POLICY "projects_editor_update" ON public.portfolio_projects
FOR UPDATE USING (public.is_editor_or_above());

DROP POLICY IF EXISTS "projects_admin_delete" ON public.portfolio_projects;
CREATE POLICY "projects_admin_delete" ON public.portfolio_projects
FOR DELETE USING (public.is_admin_or_owner());

-- Table: media_library
-- Public can read media records; Editors/Admins/Owners can upload & manage
DROP POLICY IF EXISTS "media_public_read" ON public.media_library;
CREATE POLICY "media_public_read" ON public.media_library
FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "media_editor_insert" ON public.media_library;
CREATE POLICY "media_editor_insert" ON public.media_library
FOR INSERT WITH CHECK (public.is_editor_or_above());

DROP POLICY IF EXISTS "media_editor_update" ON public.media_library;
CREATE POLICY "media_editor_update" ON public.media_library
FOR UPDATE USING (public.is_editor_or_above());

DROP POLICY IF EXISTS "media_admin_delete" ON public.media_library;
CREATE POLICY "media_admin_delete" ON public.media_library
FOR DELETE USING (public.is_admin_or_owner());

-- Table: contact_inquiries (CRITICAL PRIVACY FIX)
-- Public can ONLY INSERT validated contact inquiries; NEVER SELECT, UPDATE or DELETE
DROP POLICY IF EXISTS "contact_public_insert" ON public.contact_inquiries;
CREATE POLICY "contact_public_insert" ON public.contact_inquiries
FOR INSERT WITH CHECK (
  length(trim(name)) >= 2 AND 
  length(trim(email)) >= 5 AND 
  length(trim(message)) >= 5
);

DROP POLICY IF EXISTS "contact_admin_read" ON public.contact_inquiries;
CREATE POLICY "contact_admin_read" ON public.contact_inquiries
FOR SELECT USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "contact_admin_update" ON public.contact_inquiries;
CREATE POLICY "contact_admin_update" ON public.contact_inquiries
FOR UPDATE USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "contact_admin_delete" ON public.contact_inquiries;
CREATE POLICY "contact_admin_delete" ON public.contact_inquiries
FOR DELETE USING (public.is_admin_or_owner());

-- Table: user_profiles
-- Users can read their own profile; Admins/Owners can read all; Only Owner can change roles
DROP POLICY IF EXISTS "users_self_or_admin_read" ON public.user_profiles;
CREATE POLICY "users_self_or_admin_read" ON public.user_profiles
FOR SELECT USING (auth.uid() = auth_user_id OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "users_owner_manage" ON public.user_profiles;
CREATE POLICY "users_owner_manage" ON public.user_profiles
FOR ALL USING (public.is_owner());

-- Table: activity_logs
-- Only Admins and Owners can view activity logs; System can insert; Logs are immutable
DROP POLICY IF EXISTS "logs_admin_read" ON public.activity_logs;
CREATE POLICY "logs_admin_read" ON public.activity_logs
FOR SELECT USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "logs_system_insert" ON public.activity_logs;
CREATE POLICY "logs_system_insert" ON public.activity_logs
FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- 5. REALTIME REPLICATION FOR SAFE TABLES ONLY
-- Sensitive tables (contact inquiries, user profiles, activity logs) are excluded
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_settings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.themes;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_projects;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_library;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
