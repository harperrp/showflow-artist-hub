import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  KanbanSquare,
  MapPin,
  Phone,
  Send,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/providers/OrgProvider";
import { useAuth } from "@/providers/AuthProvider";
import * as api from "@/services/api";
import type { Conversation, Lead, PipelineStage } from "@/types/crm";
import { cn } from "@/lib/utils";
import { normalizePhone } from "@/utils/phone";

interface Props {
  conversation: Conversation;
  stages: PipelineStage[];
}

const AGENDA_PREFILL_KEY = "crm:agenda-prefill";

const NEXT_STEP_BY_STAGE: Record<string, string> = {
  Prospecção: "Qualificar e puxar resposta útil.",
  Contato: "Confirmar praça e mover para proposta.",
  Proposta: "Registrar valor e marcar follow-up.",
  Negociação: "Virar agenda e próximo compromisso.",
  Contrato: "Amarrar agenda e fechamento.",
  Fechado: "Acompanhar operação do show.",
};

function normaliseAgendaTitle(name: string) {
  if (!name.trim()) return "Nova negociação";
  return `Negociação — ${name.trim()}`;
}

function formatDateLabel(value?: string | null) {
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

export function LeadPanel({ conversation, stages }: Props) {
  const navigate = useNavigate();
  const { activeOrgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const lead = (conversation.lead ?? null) as Lead | null;
  const leadId = lead?.id ?? conversation.lead_id ?? null;
  const leadStage = lead?.stage ?? conversation.stage ?? "Sem etapa";
  const locationLabel = [lead?.city, lead?.state].filter(Boolean).join(", ");

  useEffect(() => {
    setEditName(lead?.contractor_name || conversation.contact_name || "");
    setEditPhone(normalizePhone(lead?.contact_phone || conversation.contact_phone || ""));
  }, [lead?.id, lead?.contractor_name, lead?.contact_phone, conversation.contact_name, conversation.contact_phone]);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", leadId],
    queryFn: () => api.fetchNotes(leadId!),
    enabled: !!leadId,
  });

  const noteMut = useMutation({
    mutationFn: () =>
      api.createNote({
        organization_id: activeOrgId!,
        entity_id: leadId!,
        entity_type: "lead",
        content: noteText,
        created_by: user!.id,
      }),
    onSuccess: () => {
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["notes", leadId] });
      toast.success("Nota adicionada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateLeadMut = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("Lead não encontrado");
      return api.updateLead(leadId, {
        contractor_name: editName.trim() || "Sem nome",
        contact_phone: normalizePhone(editPhone) || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["leads", activeOrgId] });
      toast.success("Contato atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLeadMut = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("Lead não encontrado");
      return api.deleteLead(leadId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["leads", activeOrgId] });
      qc.invalidateQueries({ queryKey: ["notes", leadId] });
      toast.success("Lead excluído");
      navigate("/app/inbox");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const nextRecommendedAction = useMemo(() => {
    return NEXT_STEP_BY_STAGE[leadStage] ?? "Qualifique, mova etapa e conecte com agenda.";
  }, [leadStage]);

  const handleStageChange = async (stageName: string) => {
    if (!leadId) return;
    try {
      await api.updateLead(leadId, { stage: stageName });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
      qc.invalidateQueries({ queryKey: ["leads", activeOrgId] });
      toast.success(`Movido para ${stageName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível mover a etapa";
      toast.error(message);
    }
  };

  const handleGoToAgenda = () => {
    const payload = {
      leadId,
      title: normaliseAgendaTitle(editName || conversation.contact_name || ""),
      contractorName: editName || conversation.contact_name || "",
      contactPhone: normalizePhone(editPhone || conversation.contact_phone || ""),
      city: lead?.city ?? "",
      state: lead?.state ?? "",
      fee: lead?.fee ?? undefined,
      funnelStage: leadStage,
      notes: noteText.trim() || lead?.notes || conversation.last_message_text || undefined,
      start: new Date().toISOString(),
    };

    localStorage.setItem(AGENDA_PREFILL_KEY, JSON.stringify(payload));
    navigate("/app/agenda");
    toast.success("Lead enviado para a agenda");
  };

  const handleDeleteLead = () => {
    if (!leadId) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o lead "${conversation.contact_name || editName || "Sem nome"}"? Essa ação remove mensagens, interações e notas relacionadas.`
    );

    if (!confirmed) return;
    deleteLeadMut.mutate();
  };

  return (
    <div className="w-[16rem] shrink-0 overflow-auto border-l border-border bg-card xl:w-[17rem]">
      <div className="space-y-3 p-3">
        <Card className="space-y-2 border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {conversation.contact_name || editName || "Sem nome"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{conversation.contact_phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Etapa</p>
              <p className="mt-1 font-medium text-foreground">{leadStage}</p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Último toque</p>
              <p className="mt-1 font-medium text-foreground">{formatDateLabel(conversation.last_message_at)}</p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Origem</p>
              <p className="mt-1 font-medium text-foreground">{lead?.origin || "WhatsApp"}</p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Local</p>
              <p className="mt-1 font-medium text-foreground">{locationLabel || "Definir cidade/UF"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Próximo passo</p>
            <p className="mt-1 text-sm font-medium text-foreground">{nextRecommendedAction}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="h-8 justify-start gap-2 text-xs" onClick={handleGoToAgenda}>
              <CalendarDays className="h-3.5 w-3.5" />
              Agenda
            </Button>
            <Button size="sm" variant="outline" className="h-8 justify-start gap-2 text-xs" onClick={() => navigate("/app/pipeline")}>
              <KanbanSquare className="h-3.5 w-3.5" />
              Pipeline
            </Button>
            <Button size="sm" variant="outline" className="h-8 justify-start gap-2 text-xs" onClick={() => navigate("/app/map")}>
              <MapPin className="h-3.5 w-3.5" />
              Mapa
            </Button>
            <Button size="sm" variant="outline" className="h-8 justify-start gap-2 text-xs" onClick={() => navigate("/app/contacts")}>
              <Users className="h-3.5 w-3.5" />
              Contatos
            </Button>
          </div>

          {leadId && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 w-full justify-center gap-2 text-xs"
              onClick={handleDeleteLead}
              disabled={deleteLeadMut.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteLeadMut.isPending ? "Excluindo..." : "Excluir lead"}
            </Button>
          )}
        </Card>

        {lead && (
          <Card className="space-y-2 border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cadastro rápido</p>
              <Badge variant="secondary" className="text-[10px] font-medium">{leadStage}</Badge>
            </div>

            {lead.contact_phone && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Phone className="h-3 w-3" /> {lead.contact_phone}
              </p>
            )}

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateLeadMut.mutate();
              }}
            >
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Nome"
                className="h-8 text-xs"
              />
              <Input
                value={editPhone}
                onChange={(event) => {
                  const rawValue = event.target.value;
                  setEditPhone(rawValue.replace(/[^\d]/g, ""));
                }}
                placeholder="Telefone"
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-8 w-full text-xs" disabled={updateLeadMut.isPending}>
                Salvar contato
              </Button>
            </form>
          </Card>
        )}

        {lead && stages.length > 0 && (
          <Card className="space-y-2 border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mover etapa</p>
              <p className="text-[10px] text-muted-foreground">funil</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStageChange(stage.name)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px] font-medium transition-all duration-150",
                    leadStage === stage.name
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </Card>
        )}

        {leadId && (
          <Card className="space-y-2 border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notas</p>
              <span className="text-[10px] text-muted-foreground">contexto rápido</span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!noteText.trim()) return;
                noteMut.mutate();
              }}
              className="space-y-2"
            >
              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Praça, valor, objeção, disponibilidade..."
                className="min-h-[76px] resize-none text-xs"
              />
              <Button type="submit" size="sm" variant="secondary" className="h-8 w-full gap-2 text-xs" disabled={!noteText.trim() || noteMut.isPending}>
                <Send className="h-3.5 w-3.5" />
                Salvar nota
              </Button>
            </form>

            {notes.length > 0 && (
              <div className="space-y-2 pt-1">
                {notes.slice(0, 2).map((note) => (
                  <Card key={note.id} className="border bg-background p-2.5">
                    <p className="text-xs leading-relaxed text-foreground">{note.content}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {new Date(note.created_at).toLocaleString("pt-BR")}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}