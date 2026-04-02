import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, KanbanSquare, MapPin, Phone, Target } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/providers/OrgProvider";
import * as api from "@/services/api";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatPanel } from "@/components/inbox/ChatPanel";
import { LeadPanel } from "@/components/inbox/LeadPanel";

const AGENDA_PREFILL_KEY = "crm:agenda-prefill";

function formatRelativeLabel(value?: string | null) {
  if (!value) return "Sem registro";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CrmInboxPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["crm-conversations", activeOrgId],
    queryFn: () => api.fetchConversations(activeOrgId!),
    enabled: !!activeOrgId,
  });

  useEffect(() => {
    if (!conversations.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const { data: messages = [] } = useQuery({
    queryKey: ["crm-messages", selected?.lead_id],
    queryFn: () => api.fetchMessages(selected!.lead_id!),
    enabled: !!selected?.lead_id,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages", activeOrgId],
    queryFn: () => api.fetchStages(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const selectedLeadSnapshot = useMemo(() => {
    if (!selected) return null;

    return {
      name: selected.contact_name || selected.lead?.contractor_name || "Lead sem nome",
      phone: selected.contact_phone || selected.lead?.contact_phone || "Sem telefone",
      stage: selected.stage ?? selected.lead?.stage ?? "Sem etapa",
      location: [selected.lead?.city, selected.lead?.state].filter(Boolean).join(", "),
      lastTouch: formatRelativeLabel(selected.last_message_at),
      unread: selected.unread_count ?? 0,
    };
  }, [selected]);

  useEffect(() => {
    if (!activeOrgId) return;

    const unsubscribeLeadMessages = api.subscribeToTable("lead_messages", null, () => {
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });

      if (selected?.lead_id) {
        qc.invalidateQueries({ queryKey: ["crm-messages", selected.lead_id] });
      }
    });

    const unsubscribeLeadInteractions = api.subscribeToTable("lead_interactions", null, () => {
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });

      if (selected?.lead_id) {
        qc.invalidateQueries({ queryKey: ["crm-messages", selected.lead_id] });
      }
    });

    return () => {
      unsubscribeLeadMessages();
      unsubscribeLeadInteractions();
    };
  }, [activeOrgId, selected?.lead_id, qc]);

  useEffect(() => {
    if (!activeOrgId) return;

    return api.subscribeToTable("leads", `organization_id=eq.${activeOrgId}`, () => {
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
    });
  }, [activeOrgId, qc]);

  useEffect(() => {
    if (!selectedId || !selected?.lead_id) return;

    if ((selected.unread_count ?? 0) > 0) {
      api.markConversationRead(selected.lead_id).then(() => {
        qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
      });
    }
  }, [selectedId, selected?.lead_id, selected?.unread_count, qc, activeOrgId]);

  const sendMut = useMutation({
    mutationFn: (text: string) => {
      if (!selected?.lead_id) throw new Error("Conversa sem lead vinculado");

      return api.sendMessage({
        lead_id: selected.lead_id,
        organization_id: activeOrgId!,
        message_text: text,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-messages", selected?.lead_id] });
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAgendaShortcut = () => {
    if (!selected) return;

    const payload = {
      leadId: selected.lead_id,
      title: `Negociação — ${selected.contact_name || selected.lead?.contractor_name || "Lead"}`,
      contractorName: selected.contact_name || selected.lead?.contractor_name || "",
      contactPhone: selected.contact_phone || selected.lead?.contact_phone || "",
      city: selected.lead?.city || "",
      state: selected.lead?.state || "",
      fee: selected.lead?.fee ?? undefined,
      funnelStage: selected.stage ?? selected.lead?.stage ?? "Negociação",
      notes: selected.last_message_text || undefined,
      start: new Date().toISOString(),
    };

    localStorage.setItem(AGENDA_PREFILL_KEY, JSON.stringify(payload));
    window.location.href = "/app/agenda";
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        stages={stages}
        onSelect={setSelectedId}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedLeadSnapshot && (
          <div className="border-b border-border bg-card px-4 py-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedLeadSnapshot.name}
                  </p>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {selectedLeadSnapshot.stage}
                  </Badge>
                  {selectedLeadSnapshot.unread > 0 && (
                    <Badge variant="outline" className="text-[10px] font-medium text-primary">
                      {selectedLeadSnapshot.unread} não lidas
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedLeadSnapshot.phone}
                  </span>
                  <span>Último toque: {selectedLeadSnapshot.lastTouch}</span>
                  {selectedLeadSnapshot.location && <span>{selectedLeadSnapshot.location}</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 gap-2" onClick={handleAgendaShortcut}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Agenda
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2"
                  onClick={() => (window.location.href = "/app/pipeline")}
                >
                  <KanbanSquare className="h-3.5 w-3.5" />
                  Pipeline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2"
                  onClick={() => (window.location.href = "/app/map")}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Mapa
                </Button>
              </div>
            </div>
          </div>
        )}

        <ChatPanel
          conversation={selected}
          messages={messages}
          onSend={(text) => sendMut.mutate(text)}
          sending={sendMut.isPending}
        />
      </div>

      {selected && <LeadPanel conversation={selected} stages={stages} />}
    </div>
  );
}
