import {
  applyStatusEvent,
  buildServiceClient,
  mapMessageContent,
  processInboundMessage,
  resolveOrganizationId,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function verifyMetaSignature(req: Request, rawBody: string) {
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) return true;

  const signature = req.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  return signature === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  const signatureOk = await verifyMetaSignature(req, rawBody);
  if (!signatureOk) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = buildServiceClient();
  const results: Array<Record<string, unknown>> = [];

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages") continue;
      const value = change?.value ?? {};
      const metadataPhoneNumberId = value?.metadata?.phone_number_id ?? null;
      const orgId = resolveOrganizationId(metadataPhoneNumberId, null);

      for (const status of value?.statuses ?? []) {
        try {
          if (!orgId) continue;
          await applyStatusEvent(supabase, {
            organizationId: orgId,
            phone: status?.recipient_id,
            provider: "cloud",
            providerMessageId: status?.id,
            status: status?.status,
            rawPayload: status,
            deliveredAt: status?.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : null,
          });
          results.push({ kind: "status", ok: true, providerMessageId: status?.id });
        } catch (error) {
          console.error("[webhook] status handling error", error);
          results.push({ kind: "status", ok: false, error: String(error) });
        }
      }

      for (const message of value?.messages ?? []) {
        const contact = (value?.contacts ?? []).find((c: any) => c?.wa_id === message?.from);
        const mapped = mapMessageContent(message);

        try {
          const result = await processInboundMessage(supabase, {
            organizationId: orgId ?? undefined,
            phone: message?.from,
            name: contact?.profile?.name,
            messageText: mapped.messageText,
            messageType: mapped.messageType,
            mediaUrl: mapped.mediaUrl,
            rawPayload: message,
            provider: "cloud",
            providerMessageId: message?.id,
            deliveredAt: message?.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : null,
            waId: message?.from,
          });
          results.push({ kind: "message", ...result, providerMessageId: message?.id });
        } catch (error) {
          console.error("[webhook] message handling error", error);
          results.push({ kind: "message", ok: false, error: String(error), providerMessageId: message?.id });
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
