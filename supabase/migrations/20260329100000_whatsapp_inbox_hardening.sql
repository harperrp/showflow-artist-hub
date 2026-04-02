-- WhatsApp CRM hardening: schema alignment + robust RPC

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- contacts alignment
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.contacts ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN phone SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone_unique ON public.contacts(organization_id, phone);
DO $$ BEGIN
  ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads alignment
ALTER TABLE public.leads ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_phone text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_message text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.leads ALTER COLUMN origin SET DEFAULT 'WhatsApp';
CREATE INDEX IF NOT EXISTS idx_leads_org_last_message_at ON public.leads(organization_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_leads_org_unread ON public.leads(organization_id, unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_leads_org_whatsapp_phone ON public.leads(organization_id, whatsapp_phone);
DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- lead_messages alignment
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS raw_payload jsonb;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS wa_id text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS message_text text;
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound';
DO $$ BEGIN
  ALTER TABLE public.lead_messages DROP CONSTRAINT IF EXISTS lead_messages_direction_check;
  ALTER TABLE public.lead_messages ADD CONSTRAINT lead_messages_direction_check CHECK (direction IN ('inbound','outbound'));
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_lead_messages_org_lead_created ON public.lead_messages(organization_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_messages_provider_id ON public.lead_messages(provider_message_id);

-- lead_interactions alignment
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text,
  content text,
  payload jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS lead_id uuid;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.lead_interactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_interactions' AND column_name='type'
  ) THEN
    EXECUTE 'UPDATE public.lead_interactions SET event_type = COALESCE(event_type, type)';
  END IF;
END $$;
ALTER TABLE public.lead_interactions ALTER COLUMN event_type SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_interactions_org_lead_created ON public.lead_interactions(organization_id, lead_id, created_at DESC);

-- realtime tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_interactions;

-- robust RPC
CREATE OR REPLACE FUNCTION public.register_whatsapp_inbound(
  _organization_id uuid,
  _lead_id uuid DEFAULT NULL,
  _phone text DEFAULT NULL,
  _message_text text DEFAULT NULL,
  _message_type text DEFAULT 'text',
  _provider text DEFAULT NULL,
  _provider_message_id text DEFAULT NULL,
  _status text DEFAULT NULL,
  _raw_payload jsonb DEFAULT NULL,
  _delivered_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  v_lead_id := _lead_id;

  IF v_lead_id IS NULL THEN
    SELECT l.id INTO v_lead_id
    FROM public.leads l
    WHERE l.organization_id = _organization_id
      AND (_phone IS NOT NULL AND (l.whatsapp_phone = _phone OR l.contact_phone = _phone))
    ORDER BY l.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'updated', false, 'reason', 'lead_not_found');
  END IF;

  UPDATE public.leads
  SET last_message = COALESCE(_message_text, last_message),
      last_message_at = COALESCE(_delivered_at, now()),
      last_contact_at = COALESCE(_delivered_at, now()),
      unread_count = unread_count + 1,
      updated_at = now()
  WHERE id = v_lead_id;

  INSERT INTO public.lead_interactions (organization_id, lead_id, event_type, channel, content, payload, metadata)
  VALUES (
    _organization_id,
    v_lead_id,
    'message_received',
    'whatsapp',
    _message_text,
    _raw_payload,
    jsonb_build_object(
      'provider', _provider,
      'provider_message_id', _provider_message_id,
      'status', _status,
      'message_type', _message_type
    )
  );

  RETURN jsonb_build_object('ok', true, 'updated', true, 'lead_id', v_lead_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'updated', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_lead_conversation_read(_lead_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.leads SET unread_count = 0, updated_at = now() WHERE id = _lead_id;
$$;
