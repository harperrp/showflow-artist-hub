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
