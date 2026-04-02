-- SQL consolidado do schema legado do Supabase
-- Gerado a partir de supabase/migrations em ordem cronológica.
-- Execute no projeto novo para recriar tabelas, funções, policies, triggers e extensões.

-- =====================================================================
-- MIGRATION: 20260122145852_4007d6a9-3f76-4c0a-8aba-f2e3ac985ef0.sql
-- SOURCE: supabase/migrations/20260122145852_4007d6a9-3f76-4c0a-8aba-f2e3ac985ef0.sql
-- =====================================================================
-- CRM + Calendário (Lovable Cloud)

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','comercial','financeiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('pending','signed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('negotiation','confirmed','blocked','hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.funnel_stage AS ENUM ('Prospecção','Contato','Proposta','Negociação','Contrato','Fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Timestamps helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3) Core tables
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  active_organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (user_id, role, organization_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_org_id_idx ON public.memberships(organization_id);

-- 4) CRM tables
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contractor_name text NOT NULL,
  city text,
  state text,
  fee numeric,
  stage public.funnel_stage NOT NULL DEFAULT 'Negociação',
  origin text,
  contact_phone text,
  contact_email text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_org_idx ON public.leads(organization_id);
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status public.contract_status NOT NULL DEFAULT 'pending',
  document_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_org_idx ON public.contracts(organization_id);
CREATE INDEX IF NOT EXISTS contracts_lead_idx ON public.contracts(lead_id);
CREATE TRIGGER contracts_set_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  status public.event_status NOT NULL DEFAULT 'negotiation',
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  city text,
  state text,
  fee numeric,
  stage public.funnel_stage,
  contract_status public.contract_status,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_events_org_idx ON public.calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS calendar_events_time_idx ON public.calendar_events(start_time);
CREATE TRIGGER calendar_events_set_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_member_of_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id AND m.organization_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id AND m.organization_id = _org_id AND m.role = _role
  );
$$;

-- 6) Conflict check for confirmed shows
CREATE OR REPLACE FUNCTION public.is_confirmed_date_available(
  _org_id uuid,
  _start timestamptz,
  _end timestamptz,
  _ignore_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.organization_id = _org_id
      AND e.status = 'confirmed'
      AND (_ignore_id IS NULL OR e.id <> _ignore_id)
      AND (
        -- overlap on start/end; if end is null treat as point event at start
        COALESCE(e.end_time, e.start_time) >= _start
        AND e.start_time <= COALESCE(_end, _start)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_calendar_event_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    IF NOT public.is_confirmed_date_available(NEW.organization_id, NEW.start_time, NEW.end_time, NEW.id) THEN
      RAISE EXCEPTION 'Data indisponível: já existe show confirmado no mesmo período.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_validate_conflicts ON public.calendar_events;
CREATE TRIGGER calendar_events_validate_conflicts
BEFORE INSERT OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.validate_calendar_event_conflicts();

-- 7) RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- organizations
DROP POLICY IF EXISTS "org_select" ON public.organizations;
CREATE POLICY "org_select"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_member_of_org(auth.uid(), id));

-- profiles (self)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- memberships
DROP POLICY IF EXISTS "memberships_select" ON public.memberships;
CREATE POLICY "memberships_select"
ON public.memberships FOR SELECT
TO authenticated
USING (public.is_member_of_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "memberships_insert_admin" ON public.memberships;
CREATE POLICY "memberships_insert_admin"
ON public.memberships FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  AND user_id <> auth.uid() -- prevent self-grant
);

DROP POLICY IF EXISTS "memberships_update_admin" ON public.memberships;
CREATE POLICY "memberships_update_admin"
ON public.memberships FOR UPDATE
TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "memberships_delete_admin" ON public.memberships;
CREATE POLICY "memberships_delete_admin"
ON public.memberships FOR DELETE
TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- leads
DROP POLICY IF EXISTS "leads_select_org" ON public.leads;
CREATE POLICY "leads_select_org"
ON public.leads FOR SELECT
TO authenticated
USING (public.is_member_of_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "leads_insert_commercial_admin" ON public.leads;
CREATE POLICY "leads_insert_commercial_admin"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "leads_update_commercial_admin" ON public.leads;
CREATE POLICY "leads_update_commercial_admin"
ON public.leads FOR UPDATE
TO authenticated
USING (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
)
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
);

-- contracts
DROP POLICY IF EXISTS "contracts_select_org" ON public.contracts;
CREATE POLICY "contracts_select_org"
ON public.contracts FOR SELECT
TO authenticated
USING (public.is_member_of_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "contracts_write_roles" ON public.contracts;
CREATE POLICY "contracts_write_roles"
ON public.contracts FOR INSERT
TO authenticated
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "contracts_update_roles" ON public.contracts;
CREATE POLICY "contracts_update_roles"
ON public.contracts FOR UPDATE
TO authenticated
USING (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
)
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
);

-- calendar events
DROP POLICY IF EXISTS "calendar_events_select_org" ON public.calendar_events;
CREATE POLICY "calendar_events_select_org"
ON public.calendar_events FOR SELECT
TO authenticated
USING (public.is_member_of_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "calendar_events_write_roles" ON public.calendar_events;
CREATE POLICY "calendar_events_write_roles"
ON public.calendar_events FOR INSERT
TO authenticated
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "calendar_events_update_roles" ON public.calendar_events;
CREATE POLICY "calendar_events_update_roles"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
)
WITH CHECK (
  public.is_member_of_org(auth.uid(), organization_id)
  AND (public.has_org_role(auth.uid(), organization_id, 'comercial') OR public.has_org_role(auth.uid(), organization_id, 'financeiro') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
);

-- 8) Bootstrap: create profile + org + admin membership on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- organization
  INSERT INTO public.organizations (name, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Rodrigo Lopes'), NEW.id)
  RETURNING id INTO org_id;

  -- membership (admin)
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'admin')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- set active org
  UPDATE public.profiles SET active_organization_id = org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- MIGRATION: 20260122171833_793e7d55-b970-4f96-ad75-64b8b55d851e.sql
-- SOURCE: supabase/migrations/20260122171833_793e7d55-b970-4f96-ad75-64b8b55d851e.sql
-- =====================================================================
-- Add missing columns to leads table for full CRM
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contractor_type TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add missing columns to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS fee NUMERIC;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Add latitude/longitude to calendar_events for map
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS contractor_name TEXT;

-- =====================================================================
-- MIGRATION: 20260206142506_78420b99-246d-49ec-9cbc-de359c733c3d.sql
-- SOURCE: supabase/migrations/20260206142506_78420b99-246d-49ec-9cbc-de359c733c3d.sql
-- =====================================================================
-- =============================================
-- CRM DATA ORGANIZATION: Tags, Contacts, Venues, Regions, Activity Logs
-- =============================================

-- =============================================
-- 1. CONTACTS TABLE (Independent from leads)
-- =============================================
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  role text,
  email text,
  phone text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX idx_contacts_name ON public.contacts(name);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_org" ON public.contacts
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "contacts_insert_org" ON public.contacts
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "contacts_update_org" ON public.contacts
  FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "contacts_delete_org" ON public.contacts
  FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- =============================================
-- 2. VENUES TABLE (Reusable locations)
-- =============================================
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  state text,
  address text,
  capacity integer,
  latitude numeric,
  longitude numeric,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_org ON public.venues(organization_id);
CREATE INDEX idx_venues_city ON public.venues(city);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_select_org" ON public.venues
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "venues_insert_org" ON public.venues
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "venues_update_org" ON public.venues
  FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "venues_delete_org" ON public.venues
  FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- =============================================
-- 3. REGIONS TABLE (Group cities into circuits)
-- =============================================
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_regions_org ON public.regions(organization_id);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regions_select_org" ON public.regions
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "regions_insert_org" ON public.regions
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "regions_update_org" ON public.regions
  FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "regions_delete_org" ON public.regions
  FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- =============================================
-- 4. REGION_CITIES TABLE (Many-to-many)
-- =============================================
CREATE TABLE public.region_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  city text NOT NULL,
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_region_cities_region ON public.region_cities(region_id);
CREATE UNIQUE INDEX idx_region_cities_unique ON public.region_cities(region_id, city, state);

ALTER TABLE public.region_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "region_cities_select" ON public.region_cities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.regions r
      WHERE r.id = region_id AND is_member_of_org(auth.uid(), r.organization_id)
    )
  );

CREATE POLICY "region_cities_insert" ON public.region_cities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.regions r
      WHERE r.id = region_id AND is_member_of_org(auth.uid(), r.organization_id)
    )
  );

CREATE POLICY "region_cities_delete" ON public.region_cities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.regions r
      WHERE r.id = region_id AND is_member_of_org(auth.uid(), r.organization_id)
    )
  );

-- =============================================
-- 5. TAGS TABLE (Flexible tagging system)
-- =============================================
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tags_org ON public.tags(organization_id);
CREATE UNIQUE INDEX idx_tags_unique_name ON public.tags(organization_id, name);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_org" ON public.tags
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "tags_insert_org" ON public.tags
  FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "tags_update_org" ON public.tags
  FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "tags_delete_org" ON public.tags
  FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- =============================================
-- 6. ENTITY_TAGS TABLE (Link tags to any entity)
-- =============================================
CREATE TYPE public.taggable_type AS ENUM ('lead', 'contact', 'venue', 'event');

CREATE TABLE public.entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type taggable_type NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_tags_entity ON public.entity_tags(entity_type, entity_id);
CREATE UNIQUE INDEX idx_entity_tags_unique ON public.entity_tags(tag_id, entity_type, entity_id);

ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_tags_select" ON public.entity_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.id = tag_id AND is_member_of_org(auth.uid(), t.organization_id)
    )
  );

CREATE POLICY "entity_tags_insert" ON public.entity_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.id = tag_id AND is_member_of_org(auth.uid(), t.organization_id)
    )
  );

CREATE POLICY "entity_tags_delete" ON public.entity_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.id = tag_id AND is_member_of_org(auth.uid(), t.organization_id)
    )
  );

-- =============================================
-- 7. ACTIVITY_LOGS TABLE (Audit trail)
-- =============================================
CREATE TYPE public.activity_action AS ENUM (
  'created', 'updated', 'deleted', 'stage_changed', 
  'status_changed', 'note_added', 'tag_added', 'tag_removed'
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action activity_action NOT NULL,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_org ON public.activity_logs(organization_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_org" ON public.activity_logs
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "activity_logs_insert_org" ON public.activity_logs
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  );

-- =============================================
-- 8. NOTES TABLE (Collaborative notes)
-- =============================================
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_entity ON public.notes(entity_type, entity_id);
CREATE INDEX idx_notes_org ON public.notes(organization_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_org" ON public.notes
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "notes_insert_org" ON public.notes
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "notes_update_own" ON public.notes
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "notes_delete_own" ON public.notes
  FOR DELETE USING (created_by = auth.uid());

-- =============================================
-- 9. ADD contact_id TO LEADS (Link leads to contacts)
-- =============================================
ALTER TABLE public.leads ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_contact ON public.leads(contact_id);
CREATE INDEX idx_leads_venue ON public.leads(venue_id);

-- =============================================
-- 10. ADD venue_id TO CALENDAR_EVENTS
-- =============================================
ALTER TABLE public.calendar_events ADD COLUMN venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX idx_events_venue ON public.calendar_events(venue_id);

-- =============================================
-- 11. TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- MIGRATION: 20260211114218_7eeb0be4-349e-4709-af6e-6dd350bd29cb.sql
-- SOURCE: supabase/migrations/20260211114218_7eeb0be4-349e-4709-af6e-6dd350bd29cb.sql
-- =====================================================================

-- Tasks table for pending tasks / to-do
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  entity_type TEXT,
  entity_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_org" ON public.tasks FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "tasks_insert_org" ON public.tasks FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "tasks_update_org" ON public.tasks FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id)) WITH CHECK (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "tasks_delete_org" ON public.tasks FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- Team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  role TEXT,
  category TEXT NOT NULL DEFAULT 'Músico' CHECK (category IN ('Músico', 'Técnico', 'Produção', 'Outro')),
  email TEXT,
  phone TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select_org" ON public.team_members FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "team_members_insert_org" ON public.team_members FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "team_members_update_org" ON public.team_members FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id)) WITH CHECK (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "team_members_delete_org" ON public.team_members FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  content TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_select_org" ON public.contract_templates FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "contract_templates_insert_org" ON public.contract_templates FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "contract_templates_update_org" ON public.contract_templates FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id)) WITH CHECK (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "contract_templates_delete_org" ON public.contract_templates FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- Riders técnicos table
CREATE TABLE public.riders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  document_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riders_select_org" ON public.riders FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "riders_insert_org" ON public.riders FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "riders_update_org" ON public.riders FOR UPDATE USING (is_member_of_org(auth.uid(), organization_id)) WITH CHECK (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "riders_delete_org" ON public.riders FOR DELETE USING (is_member_of_org(auth.uid(), organization_id));

-- Indexes
CREATE INDEX idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date) WHERE NOT is_completed;
CREATE INDEX idx_team_members_org ON public.team_members(organization_id);
CREATE INDEX idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX idx_riders_org ON public.riders(organization_id);

-- =====================================================================
-- MIGRATION: 20260221072145_081735e9-5841-4149-b409-d0efbee8dc7b.sql
-- SOURCE: supabase/migrations/20260221072145_081735e9-5841-4149-b409-d0efbee8dc7b.sql
-- =====================================================================

-- Add event_name column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_name text;

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- =====================================================================
-- MIGRATION: 20260224033854_0e5076ce-4f71-41f5-ba0a-31ae2d3b561d.sql
-- SOURCE: supabase/migrations/20260224033854_0e5076ce-4f71-41f5-ba0a-31ae2d3b561d.sql
-- =====================================================================

-- ═══════════════════════════════════════════
-- 1. lead_messages — histórico de mensagens WhatsApp
-- ═══════════════════════════════════════════
CREATE TABLE public.lead_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  wa_id text, -- phone number
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  message_text text,
  message_type text NOT NULL DEFAULT 'text', -- text, image, audio, reaction, etc.
  media_url text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_messages_lead_id ON public.lead_messages(lead_id);
CREATE INDEX idx_lead_messages_wa_id ON public.lead_messages(wa_id);

ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_messages_select_org" ON public.lead_messages
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "lead_messages_insert_org" ON public.lead_messages
  FOR INSERT WITH CHECK (is_member_of_org(auth.uid(), organization_id));

-- Allow service role (edge function) to insert via bypassing RLS (uses service_role key)
-- Real-time for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;

-- ═══════════════════════════════════════════
-- 2. finance_transactions — contas a receber/pagar
-- ═══════════════════════════════════════════
CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL DEFAULT 'Outros',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'canceled')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_transactions_due_date ON public.finance_transactions(due_date);
CREATE INDEX idx_finance_transactions_org ON public.finance_transactions(organization_id);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_select_org" ON public.finance_transactions
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "finance_insert_org" ON public.finance_transactions
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id) 
    AND (has_org_role(auth.uid(), organization_id, 'financeiro') 
      OR has_org_role(auth.uid(), organization_id, 'admin'))
    AND created_by = auth.uid()
  );

CREATE POLICY "finance_update_org" ON public.finance_transactions
  FOR UPDATE USING (
    is_member_of_org(auth.uid(), organization_id) 
    AND (has_org_role(auth.uid(), organization_id, 'financeiro') 
      OR has_org_role(auth.uid(), organization_id, 'admin'))
  ) WITH CHECK (
    is_member_of_org(auth.uid(), organization_id) 
    AND (has_org_role(auth.uid(), organization_id, 'financeiro') 
      OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "finance_delete_org" ON public.finance_transactions
  FOR DELETE USING (
    is_member_of_org(auth.uid(), organization_id) 
    AND has_org_role(auth.uid(), organization_id, 'admin')
  );

-- Trigger para updated_at automático
CREATE TRIGGER update_finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- 3. Índice adicional em leads(contact_phone) para lookup rápido do webhook
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_leads_contact_phone ON public.leads(contact_phone);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);

-- =====================================================================
-- MIGRATION: 20260224100000_create_on_auth_user_created_trigger.sql
-- SOURCE: supabase/migrations/20260224100000_create_on_auth_user_created_trigger.sql
-- =====================================================================
-- Create trigger to run profile/org bootstrap after a new auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- MIGRATION: 20260224103000_9b2f4f8f-legacy-to-events-payments.sql
-- SOURCE: supabase/migrations/20260224103000_9b2f4f8f-legacy-to-events-payments.sql
-- =====================================================================
-- ==============================================================
-- CRM v2: normalização de perfis/venues/leads/events/contracts/payments
-- + backfill de calendar_events/finance_transactions
-- ==============================================================

-- 1) Enums padronizados (português)
DO $$ BEGIN
  CREATE TYPE public.event_status_pt AS ENUM ('negociacao', 'confirmado', 'bloqueado', 'aguardando');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status_pt AS ENUM ('pendente', 'assinado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_type_pt AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status_pt AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Adaptações compatíveis nas tabelas existentes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'comercial';

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_id uuid;

-- 3) Nova tabela events (substitui calendar_events)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  status public.event_status_pt NOT NULL DEFAULT 'negociacao',
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  city text,
  state text,
  fee numeric,
  stage public.funnel_stage,
  contract_status public.contract_status_pt,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_event_id_fkey,
  ADD CONSTRAINT contracts_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

-- 4) Nova tabela payments (substitui finance_transactions)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  type public.payment_type_pt NOT NULL,
  category text NOT NULL DEFAULT 'Outros',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  vencimento date,
  paid_at date,
  status public.payment_status_pt NOT NULL DEFAULT 'pendente',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Índices básicos para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON public.venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_owner_id ON public.contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON public.events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_contract_id ON public.events(contract_id);

CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON public.payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_vencimento ON public.payments(vencimento);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON public.payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON public.payments(contract_id);

-- 6) Updated_at triggers
DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Backfill calendar_events -> events
INSERT INTO public.events (
  id,
  organization_id,
  owner_id,
  lead_id,
  venue_id,
  contract_id,
  status,
  title,
  start_at,
  end_at,
  city,
  state,
  fee,
  stage,
  contract_status,
  notes,
  created_by,
  created_at,
  updated_at
)
SELECT
  ce.id,
  ce.organization_id,
  ce.created_by AS owner_id,
  ce.lead_id,
  ce.venue_id,
  ce.contract_id,
  CASE ce.status
    WHEN 'negotiation' THEN 'negociacao'::public.event_status_pt
    WHEN 'confirmed' THEN 'confirmado'::public.event_status_pt
    WHEN 'blocked' THEN 'bloqueado'::public.event_status_pt
    ELSE 'aguardando'::public.event_status_pt
  END,
  ce.title,
  ce.start_time,
  ce.end_time,
  ce.city,
  ce.state,
  ce.fee,
  ce.stage,
  CASE ce.contract_status
    WHEN 'pending' THEN 'pendente'::public.contract_status_pt
    WHEN 'signed' THEN 'assinado'::public.contract_status_pt
    WHEN 'canceled' THEN 'cancelado'::public.contract_status_pt
    ELSE NULL
  END,
  ce.notes,
  ce.created_by,
  ce.created_at,
  ce.updated_at
FROM public.calendar_events ce
ON CONFLICT (id) DO NOTHING;

-- 8) Backfill finance_transactions -> payments
INSERT INTO public.payments (
  id,
  organization_id,
  owner_id,
  lead_id,
  contract_id,
  event_id,
  type,
  category,
  description,
  amount,
  vencimento,
  paid_at,
  status,
  notes,
  created_by,
  created_at,
  updated_at
)
SELECT
  ft.id,
  ft.organization_id,
  ft.created_by AS owner_id,
  ft.lead_id,
  ft.contract_id,
  c.event_id,
  CASE ft.type
    WHEN 'income' THEN 'receita'::public.payment_type_pt
    ELSE 'despesa'::public.payment_type_pt
  END,
  ft.category,
  ft.description,
  ft.amount,
  ft.due_date AS vencimento,
  ft.paid_at,
  CASE ft.status
    WHEN 'pending' THEN 'pendente'::public.payment_status_pt
    WHEN 'paid' THEN 'pago'::public.payment_status_pt
    WHEN 'overdue' THEN 'atrasado'::public.payment_status_pt
    ELSE 'cancelado'::public.payment_status_pt
  END,
  ft.notes,
  ft.created_by,
  ft.created_at,
  ft.updated_at
FROM public.finance_transactions ft
LEFT JOIN public.contracts c ON c.id = ft.contract_id
ON CONFLICT (id) DO NOTHING;

-- 9) Validação pós-migração
DO $$
DECLARE
  v_legacy_events bigint;
  v_new_events bigint;
  v_legacy_payments bigint;
  v_new_payments bigint;
BEGIN
  SELECT count(*) INTO v_legacy_events FROM public.calendar_events;
  SELECT count(*) INTO v_new_events FROM public.events;

  SELECT count(*) INTO v_legacy_payments FROM public.finance_transactions;
  SELECT count(*) INTO v_new_payments FROM public.payments;

  IF v_new_events < v_legacy_events THEN
    RAISE EXCEPTION 'Backfill incompleto: events(%) < calendar_events(%)', v_new_events, v_legacy_events;
  END IF;

  IF v_new_payments < v_legacy_payments THEN
    RAISE EXCEPTION 'Backfill incompleto: payments(%) < finance_transactions(%)', v_new_payments, v_legacy_payments;
  END IF;
END $$;

-- =====================================================================
-- MIGRATION: 20260225042332_18cc1b50-8bc1-4940-ad14-a72a31464c2c.sql
-- SOURCE: supabase/migrations/20260225042332_18cc1b50-8bc1-4940-ad14-a72a31464c2c.sql
-- =====================================================================

-- Create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default organization
  INSERT INTO public.organizations (id, name, created_by)
  VALUES (gen_random_uuid(), COALESCE(NEW.raw_user_meta_data->>'display_name', 'Minha Organização'), NEW.id)
  RETURNING id INTO _org_id;

  -- Add admin membership
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (_org_id, NEW.id, 'admin');

  -- Set active organization
  UPDATE public.profiles SET active_organization_id = _org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- MIGRATION: 20260226162047_4bd23e9d-da57-4a83-ba7a-f3a703cfc19a.sql
-- SOURCE: supabase/migrations/20260226162047_4bd23e9d-da57-4a83-ba7a-f3a703cfc19a.sql
-- =====================================================================

-- Add address fields to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS street_number text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS zip_code text;

-- =====================================================================
-- MIGRATION: 20260226182454_fe0b0ddc-fb0b-4f8e-add4-847cfa30b1fe.sql
-- SOURCE: supabase/migrations/20260226182454_fe0b0ddc-fb0b-4f8e-add4-847cfa30b1fe.sql
-- =====================================================================

-- 1. Payment Plans table
CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  event_id uuid REFERENCES public.calendar_events(id),
  total_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  model text NOT NULL CHECK (model IN ('avista', 'sinal_resto', 'parcelado')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, lead_id)
);

CREATE INDEX idx_payment_plans_org_lead ON public.payment_plans(organization_id, lead_id);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_select_org" ON public.payment_plans FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "pp_insert_org" ON public.payment_plans FOR INSERT WITH CHECK (
  is_member_of_org(auth.uid(), organization_id)
  AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'comercial'))
  AND created_by = auth.uid()
);
CREATE POLICY "pp_update_org" ON public.payment_plans FOR UPDATE
  USING (is_member_of_org(auth.uid(), organization_id) AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin')))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "pp_delete_org" ON public.payment_plans FOR DELETE USING (
  is_member_of_org(auth.uid(), organization_id) AND has_org_role(auth.uid(), organization_id, 'admin')
);

-- 2. Payment Installments table
CREATE TABLE public.payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  payment_plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, payment_plan_id, installment_number)
);

CREATE INDEX idx_installments_org_status ON public.payment_installments(organization_id, status);
CREATE INDEX idx_installments_org_due ON public.payment_installments(organization_id, due_date);
CREATE INDEX idx_installments_plan ON public.payment_installments(organization_id, payment_plan_id);

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi_select_org" ON public.payment_installments FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "pi_insert_org" ON public.payment_installments FOR INSERT WITH CHECK (
  is_member_of_org(auth.uid(), organization_id)
  AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'comercial'))
  AND created_by = auth.uid()
);
CREATE POLICY "pi_update_org" ON public.payment_installments FOR UPDATE
  USING (is_member_of_org(auth.uid(), organization_id) AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin')))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id) AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "pi_delete_org" ON public.payment_installments FOR DELETE USING (
  is_member_of_org(auth.uid(), organization_id) AND has_org_role(auth.uid(), organization_id, 'admin')
);

-- 3. Payment Receipts table
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  installment_id uuid NOT NULL REFERENCES public.payment_installments(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX idx_receipts_org_inst ON public.payment_receipts(organization_id, installment_id);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select_org" ON public.payment_receipts FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "pr_insert_org" ON public.payment_receipts FOR INSERT WITH CHECK (
  is_member_of_org(auth.uid(), organization_id)
  AND (has_org_role(auth.uid(), organization_id, 'financeiro') OR has_org_role(auth.uid(), organization_id, 'admin'))
  AND uploaded_by = auth.uid()
);
CREATE POLICY "pr_delete_org" ON public.payment_receipts FOR DELETE USING (
  is_member_of_org(auth.uid(), organization_id) AND has_org_role(auth.uid(), organization_id, 'admin')
);

-- 4. Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "receipts_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'receipts' AND is_member_of_org(auth.uid(), (storage.foldername(name))[2]::uuid)
);
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'receipts' AND is_member_of_org(auth.uid(), (storage.foldername(name))[2]::uuid)
);
CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'receipts' AND is_member_of_org(auth.uid(), (storage.foldername(name))[2]::uuid)
);

-- 5. View: lead_financial_summary
CREATE OR REPLACE VIEW public.lead_financial_summary AS
SELECT
  pp.organization_id,
  pp.lead_id,
  pp.id AS payment_plan_id,
  pp.total_amount,
  pp.model,
  COALESCE(SUM(CASE WHEN pi.status = 'pago' THEN COALESCE(pi.paid_amount, pi.amount) ELSE 0 END), 0) AS received_amount,
  pp.total_amount - COALESCE(SUM(CASE WHEN pi.status = 'pago' THEN COALESCE(pi.paid_amount, pi.amount) ELSE 0 END), 0) AS remaining_amount,
  COALESCE(COUNT(*) FILTER (WHERE pi.status IN ('pendente', 'atrasado') AND pi.due_date < CURRENT_DATE), 0)::int AS overdue_count,
  MIN(CASE WHEN pi.status IN ('pendente', 'atrasado') THEN pi.due_date END) AS next_due_date,
  CASE
    WHEN COALESCE(COUNT(*) FILTER (WHERE pi.status IN ('pendente', 'atrasado') AND pi.due_date < CURRENT_DATE), 0) > 0 THEN 'atrasado'
    WHEN COALESCE(SUM(CASE WHEN pi.status = 'pago' THEN COALESCE(pi.paid_amount, pi.amount) ELSE 0 END), 0) >= pp.total_amount THEN 'pago'
    WHEN COALESCE(SUM(CASE WHEN pi.status = 'pago' THEN COALESCE(pi.paid_amount, pi.amount) ELSE 0 END), 0) > 0 THEN 'parcial'
    ELSE 'nao_pago'
  END AS payment_status,
  COUNT(pi.id)::int AS total_installments,
  COUNT(*) FILTER (WHERE pi.status = 'pago')::int AS paid_installments
FROM public.payment_plans pp
LEFT JOIN public.payment_installments pi ON pi.payment_plan_id = pp.id AND pi.status != 'cancelado'
GROUP BY pp.id, pp.organization_id, pp.lead_id, pp.total_amount, pp.model;

-- 6. Triggers for updated_at
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_installments_updated_at BEFORE UPDATE ON public.payment_installments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Function to auto-mark overdue installments
CREATE OR REPLACE FUNCTION public.mark_overdue_installments(_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.payment_installments
  SET status = 'atrasado', updated_at = now()
  WHERE organization_id = _org_id
    AND status = 'pendente'
    AND due_date < CURRENT_DATE;
$$;

-- =====================================================================
-- MIGRATION: 20260226192059_bd9b5d63-ece7-44d1-be25-4a38a8185e69.sql
-- SOURCE: supabase/migrations/20260226192059_bd9b5d63-ece7-44d1-be25-4a38a8185e69.sql
-- =====================================================================

-- Add 'artista' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'artista';

-- Create notifications table for in-app task notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'task_assigned',
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_org"
  ON public.notifications FOR INSERT
  WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE NOT is_read;

-- =====================================================================
-- MIGRATION: 20260226192923_d5641801-5ed2-4dbf-9378-43d94a4486ae.sql
-- SOURCE: supabase/migrations/20260226192923_d5641801-5ed2-4dbf-9378-43d94a4486ae.sql
-- =====================================================================

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- =====================================================================
-- MIGRATION: 20260226211646_7ebbfa80-2139-435d-8a0e-142acb096366.sql
-- SOURCE: supabase/migrations/20260226211646_7ebbfa80-2139-435d-8a0e-142acb096366.sql
-- =====================================================================

-- Super admins table (SaaS owner level)
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can read this table
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.super_admins WHERE user_id = _user_id);
$$;

CREATE POLICY "super_admins_select" ON public.super_admins
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Subscriptions table (MVP - simulated)
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(organization_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can see their own subscription
CREATE POLICY "sub_select_org" ON public.subscriptions
FOR SELECT TO authenticated
USING (is_member_of_org(auth.uid(), organization_id));

-- Super admins can see all subscriptions
CREATE POLICY "sub_select_super" ON public.subscriptions
FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admin can read ALL organizations
CREATE POLICY "org_select_super" ON public.organizations
FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admin can read ALL profiles
CREATE POLICY "profiles_select_super" ON public.profiles
FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admin can read ALL memberships
CREATE POLICY "memberships_select_super" ON public.memberships
FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admin can update memberships (e.g. disable orgs)
CREATE POLICY "memberships_update_super" ON public.memberships
FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Super admin can insert/update subscriptions
CREATE POLICY "sub_insert_super" ON public.subscriptions
FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "sub_update_super" ON public.subscriptions
FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Auto-create subscription on new org (via trigger update)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default organization
  INSERT INTO public.organizations (id, name, created_by)
  VALUES (gen_random_uuid(), COALESCE(NEW.raw_user_meta_data->>'display_name', 'Minha Organização'), NEW.id)
  RETURNING id INTO _org_id;

  -- Add admin membership (owner of their org)
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (_org_id, NEW.id, 'admin');

  -- Set active organization
  UPDATE public.profiles SET active_organization_id = _org_id WHERE id = NEW.id;

  -- Create starter subscription (MVP)
  INSERT INTO public.subscriptions (organization_id, plan, status)
  VALUES (_org_id, COALESCE(NEW.raw_user_meta_data->>'plan', 'starter'), 'active');

  RETURN NEW;
END;
$$;

-- =====================================================================
-- MIGRATION: 20260303210751_24c758b9-3bb4-4654-b441-be1c4d732629.sql
-- SOURCE: supabase/migrations/20260303210751_24c758b9-3bb4-4654-b441-be1c4d732629.sql
-- =====================================================================

-- 1. Create funnel_stages table for dynamic stage management per organization
CREATE TABLE public.funnel_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel_stages_select_org" ON public.funnel_stages
  FOR SELECT USING (is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "funnel_stages_insert_admin" ON public.funnel_stages
  FOR INSERT WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND (has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'comercial'))
  );

CREATE POLICY "funnel_stages_update_admin" ON public.funnel_stages
  FOR UPDATE USING (
    is_member_of_org(auth.uid(), organization_id)
    AND (has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'comercial'))
  ) WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
    AND (has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'comercial'))
  );

CREATE POLICY "funnel_stages_delete_admin" ON public.funnel_stages
  FOR DELETE USING (
    is_member_of_org(auth.uid(), organization_id)
    AND has_org_role(auth.uid(), organization_id, 'admin')
  );

-- 2. Convert leads.stage from enum to text
ALTER TABLE public.leads ALTER COLUMN stage TYPE text USING stage::text;
ALTER TABLE public.leads ALTER COLUMN stage SET DEFAULT 'Prospecção';

-- 3. Convert calendar_events.stage from enum to text  
ALTER TABLE public.calendar_events ALTER COLUMN stage TYPE text USING stage::text;

-- 4. Drop the old enum type (no longer needed)
DROP TYPE IF EXISTS public.funnel_stage;

-- 5. Create trigger for updated_at on funnel_stages
CREATE TRIGGER update_funnel_stages_updated_at
  BEFORE UPDATE ON public.funnel_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed default stages for all existing organizations
INSERT INTO public.funnel_stages (organization_id, name, position, color)
SELECT o.id, s.name, s.position, s.color
FROM public.organizations o
CROSS JOIN (VALUES
  ('Prospecção', 0, '#64748b'),
  ('Contato', 1, '#3b82f6'),
  ('Proposta', 2, '#8b5cf6'),
  ('Negociação', 3, '#eab308'),
  ('Contrato', 4, '#f97316'),
  ('Fechado', 5, '#22c55e')
) AS s(name, position, color)
ON CONFLICT (organization_id, name) DO NOTHING;

-- 7. Update handle_new_user to seed stages for new orgs
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default organization
  INSERT INTO public.organizations (id, name, created_by)
  VALUES (gen_random_uuid(), COALESCE(NEW.raw_user_meta_data->>'display_name', 'Minha Organização'), NEW.id)
  RETURNING id INTO _org_id;

  -- Add admin membership
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (_org_id, NEW.id, 'admin');

  -- Set active organization
  UPDATE public.profiles SET active_organization_id = _org_id WHERE id = NEW.id;

  -- Create starter subscription
  INSERT INTO public.subscriptions (organization_id, plan, status)
  VALUES (_org_id, COALESCE(NEW.raw_user_meta_data->>'plan', 'starter'), 'active');

  -- Seed default funnel stages
  INSERT INTO public.funnel_stages (organization_id, name, position, color) VALUES
    (_org_id, 'Prospecção', 0, '#64748b'),
    (_org_id, 'Contato', 1, '#3b82f6'),
    (_org_id, 'Proposta', 2, '#8b5cf6'),
    (_org_id, 'Negociação', 3, '#eab308'),
    (_org_id, 'Contrato', 4, '#f97316'),
    (_org_id, 'Fechado', 5, '#22c55e');

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- MIGRATION: 20260328044229_8e07ce19-ccdb-4ac4-96c4-4343c0e91a26.sql
-- SOURCE: supabase/migrations/20260328044229_8e07ce19-ccdb-4ac4-96c4-4343c0e91a26.sql
-- =====================================================================

-- Conversations table (groups messages by contact/lead)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_phone text NOT NULL,
  contact_name text,
  last_message_at timestamptz DEFAULT now(),
  last_message_text text,
  unread_count int DEFAULT 0,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_select_org" ON public.conversations FOR SELECT TO authenticated
  USING (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "conv_insert_org" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));
CREATE POLICY "conv_update_org" ON public.conversations FOR UPDATE TO authenticated
  USING (is_member_of_org(auth.uid(), organization_id))
  WITH CHECK (is_member_of_org(auth.uid(), organization_id));

-- Add conversation_id to lead_messages
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Enable realtime for conversations and lead_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
