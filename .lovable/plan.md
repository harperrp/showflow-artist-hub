

# Plano de Correção: Leads, Contatos e Eventos

## Problemas Identificados

### 1. Tabela de Eventos: nome errado no código
O banco de dados tem a tabela `calendar_events`, mas **todo o código** usa `db.from("events")`. Isso faz com que nenhum evento seja salvo ou carregado -- o calendário fica vazio e criação de eventos falha silenciosamente.

**Arquivos afetados:**
- `src/hooks/useCrmQueries.ts` (consultas e upsert)
- `src/components/artist-calendar/ArtistCalendarPage.tsx` (update, upsert, delete)
- `src/pages/LeadsKanban.tsx` (insert ao mover para Negociação/Fechado)
- `src/pages/ContractsCrud.tsx` (update ao assinar contrato)

### 2. Contatos: página usa dados fictícios, "Salvar" não grava nada
A página `src/pages/Contacts.tsx` tem uma lista de 8 contatos hardcoded (`mockContacts`). O formulário de "Novo Contato" apenas fecha o dialog sem gravar no banco. A tabela `contacts` existe no banco e tem RLS configurado, mas nao e usada.

### 3. Leads: fallback para mock data mascara erros
O Kanban usa `const displayLeads = leads.length > 0 ? leads : mockLeads` -- se a query falhar ou retornar vazio, o usuario ve dados falsos achando que sao reais.

---

## Implementação

### Etapa 1 -- Corrigir referências `"events"` para `"calendar_events"`

Atualizar **todas** as ocorrências de `db.from("events")` para `db.from("calendar_events")` e ajustar os nomes das colunas (`start_at` -> `start_time`, `end_at` -> `end_time`) conforme o schema real:

- **`src/hooks/useCrmQueries.ts`**: Corrigir `useCalendarEvents` (select), `useUpsertCalendarEvent` (insert/update). Remover o `mapEventToLegacy` que fazia tradução desnecessária de `start_at`/`end_at` (a tabela real já usa `start_time`/`end_time`).
- **`src/components/artist-calendar/ArtistCalendarPage.tsx`**: Corrigir `handleEventDrop` (update `start_time`), `handleDialogResult` (upsert com campos corretos: `start_time`, `end_time`), e delete.
- **`src/pages/LeadsKanban.tsx`**: Corrigir insert ao mover lead para "Negociação" (usar `start_time` ao invés de `start_at`) e update ao mover para "Fechado".
- **`src/pages/ContractsCrud.tsx`**: Corrigir update de status.

### Etapa 2 -- Contatos: CRUD real com banco de dados

Reescrever `src/pages/Contacts.tsx`:
- Criar hook `useContacts` em `useCrmQueries.ts` que faz `db.from("contacts").select("*").eq("organization_id", orgId)`.
- Implementar formulário funcional com `react-hook-form` + zod que faz `db.from("contacts").insert(...)` com `organization_id` e `created_by`.
- Remover `mockContacts` hardcoded.
- Adicionar edição e exclusão de contatos.

### Etapa 3 -- Remover fallback de mock data nos Leads

- Remover a linha `const displayLeads = leads.length > 0 ? leads : mockLeads` e usar `leads` diretamente.
- Manter o `EmptyState` que ja existe para quando nao ha leads.
- Atualizar todas as referências de `displayLeads` para `leads`.

### Etapa 4 -- Remover mock data do Dashboard

- Atualizar `src/pages/Dashboard.tsx` para usar dados reais ao invés de fallback para `mockLeads`/`mockEvents`.

---

## Detalhes Técnicos

### Mapeamento de colunas `calendar_events` (schema real):
```text
id, title, status (event_status enum), start_time, end_time, fee,
city, state, notes, organization_id, created_by, lead_id, contract_id,
venue_name, contractor_name, stage, contract_status, latitude, longitude
```

### Colunas `contacts` (schema real):
```text
id, name, phone, email, company, role, notes,
organization_id, created_by, created_at, updated_at
```

### Arquivos que serão criados/modificados:
| Arquivo | Ação |
|---|---|
| `src/hooks/useCrmQueries.ts` | Corrigir `"events"` -> `"calendar_events"`, campos, adicionar `useContacts` |
| `src/components/artist-calendar/ArtistCalendarPage.tsx` | Corrigir `"events"` -> `"calendar_events"` e campos |
| `src/pages/LeadsKanban.tsx` | Corrigir `"events"` -> `"calendar_events"`, remover mock fallback |
| `src/pages/ContractsCrud.tsx` | Corrigir `"events"` -> `"calendar_events"` |
| `src/pages/Contacts.tsx` | Reescrever com CRUD real |
| `src/pages/Dashboard.tsx` | Remover fallback de mock data |

