
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
