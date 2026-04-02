// ── Service Layer ──
// All database access goes through here. Components NEVER import supabase directly.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Lead, Conversation, Message, PipelineStage, CalendarEvent } from "@/types/crm";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type FunnelStageRow = Database["public"]["Tables"]["funnel_stages"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type LeadMessageRow = Database["public"]["Tables"]["lead_messages"]["Row"];
type LeadInteractionRow = {
  id: string;
  lead_id: string | null;
  organization_id: string | null;
  type: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];

type LeadConversationRow = Pick<
  LeadRow,
  | "id"
  | "organization_id"
  | "contractor_name"
  | "stage"
  | "contact_phone"
  | "whatsapp_phone"
  | "last_message"
  | "last_message_at"
  | "unread_count"
  | "created_at"
>;

function assertRequiredId(value: string | null | undefined, label: string): string {
  if (!value) {
    throw new Error(`${label} é obrigatório`);
  }

  return value;
}

function mapLeadRowToConversation(lead: LeadConversationRow): Conversation {
  return {
    id: lead.id,
    organization_id: lead.organization_id,
    lead_id: lead.id,
    contact_phone: lead.whatsapp_phone || lead.contact_phone || "",
    contact_name: lead.contractor_name,
    last_message_at: lead.last_message_at || lead.created_at,
    last_message_text: lead.last_message,
    unread_count: lead.unread_count ?? 0,
    status: "open",
    created_at: lead.created_at,
    lead: lead as unknown as Lead,
    stage: lead.stage,
  };
}

function mapConversationUpdatesToLeadUpdates(updates: Partial<Conversation>): LeadUpdate {
  const leadUpdates: LeadUpdate = {};

  if (updates.last_message_text !== undefined) {
    leadUpdates.last_message = updates.last_message_text;
  }

  if (updates.last_message_at !== undefined) {
    leadUpdates.last_message_at = updates.last_message_at;
  }

  if (updates.unread_count !== undefined) {
    leadUpdates.unread_count = updates.unread_count;
  }

  if (updates.contact_phone !== undefined) {
    leadUpdates.contact_phone = updates.contact_phone;
  }

  if (updates.stage !== undefined) {
    leadUpdates.stage = updates.stage;
  }

  return leadUpdates;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId: string): Promise<Pick<ProfileRow, "id" | "email" | "display_name" | "active_organization_id"> | null> {
  const requiredUserId = assertRequiredId(userId, "userId");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, active_organization_id")
    .eq("id", requiredUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchLeads(orgId: string): Promise<Lead[]> {
  const requiredOrgId = assertRequiredId(orgId, "organization_id");

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", requiredOrgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function createLead(lead: Partial<Lead> & { organization_id: string; contractor_name: string; created_by: string }) {
  const payload: LeadInsert = {
    ...lead,
    organization_id: assertRequiredId(lead.organization_id, "organization_id"),
    contractor_name: assertRequiredId(lead.contractor_name, "contractor_name"),
    created_by: assertRequiredId(lead.created_by, "created_by"),
  } as LeadInsert;

  const { data, error } = await supabase.from("leads").insert(payload).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const requiredLeadId = assertRequiredId(id, "lead_id");

  const { data, error } = await supabase
    .from("leads")
    .update(updates as LeadUpdate)
    .eq("id", requiredLeadId)
    .select()
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function fetchStages(orgId: string): Promise<PipelineStage[]> {
  const requiredOrgId = assertRequiredId(orgId, "organization_id");

  const { data, error } = await supabase
    .from("funnel_stages")
    .select("*")
    .eq("organization_id", requiredOrgId)
    .order("position");

  if (error) throw error;
  return (data ?? []) as FunnelStageRow[] as PipelineStage[];
}

export async function fetchConversations(orgId: string): Promise<Conversation[]> {
  const requiredOrgId = assertRequiredId(orgId, "organization_id");

  const { data, error } = await supabase
    .from("leads")
    .select("id, organization_id, contractor_name, stage, contact_phone, whatsapp_phone, last_message, last_message_at, unread_count, created_at")
    .eq("organization_id", requiredOrgId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  return ((data ?? []) as LeadConversationRow[]).map(mapLeadRowToConversation);
}

export async function updateConversation(id: string, updates: Partial<Conversation>) {
  const requiredLeadId = assertRequiredId(id, "lead_id");
  const leadUpdates = mapConversationUpdatesToLeadUpdates(updates);

  if (Object.keys(leadUpdates).length === 0) {
    return;
  }

  const { error } = await supabase.from("leads").update(leadUpdates).eq("id", requiredLeadId);
  if (error) throw error;
}

export async function markConversationRead(leadId: string) {
  const requiredLeadId = assertRequiredId(leadId, "lead_id");

  const { error } = await supabase
    .from("leads")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", requiredLeadId);

  if (error) throw error;
}

export async function fetchNotes(entityId: string): Promise<NoteRow[]> {
  const requiredEntityId = assertRequiredId(entityId, "entity_id");

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("entity_id", requiredEntityId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createNote(note: { organization_id: string; entity_id: string; entity_type: string; content: string; created_by: string }) {
  const payload: NoteInsert = {
    ...note,
    organization_id: assertRequiredId(note.organization_id, "organization_id"),
    entity_id: assertRequiredId(note.entity_id, "entity_id"),
    entity_type: assertRequiredId(note.entity_type, "entity_type"),
    content: assertRequiredId(note.content, "content"),
    created_by: assertRequiredId(note.created_by, "created_by"),
  };

  const { data, error } = await supabase.from("notes").insert(payload).select().single();
  if (error) throw error;
  return data;
}

function mapLeadInteractionRowToMessage(row: LeadInteractionRow): Message | null {
  const type = row.type ?? "";
  const metadata = row.metadata ?? {};

  if (type !== "message_sent" && type !== "message_received") {
    return null;
  }

  return {
    id: row.id,
    lead_id: row.lead_id ?? "",
    organization_id: row.organization_id ?? "",
    direction: type === "message_received" ? "inbound" : "outbound",
    message_text: row.content ?? "",
    message_type: String((metadata as Record<string, unknown>).message_type ?? "text"),
    media_url: ((metadata as Record<string, unknown>).media_url as string | null | undefined) ?? null,
    wa_id: ((metadata as Record<string, unknown>).wa_id as string | null | undefined) ?? null,
    provider: ((metadata as Record<string, unknown>).provider as string | null | undefined) ?? null,
    provider_message_id: ((metadata as Record<string, unknown>).provider_message_id as string | null | undefined) ?? null,
    status: ((metadata as Record<string, unknown>).status as string | null | undefined) ?? null,
    created_at: row.created_at,
  };
}

export async function fetchMessages(leadId: string): Promise<Message[]> {
  const requiredLeadId = assertRequiredId(leadId, "lead_id");

  const [{ data: leadMessages, error: leadMessagesError }, { data: leadInteractions, error: leadInteractionsError }] = await Promise.all([
    supabase
      .from("lead_messages")
      .select("*")
      .eq("lead_id", requiredLeadId)
      .order("created_at", { ascending: true }),
    (supabase as any)
      .from("lead_interactions")
      .select("id, lead_id, organization_id, type, content, metadata, created_at")
      .eq("lead_id", requiredLeadId)
      .in("type", ["message_sent", "message_received"])
      .order("created_at", { ascending: true }),
  ]);

  if (leadMessagesError) throw leadMessagesError;
  if (leadInteractionsError) throw leadInteractionsError;

  const normalizedLeadMessages = ((leadMessages ?? []) as LeadMessageRow[]).map((row) => ({
    ...(row as unknown as Message),
    message_text: (row as any).message_text ?? (row as any).content ?? null,
  }));

  const normalizedLeadInteractions = ((leadInteractions ?? []) as LeadInteractionRow[])
    .map(mapLeadInteractionRowToMessage)
    .filter((message): message is Message => Boolean(message));

  const merged = [...normalizedLeadMessages, ...normalizedLeadInteractions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const deduped = merged.filter((message, index, arr) =>
    arr.findIndex((candidate) =>
      candidate.id === message.id || (
        candidate.created_at === message.created_at &&
        candidate.direction === message.direction &&
        candidate.message_text === message.message_text
      )
    ) === index
  );

  return deduped;
}

export async function sendMessage(msg: {
  lead_id?: string;
  organization_id: string;
  message_text?: string;
  to?: string;
  mode?: "cloud" | "vps";
  media_url?: string;
}) {
  const requiredOrgId = assertRequiredId(msg.organization_id, "organization_id");

  const { data, error } = await supabase.functions.invoke("wa-send-message", {
    body: {
      leadId: msg.lead_id,
      organizationId: requiredOrgId,
      to: msg.to,
      text: msg.message_text,
      mode: msg.mode ?? (import.meta.env.VITE_WHATSAPP_SEND_MODE ?? "vps"),
      media_url: msg.media_url,
    },
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? "Erro ao enviar mensagem");
  return data;
}

export async function fetchEvents(orgId: string): Promise<CalendarEvent[]> {
  const requiredOrgId = assertRequiredId(orgId, "organization_id");

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("organization_id", requiredOrgId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CalendarEventRow[] as CalendarEvent[];
}

export async function createEvent(event: Partial<CalendarEvent> & { organization_id: string; title: string; start_time: string; created_by: string }) {
  const payload: CalendarEventInsert = {
    ...event,
    organization_id: assertRequiredId(event.organization_id, "organization_id"),
    title: assertRequiredId(event.title, "title"),
    start_time: assertRequiredId(event.start_time, "start_time"),
    created_by: assertRequiredId(event.created_by, "created_by"),
  } as CalendarEventInsert;

  const { data, error } = await supabase.from("calendar_events").insert(payload).select().single();
  if (error) throw error;
  return data as CalendarEvent;
}

export function subscribeToTable(table: string, filter: string | null, callback: () => void) {
  const channel = supabase
    .channel(`rt-${table}-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, callback)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
