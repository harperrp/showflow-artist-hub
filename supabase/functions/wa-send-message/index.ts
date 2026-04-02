import { buildServiceClient, normalizePhone } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type SendPayload = {
  mode?: "cloud" | "vps";
  leadId?: string;
  organizationId?: string;
  to?: string;
  text?: string;
  media_url?: string;
};

async function sendCloud(to: string, payload: SendPayload) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) throw new Error("WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes");

  const body = payload.media_url
    ? {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: payload.media_url, caption: payload.text ?? undefined },
    }
    : {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: payload.text ?? "" },
    };

  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Cloud API error (${res.status}): ${JSON.stringify(data)}`);
  }

  return {
    provider: "cloud",
    providerMessageId: data?.messages?.[0]?.id ?? null,
    status: "sent",
    response: data,
  };
}

async function sendVps(to: string, payload: SendPayload) {
  const baseUrl = Deno.env.get("WHATSAPP_SERVER_URL");
  if (!baseUrl) throw new Error("WHATSAPP_SERVER_URL ausente");

  const endpoints = ["/send-message", "/message/send", "/send"];
  let lastError = "";

  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, text: payload.text, media_url: payload.media_url }),
    });

    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      return {
        provider: "vps",
        providerMessageId: json?.messageId ?? json?.id ?? null,
        status: json?.status ?? "sent",
        endpoint,
        response: json,
      };
    }

    lastError = `${endpoint}: ${JSON.stringify(json)}`;
  }

  throw new Error(`Nenhum endpoint VPS funcionou. Último erro: ${lastError}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json() as SendPayload;
    const supabase = buildServiceClient();
    const mode = body.mode ?? "cloud";

    const leadId = body.leadId;
    let organizationId = body.organizationId;
    let to = normalizePhone(body.to ?? null);

    if (leadId) {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, organization_id, whatsapp_phone, contact_phone")
        .eq("id", leadId)
        .single();

      if (error) throw error;
      organizationId = organizationId ?? lead.organization_id;
      to = to || normalizePhone(lead.whatsapp_phone ?? lead.contact_phone);
    }

    if (!organizationId || !to) {
      throw new Error("organizationId e destino (to ou leadId com telefone) são obrigatórios");
    }

    const messageText = body.text ?? (body.media_url ? "[Mídia]" : "");
    if (!messageText && !body.media_url) throw new Error("Informe text ou media_url");

    const sendResult = mode === "vps" ? await sendVps(to, body) : await sendCloud(to, body);

    const now = new Date().toISOString();
    let finalLeadId = leadId ?? null;

    if (!finalLeadId) {
      const { data: byPhone } = await supabase
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .or(`whatsapp_phone.eq.${to},contact_phone.eq.${to}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      finalLeadId = byPhone?.id ?? null;
    }

    if (!finalLeadId) throw new Error("Não foi possível resolver lead para persistir o histórico.");

    const { data: messageRow, error: msgError } = await supabase
      .from("lead_messages")
      .insert({
        organization_id: organizationId,
        lead_id: finalLeadId,
        direction: "outbound",
        message_text: messageText,
        message_type: body.media_url ? "image" : "text",
        media_url: body.media_url ?? null,
        wa_id: to,
        provider: sendResult.provider,
        provider_message_id: sendResult.providerMessageId,
        status: sendResult.status,
        raw_payload: sendResult.response,
        delivered_at: now,
      })
      .select("id")
      .single();

    if (msgError) throw msgError;

    await supabase.from("lead_interactions").insert({
      organization_id: organizationId,
      lead_id: finalLeadId,
      event_type: "message_sent",
      channel: "whatsapp",
      content: messageText,
      payload: sendResult.response,
      metadata: {
        provider: sendResult.provider,
        provider_message_id: sendResult.providerMessageId,
        status: sendResult.status,
        endpoint: "endpoint" in sendResult ? sendResult.endpoint ?? null : null,
      },
    });

    await supabase.from("leads").update({
      last_message: messageText,
      last_message_at: now,
      last_contact_at: now,
      updated_at: now,
    }).eq("id", finalLeadId);

    return new Response(JSON.stringify({ ok: true, leadId: finalLeadId, messageId: messageRow.id, sendResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
