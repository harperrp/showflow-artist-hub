import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_SERVER_URL = (
  Deno.env.get("WHATSAPP_SERVER_URL") ??
  "https://whatsapp.likedigitalmkt.com.br"
).replace(/\/+$/, "");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalize(phone: string) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function isLikelyValidWhatsappPhone(phone?: string | null) {
  const normalized = normalize(phone || "");
  return normalized.length >= 10 && normalized.length <= 15;
}

type SendMode = "cloud" | "vps";

interface SendPayload {
  leadId?: string;
  organizationId?: string;
  to?: string;
  text?: string;
  message?: string;
  media_url?: string | null;
  mode?: SendMode;
  provider?: SendMode;
}

function parseJsonMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch (error) {
    console.error("Erro ao parsear mapa JSON:", error);
  }
  return {};
}

const VPS_INSTANCE_BY_ORG = parseJsonMap(Deno.env.get("WHATSAPP_VPS_INSTANCE_MAP"));
const VPS_SENDER_PHONE_BY_ORG = parseJsonMap(Deno.env.get("WHATSAPP_VPS_SENDER_PHONE_MAP"));

function resolveVpsRouting(organizationId?: string) {
  const fallbackInstance = (Deno.env.get("WHATSAPP_VPS_INSTANCE") || "").trim();
  const fallbackSenderPhone = normalize(Deno.env.get("WHATSAPP_VPS_SENDER_PHONE") || "");

  const instance = organizationId
    ? (VPS_INSTANCE_BY_ORG[organizationId] || fallbackInstance).trim()
    : fallbackInstance;

  const senderPhone = organizationId
    ? normalize(VPS_SENDER_PHONE_BY_ORG[organizationId] || fallbackSenderPhone)
    : fallbackSenderPhone;

  return {
    instance: instance || null,
    senderPhone: senderPhone || null,
  };
}

async function resolveLeadPhone(leadId?: string) {
  if (!leadId) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("id, contractor_name, contact_phone, whatsapp_phone")
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar lead:", error);
    throw new Error("Erro ao buscar lead");
  }

  if (!data) return null;

  const phone = normalize(data.whatsapp_phone || data.contact_phone || "");

  if (!phone) {
    return null;
  }

  if (!isLikelyValidWhatsappPhone(phone)) {
    throw new Error("Lead com telefone inválido. Revise o cadastro/origem do webhook.");
  }

  return {
    id: data.id,
    name: data.contractor_name,
    phone,
  };
}

function extractProviderMessageId(providerResponse: unknown): string | null {
  if (!providerResponse || typeof providerResponse !== "object") return null;

  const asRecord = providerResponse as Record<string, unknown>;
  const directMessageId = asRecord.messageId;
  if (typeof directMessageId === "string" && directMessageId.trim()) return directMessageId;

  const nestedResult = asRecord.result;
  if (nestedResult && typeof nestedResult === "object") {
    const resultRecord = nestedResult as Record<string, unknown>;
    const candidates = [
      resultRecord.id,
      resultRecord.messageId,
      resultRecord.message_id,
      resultRecord?.data && typeof resultRecord.data === "object"
        ? (resultRecord.data as Record<string, unknown>).id
        : null,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }

  return null;
}

async function sendViaCloud(params: {
  to: string;
  text: string;
  media_url?: string | null;
}) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error("WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados");
  }

  const payload = params.media_url
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "image",
        image: {
          link: params.media_url,
          caption: params.text || undefined,
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "text",
        text: {
          body: params.text,
        },
      };

  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Erro Cloud API:", result);
    throw new Error(result?.error?.message || "Erro ao enviar pela Cloud API");
  }

  return result;
}

async function sendViaVps(params: {
  to: string;
  text: string;
  media_url?: string | null;
  organizationId?: string;
}) {
  const routing = resolveVpsRouting(params.organizationId);

  const payload = {
    number: params.to,
    to: params.to,
    ...(routing.senderPhone
      ? {
          phone: routing.senderPhone,
          sender: routing.senderPhone,
          from: routing.senderPhone,
        }
      : {}),
    ...(routing.instance
      ? {
          instance: routing.instance,
          session: routing.instance,
          sessionName: routing.instance,
        }
      : {}),
    text: params.text,
    message: params.text,
    media_url: params.media_url ?? null,
  };

  const tryEndpoints = [
    `${WHATSAPP_SERVER_URL}/send-message`,
    `${WHATSAPP_SERVER_URL}/message/send`,
    `${WHATSAPP_SERVER_URL}/send`,
  ];

  let lastError: unknown = null;

  for (const endpoint of tryEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        lastError = result;
        continue;
      }

      return {
        endpoint,
        result,
      };
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Erro VPS:", lastError);
  throw new Error("Erro ao enviar mensagem pela VPS");
}

async function saveInteraction(params: {
  leadId?: string;
  organizationId?: string;
  text: string;
  mode: SendMode;
  to: string;
  providerMessageId?: string | null;
  mediaUrl?: string | null;
}) {
  if (!params.leadId || !params.organizationId) return;

  const nowIso = new Date().toISOString();

  const { error: messageError } = await supabase.from("lead_messages").insert({
    organization_id: params.organizationId,
    lead_id: params.leadId,
    direction: "outbound",
    message_text: params.text,
    message_type: params.mediaUrl ? "image" : "text",
    media_url: params.mediaUrl ?? null,
    wa_id: params.to,
    provider_message_id: params.providerMessageId ?? null,
    status: "sent",
    delivered_at: nowIso,
    raw_payload: {
      to: params.to,
      provider: params.mode,
      provider_message_id: params.providerMessageId ?? null,
    },
  });

  if (messageError) {
    console.warn("Não foi possível salvar lead_message:", messageError);
  }

  const { error } = await supabase.from("lead_interactions").insert({
    organization_id: params.organizationId,
    lead_id: params.leadId,
    type: "message_sent",
    content: params.text,
    metadata: {
      to: params.to,
      provider: params.mode,
      channel: params.mode === "vps" ? "whatsapp_vps" : "whatsapp_cloud",
      provider_message_id: params.providerMessageId ?? null,
      media_url: params.mediaUrl ?? null,
    },
    created_at: nowIso,
  });

  if (error) {
    console.warn("Não foi possível salvar interaction:", error);
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      last_contact_at: nowIso,
      last_message: params.text,
      last_message_at: nowIso,
    })
    .eq("id", params.leadId);

  if (leadError) {
    console.warn("Não foi possível atualizar lead:", leadError);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as SendPayload;

    const mode: SendMode = body.mode || body.provider || "vps";

    const text = String(body.text || body.message || "").trim();
    if (!text) {
      return json({ error: "Mensagem não informada" }, 400);
    }

    let to = normalize(body.to || "");
    let resolvedLead:
      | { id: string; name?: string | null; phone: string }
      | null = null;

    if (to && !isLikelyValidWhatsappPhone(to)) {
      return json({ error: "Destino informado é inválido" }, 400);
    }

    if (!to && body.leadId) {
      resolvedLead = await resolveLeadPhone(body.leadId);
      if (!resolvedLead?.phone) {
        return json({ error: "Lead sem telefone válido" }, 400);
      }
      to = resolvedLead.phone;
    }

    if (!to) {
      return json({ error: "Destino não informado" }, 400);
    }

    if (!isLikelyValidWhatsappPhone(to)) {
      return json({ error: "Telefone de destino inválido" }, 400);
    }

    const media_url = body.media_url ?? null;

    let providerResponse: unknown;

    if (mode === "vps") {
      providerResponse = await sendViaVps({
        to,
        text,
        media_url,
        organizationId: body.organizationId,
      });
    } else {
      providerResponse = await sendViaCloud({ to, text, media_url });
    }

    await saveInteraction({
      leadId: body.leadId || resolvedLead?.id,
      organizationId: body.organizationId,
      text,
      mode,
      to,
      providerMessageId: extractProviderMessageId(providerResponse),
      mediaUrl: media_url,
    });

    return json({
      ok: true,
      success: true,
      mode,
      to,
      providerResponse,
    });
  } catch (error) {
    console.error("wa-send-message error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      500,
    );
  }
});