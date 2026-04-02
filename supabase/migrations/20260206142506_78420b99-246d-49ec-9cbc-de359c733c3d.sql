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