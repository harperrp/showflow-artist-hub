import {
  applyStatusEvent,
  buildServiceClient,
  extractPhoneFromWhatsappJid,
  isIgnorableWhatsappJid,
  isLikelyValidWhatsappPhone,
  normalizePhone,
  processInboundMessage,
  resolveOrganizationId,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function extractMessagePayloadText(content: any) {
  const image = content?.imageMessage;
  const video = content?.videoMessage;
  const audio = content?.audioMessage;
  const document = content?.documentMessage;
  const sticker = content?.stickerMessage;
  const extendedText = content?.extendedTextMessage?.text ?? null;
  const conversationText = content?.conversation ?? extendedText ?? null;

  let messageType = "text";
  let messageText = conversationText ?? "";
  let mediaUrl: string | null = null;

  if (image) {
    messageType = "image";
    messageText = image?.caption ?? "[Imagem]";
    mediaUrl = image?.url ?? null;
  } else if (video) {
    messageType = "video";
    messageText = video?.caption ?? "[Vídeo]";
    mediaUrl = video?.url ?? null;
  } else if (audio) {
    messageType = "audio";
    messageText = "[Áudio]";
    mediaUrl = audio?.url ?? null;
  } else if (document) {
    messageType = "document";
    messageText = document?.fileName ?? "[Documento]";
    mediaUrl = document?.url ?? null;
  } else if (sticker) {
    messageType = "sticker";
    messageText = "[Sticker]";
    mediaUrl = sticker?.url ?? null;
  }

  return {
    messageType,
    messageText: messageText || `[${messageType}]`,
    mediaUrl,
  };
}

function shouldIgnoreBaileysMessage(raw: any) {
  const key = raw?.key ?? {};
  const remoteJid = key?.remoteJid ?? raw?.remoteJid ?? "";

  if (!remoteJid) return true;
  if (isIgnorableWhatsappJid(remoteJid)) return true;
  if (key?.fromMe === true) return true;

  const phone = extractPhoneFromWhatsappJid(remoteJid);
  const fallbackPhone = normalizePhone(
    raw?.phone ??
    raw?.sender ??
    raw?.from ??
    raw?.participant ??
    ""
  );

  if (!phone && !isLikelyValidWhatsappPhone(fallbackPhone)) return true;

  return false;
}

function parseBaileysPayload(payload: any) {
  const items: Array<any> = [];
  const source = Array.isArray(payload?.messages)
    ? payload.messages
    : Array.isArray(payload)
      ? payload
      : [payload];

  for (const raw of source) {
    if (shouldIgnoreBaileysMessage(raw)) {
      console.log("[baileys] skipped message", {
        remoteJid: raw?.key?.remoteJid ?? raw?.remoteJid ?? null,
        fromMe: raw?.key?.fromMe ?? null,
      });
      continue;
    }

    const key = raw?.key ?? {};
    const content = raw?.message ?? {};
    const remoteJid = key?.remoteJid ?? raw?.remoteJid ?? "";
    const phoneFromJid = extractPhoneFromWhatsappJid(remoteJid);

    const fallbackPhone = normalizePhone(
      raw?.phone ??
      raw?.sender ??
      raw?.from ??
      raw?.participant ??
      payload?.phone ??
      payload?.sender ??
      payload?.from ??
      ""
    );

    const phone =
      (isLikelyValidWhatsappPhone(fallbackPhone) ? fallbackPhone : "") ||
      phoneFromJid;

    if (!isLikelyValidWhatsappPhone(phone)) {
      console.warn("[baileys] invalid phone rejected", {
        remoteJid,
        phoneFromJid,
        fallbackPhone,
      });
      continue;
    }

    const { messageType, messageText, mediaUrl } = extractMessagePayloadText(content);

    items.push({
      organizationId: resolveOrganizationId(
        payload?.phone_number_id ?? null,
        payload?.organization_id ?? null,
      ) ?? undefined,
      phone,
      name: raw?.pushName ?? payload?.name ?? phone,
      messageText,
      messageType,
      mediaUrl,
      rawPayload: raw,
      provider: "vps" as const,
      providerMessageId: key?.id ?? raw?.id ?? null,
      deliveredAt: raw?.messageTimestamp
        ? new Date(Number(raw.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString(),
      waId: phone,
    });
  }

  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabase = buildServiceClient();

    if (body?.event === "status") {
      const orgId = resolveOrganizationId(
        body?.phone_number_id ?? null,
        body?.organization_id ?? null,
      );

      if (!orgId) {
        throw new Error("organization_id não resolvida para status");
      }

      await applyStatusEvent(supabase, {
        organizationId: orgId,
        phone: body?.phone,
        provider: "vps",
        providerMessageId: body?.provider_message_id,
        status: body?.status,
        rawPayload: body,
        deliveredAt: body?.delivered_at ?? null,
      });

      return new Response(JSON.stringify({ ok: true, kind: "status" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseBaileysPayload(body);
    const results: any[] = [];

    for (const item of parsed) {
      if (!item.phone) continue;
      const result = await processInboundMessage(supabase, item);
      results.push(result);
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: String(error),
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
