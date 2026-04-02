# Artista em Cena

Aplicação React + Supabase para gestão de artistas, CRM e financeiro.

## Ambiente já migrado para o novo Supabase

Este repositório está configurado para usar o projeto:

- **Project ID:** `uhumbtpkioisepqiqot`

## Rodando localmente

```bash
npm install
npm run dev
```

## Deploy CRM WhatsApp (Cloud + VPS/Baileys)

### Secrets obrigatórios (Supabase Edge Functions)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_DEFAULT_ORGANIZATION_ID`
- `WHATSAPP_PHONE_NUMBER_MAP` (JSON: `{ "phone_number_id": "organization_id" }`)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_SERVER_URL`

### Comandos de migração

```bash
supabase db push
```

Ou SQL manual:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260329100000_whatsapp_inbox_hardening.sql
```

### Deploy das Edge Functions

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy whatsapp-webhook-baileys --no-verify-jwt
supabase functions deploy wa-send-message --no-verify-jwt
```

### Realtime

A migration já adiciona `leads`, `lead_messages` e `lead_interactions` em `supabase_realtime`.

### Frontend

```bash
npm run build
# publique dist/ no seu provedor (Vercel, Netlify, etc.)
```

## Payload esperado do webhook Baileys/VPS

Endpoint: `POST /functions/v1/whatsapp-webhook-baileys`

Formato aceito (lista ou objeto):

```json
{
  "organization_id": "uuid-opcional",
  "phone_number_id": "id-opcional",
  "messages": [
    {
      "key": { "id": "ABCD", "remoteJid": "5511999999999@s.whatsapp.net" },
      "pushName": "Contato",
      "messageTimestamp": 1710000000,
      "message": {
        "conversation": "Olá"
      }
    }
  ]
}
```

Evento de status:

```json
{
  "event": "status",
  "organization_id": "uuid",
  "phone": "5511999999999",
  "provider_message_id": "ABCD",
  "status": "delivered",
  "delivered_at": "2026-03-29T10:00:00.000Z"
}
```

## Teste manual ponta a ponta

1. Conectar WhatsApp (Cloud ou VPS/Baileys).
2. Enviar mensagem inbound e confirmar criação/atualização de `contacts`, `leads`, `lead_messages` e `lead_interactions`.
3. Abrir Inbox e validar conversa ordenada por `last_message_at`.
4. Responder pelo CRM (chama `wa-send-message`).
5. Confirmar persistência outbound em `lead_messages` + `lead_interactions`.
6. Verificar contador de não lidas zerando ao abrir a conversa.
7. Validar realtime sem refresh.

## Scripts úteis

```bash
npm run build
npm run test
npm run lint
```
