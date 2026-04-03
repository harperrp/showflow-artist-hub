import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

export type NormalizedInboundMessage = {
  organizationId?: string;
  phone: string;
  name?: string;
  messageText: string;
  messageType: string;
  mediaUrl?: string | null;
  rawPayload: Record<string, unknown>;
  provider: "cloud" | "vps" | "baileys";
  providerMessageId?: string | null;
  deliveredAt?: string | null;
  status?: string | null;
  waId?: string | null;
};

export function buildServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  return createClient(url, key);
}

export function normalizePhone(phone?: string | null) {
  return (phone ?? "").replace(/[^\d]/g, "");
}

export function isLikelyValidWhatsappPhone(phone?: string | null) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 && normalized.length <= 15;
}

export function isIgnorableWhatsappJid(remoteJid?: string | null) {
  const value = String(remoteJid ?? "").trim().toLowerCase();
  if (!value) return true;

  return (
    value.endsWith("@g.us") ||
    value === "status@broadcast" ||
    value.endsWith("@broadcast") ||
    value.endsWith("@newsletter") ||
    value.includes("lid") ||
    value.includes("broadcast")
  );
}

export function extractPhoneFromWhatsappJid(remoteJid?: string | null) {
  if (!remoteJid || isIgnorableWhatsappJid(remoteJid)) return "";

  const base = String(remoteJid).split("@")[0] ?? "";
  const normalized = normalizePhone(base);

  if (!isLikelyValidWhatsappPhone(normalized)) return "";
  return normalized;
}

export function resolveOrganizationId(metadataPhoneNumberId?: string | null, explicitOrgId?: string | null): string | null {
  if (explicitOrgId) return explicitOrgId;

  const mapRaw = Deno.env.get("WHATSAPP_PHONE_NUMBER_MAP");
  if (mapRaw && metadataPhoneNumberId) {
    try {
      const parsed = JSON.parse(mapRaw) as Record<string, string>;
      const mapped = parsed[metadataPhoneNumberId];
      if (mapped) return mapped;
    } catch (error) {
      console.error("[org-resolver] erro ao parsear WHATSAPP_PHONE_NUMBER_MAP", error);
    }
  }

  return Deno.env.get("WHATSAPP_DEFAULT_ORGANIZATION_ID") ?? null;
}

export function mapMessageContent(message: any) {
  const type = message?.type ?? "text";
  let messageText = "";
  let mediaUrl: string | null = null;

  switch (type) {
    case "text":
      messageText = message?.text?.body ?? "";
      break;
    case "image":
      messageText = message?.image?.caption ?? "[Imagem]";
      mediaUrl = message?.image?.id ?? message?.image?.link ?? null;
      break;
    case "audio":
      messageText = "[Áudio]";
      mediaUrl = message?.audio?.id ?? message?.audio?.link ?? null;
      break;
    case "video":
      messageText = message?.video?.caption ?? "[Vídeo]";
      mediaUrl = message?.video?.id ?? message?.video?.link ?? null;
      break;
    case "document":
      messageText = message?.document?.filename ?? "[Documento]";
      mediaUrl = message?.document?.id ?? message?.document?.link ?? null;
      break;
    case "sticker":
      messageText = "[Sticker]";
      mediaUrl = message?.sticker?.id ?? message?.sticker?.link ?? null;
      break;
    default:
      messageText = `[${type}]`;
      mediaUrl = message?.[type]?.id ?? message?.[type]?.link ?? null;
      break;
  }

  return { messageType: type, messageText: messageText || `[${type}]`, mediaUrl };
}

export async function processInboundMessage(supabase: SupabaseClient, message: NormalizedInboundMessage) {
  const nowIso = message.deliveredAt ?? new Date().toISOString();
  const normalizedPhone = normalizePhone(message.phone);
  const normalizedProvider = message.provider === "baileys" ? "vps" : message.provider;

  if (!normalizedPhone) {
    return { ok: false, reason: "missing_phone" };
  }

  if (!isLikelyValidWhatsappPhone(normalizedPhone)) {
    console.warn("[inbound] invalid_phone_rejected", {
      provider: normalizedProvider,
      phone: message.phone,
      normalizedPhone,
    });
    return { ok: false, reason: "invalid_phone" };
  }

  const orgId = message.organizationId;
  if (!orgId) return { ok: false, reason: "missing_org" };

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, created_by")
    .eq("id", orgId)
    .maybeSingle();

  if (!organization) return { ok: false, reason: "organization_not_found" };

  console.log("[inbound] organization resolved", { orgId, normalizedPhone });

  const { data: stage } = await supabase
    .from("funnel_stages")
    .select("name")
    .eq("organization_id", orgId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  let contactId = existingContact?.id;

  if (!contactId) {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        name: message.name ?? normalizedPhone,
        phone: normalizedPhone,
        created_by: organization.created_by,
      })
      .select("id")
      .single();

    if (contactError) {
      console.error("[inbound] failed creating contact", contactError);
      return { ok: false, reason: "contact_create_failed", error: contactError.message };
    }

    contactId = newContact.id;
    console.log("[inbound] contact created", { contactId, phone: normalizedPhone });
  } else {
    console.log("[inbound] contact found", { contactId, phone: normalizedPhone });
  }

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", orgId)
    .or(`contact_id.eq.${contactId},whatsapp_phone.eq.${normalizedPhone},contact_phone.eq.${normalizedPhone}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let leadId = existingLead?.id;

  if (!leadId) {
    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        organization_id: orgId,
        created_by: organization.created_by,
        contractor_name: message.name ?? normalizedPhone,
        origin: "WhatsApp",
        stage: stage?.name ?? "Prospecção",
        contact_id: contactId,
        contact_phone: normalizedPhone,
        whatsapp_phone: normalizedPhone,
        last_message: message.messageText,
        last_message_at: nowIso,
        last_contact_at: nowIso,
        unread_count: 1,
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("[inbound] failed creating lead", leadError);
      return { ok: false, reason: "lead_create_failed", error: leadError.message };
    }

    leadId = newLead.id;
    console.log("[inbound] lead created", { leadId });
  } else {
    console.log("[inbound] lead found", { leadId });
  }

  const { data: currentLead } = await supabase
    .from("leads")
    .select("unread_count")
    .eq("id", leadId)
    .maybeSingle();

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({
      contact_id: contactId,
      contact_phone: normalizedPhone,
      whatsapp_phone: normalizedPhone,
      last_message: message.messageText,
      last_message_at: nowIso,
      last_contact_at: nowIso,
      updated_at: new Date().toISOString(),
      unread_count: (currentLead?.unread_count ?? 0) + 1,
    })
    .eq("id", leadId);

  if (leadUpdateError) {
    console.error("[inbound] lead update failed", leadUpdateError);
  } else {
    console.log("[inbound] lead updated", { leadId });
  }

  const { data: messageRow, error: messageInsertError } = await supabase
    .from("lead_messages")
    .insert({
      organization_id: orgId,
      lead_id: leadId,
      direction: "inbound",
      message_text: message.messageText,
      message_type: message.messageType,
      media_url: message.mediaUrl,
      wa_id: message.waId ?? normalizedPhone,
      provider: normalizedProvider,
      provider_message_id: message.providerMessageId,
      status: message.status,
      raw_payload: message.rawPayload,
      delivered_at: nowIso,
    })
    .select("id")
    .single();

  if (messageInsertError) {
    console.error("[inbound] message insert failed", messageInsertError);
    return { ok: false, reason: "message_insert_failed", error: messageInsertError.message };
  }

  console.log("[inbound] message inserted", { messageId: messageRow.id });

  const { error: interactionError } = await supabase.from("lead_interactions").insert({
    organization_id: orgId,
    lead_id: leadId,
    type: "message_received",
    content: message.messageText,
    metadata: {
      provider: normalizedProvider,
      channel: "whatsapp",
      message_type: message.messageType,
      media_url: message.mediaUrl,
      provider_message_id: message.providerMessageId,
      lead_message_id: messageRow.id,
      wa_id: message.waId ?? normalizedPhone,
    },
    created_at: nowIso,
  });

  if (interactionError) {
    console.error("[inbound] interaction insert failed", interactionError);
  } else {
    console.log("[inbound] interaction inserted", { leadId });
  }

  try {
    const { error: rpcError } = await supabase.rpc("register_whatsapp_inbound", {
      _organization_id: orgId,
      _lead_id: leadId,
      _phone: normalizedPhone,
      _message_text: message.messageText,
      _message_type: message.messageType,
      _provider: normalizedProvider,
      _provider_message_id: message.providerMessageId,
      _status: message.status,
      _raw_payload: message.rawPayload,
      _delivered_at: nowIso,
    });

    if (rpcError) {
      console.error("[inbound] rpc skipped due error", rpcError);
    } else {
      console.log("[inbound] rpc executed", { leadId });
    }
  } catch (rpcError) {
    console.error("[inbound] rpc crashed", rpcError);
  }

  return {
    ok: true,
    organizationId: orgId,
    leadId,
    contactId,
    leadMessageId: messageRow.id,
  };
}

export async function applyStatusEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    phone?: string | null;
    provider: string;
    providerMessageId?: string | null;
    status?: string | null;
    rawPayload: Record<string, unknown>;
    deliveredAt?: string | null;
  },
) {
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedProvider = input.provider === "baileys" ? "vps" : input.provider;

  const { data: lead } =
    normalizedPhone && isLikelyValidWhatsappPhone(normalizedPhone)
      ? await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", input.organizationId)
          .or(`whatsapp_phone.eq.${normalizedPhone},contact_phone.eq.${normalizedPhone}`)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null as any };

  if (input.providerMessageId) {
    await supabase
      .from("lead_messages")
      .update({
        status: input.status ?? undefined,
        delivered_at: input.deliveredAt ?? undefined,
      })
      .eq("provider_message_id", input.providerMessageId);
  }

  if (lead?.id) {
    await supabase.from("lead_interactions").insert({
      organization_id: input.organizationId,
      lead_id: lead.id,
      type: "message_status",
      content: input.status ?? null,
      metadata: {
        provider: normalizedProvider,
        provider_message_id: input.providerMessageId,
        channel: "whatsapp",
        raw_payload: input.rawPayload,
      },
      created_at: input.deliveredAt ?? new Date().toISOString(),
    });
  }
}