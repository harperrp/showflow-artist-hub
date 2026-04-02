// ── CRM Type Definitions ──
// All shared types for the CRM system. Keep in sync with DB schema.

export interface Lead {
  id: string;
  organization_id: string;
  contractor_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  city?: string | null;
  state?: string | null;
  origin?: string | null;
  stage: string;
  fee?: number | null;
  event_date?: string | null;
  event_name?: string | null;
  notes?: string | null;
  venue_name?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  lead_id?: string | null;
  contact_phone: string;
  contact_name?: string | null;
  last_message_at: string;
  last_message_text?: string | null;
  unread_count: number;
  status: string;
  created_at: string;
  stage?: string | null;
  // Joined
  lead?: Lead | null;
}

export interface Message {
  id: string;
  lead_id: string;
  organization_id: string;
  conversation_id?: string | null;
  direction: "inbound" | "outbound";
  message_text?: string | null;
  message_type: string;
  media_url?: string | null;
  wa_id?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  status?: string | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  color: string;
}

export interface CalendarEvent {
  id: string;
  organization_id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  lead_id?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  status: string;
  fee?: number | null;
  created_by: string;
  created_at: string;
}

export interface DashboardStats {
  totalLeads: number;
  totalConversations: number;
  openDeals: number;
  closedDeals: number;
}

export type WhatsAppStatus = "disconnected" | "connecting" | "connected" | "qr_ready";
