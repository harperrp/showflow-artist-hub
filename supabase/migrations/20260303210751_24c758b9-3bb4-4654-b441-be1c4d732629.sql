
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
