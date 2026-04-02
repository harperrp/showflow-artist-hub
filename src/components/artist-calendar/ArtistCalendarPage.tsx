import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Filter, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarStatus } from "@/lib/calendar-types";
import { statusLabel } from "@/lib/calendar-utils";
import { useOrg } from "@/providers/OrgProvider";
import { useCalendarEvents, useLeads } from "@/hooks/useCrmQueries";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/geocoding";

import { MonthSummary } from "./MonthSummary";
import { DetailsPanel } from "./DetailsPanel";
import { EventDialog, type AgendaPrefill, type EventDialogEvent, type EventDialogResult } from "./EventDialog";

type DbCalendarEvent = {
  id: string;
  title: string;
  status: EventDialogEvent["status"];
  start_time: string;
  end_time: string | null;
  city: string | null;
  state: string | null;
  fee: number | null;
  stage: string | null;
  contractor_name: string | null;
  contract_status: "pending" | "signed" | "canceled" | null;
  notes: string | null;
  lead_id: string | null;
};

type LeadLite = {
  id: string;
  contractor_name: string;
  stage: string | null;
  city: string | null;
  state: string | null;
  fee: number | null;
  contact_phone: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const AGENDA_PREFILL_KEY = "crm:agenda-prefill";

function mapDbEventToUi(row: DbCalendarEvent): EventDialogEvent {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    start: row.start_time,
    end: row.end_time ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    fee: row.fee ?? undefined,
    funnelStage: row.stage ?? undefined,
    contractorName: row.contractor_name ?? undefined,
    contractStatus:
      row.contract_status === "pending"
        ? "Pendente"
        : row.contract_status === "signed"
          ? "Assinado"
          : row.contract_status === "canceled"
            ? "Cancelado"
            : undefined,
    notes: row.notes ?? undefined,
    leadId: row.lead_id ?? undefined,
  };
}

function statusClass(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-status-confirmed/14 border-status-confirmed/40";
    case "negotiation":
      return "bg-status-negotiation/14 border-status-negotiation/45";
    case "blocked":
      return "bg-status-blocked/14 border-status-blocked/45";
    case "hold":
      return "bg-status-hold/14 border-status-hold/45";
  }
}

function eventBg(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed":
      return "hsl(var(--status-confirmed))";
    case "negotiation":
      return "hsl(var(--status-negotiation))";
    case "blocked":
      return "hsl(var(--status-blocked))";
    case "hold":
      return "hsl(var(--status-hold))";
  }
}

function deriveLeadStage(event: EventDialogEvent) {
  if (event.status === "confirmed") return "Fechado";
  if (event.funnelStage?.trim()) return event.funnelStage.trim();
  if (event.status === "hold") return "Proposta";
  if (event.status === "blocked") return "Contato";
  return "Negociação";
}

export function ArtistCalendarPage() {
  const { activeOrgId } = useOrg();
  const { data: dbEvents = [], isLoading } = useCalendarEvents(activeOrgId);
  const { data: rawLeads = [] } = useLeads(activeOrgId);
  const leads = React.useMemo(() => rawLeads as LeadLite[], [rawLeads]);
  const events = React.useMemo(() => (dbEvents as DbCalendarEvent[]).map(mapDbEventToUi), [dbEvents]);
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<EventDialogEvent | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [dialogDateISO, setDialogDateISO] = React.useState<string>(new Date().toISOString());
  const [dialogEvent, setDialogEvent] = React.useState<EventDialogEvent | null>(null);
  const [prefill, setPrefill] = React.useState<AgendaPrefill | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<CalendarStatus | "all">("all");
  const [referenceDate, setReferenceDate] = React.useState<Date>(new Date());

  const filteredEvents = React.useMemo(() => {
    if (statusFilter === "all") return events;
    if (statusFilter === "free") return [];
    return events.filter((event) => event.status === statusFilter);
  }, [events, statusFilter]);

  const calendarEvents: EventInput[] = React.useMemo(
    () =>
      filteredEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        backgroundColor: eventBg(event.status),
        borderColor: eventBg(event.status),
        textColor: "hsl(var(--primary-foreground))",
        extendedProps: { status: event.status },
      })),
    [filteredEvents]
  );

  const openCreate = React.useCallback((iso: string, nextPrefill: AgendaPrefill | null = null) => {
    setDialogMode("create");
    setDialogDateISO(nextPrefill?.start || iso);
    setDialogEvent(null);
    setPrefill(nextPrefill);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((event: EventDialogEvent) => {
    setDialogMode("edit");
    setDialogEvent(event);
    setDialogDateISO(event.start);
    setPrefill(null);
    setDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (!activeOrgId) return;

    const raw = localStorage.getItem(AGENDA_PREFILL_KEY);
    if (!raw) return;

    try {
      const agendaPrefill = JSON.parse(raw) as AgendaPrefill;
      localStorage.removeItem(AGENDA_PREFILL_KEY);
      openCreate(agendaPrefill.start || new Date().toISOString(), agendaPrefill);
      toast.success("Agenda pronta para continuar o funil", {
        description: "Os dados do lead foram carregados no novo evento.",
      });
    } catch {
      localStorage.removeItem(AGENDA_PREFILL_KEY);
    }
  }, [activeOrgId, openCreate]);

  function handleDateSelect(arg: DateSelectArg) {
    openCreate(arg.startStr);
  }

  function handleEventClick(arg: EventClickArg) {
    const event = events.find((item) => item.id === arg.event.id) ?? null;
    setSelected(event);
  }

  async function handleEventDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const nextStart = arg.event.start?.toISOString();
    if (!nextStart) return;

    try {
      const { error } = await db.from("calendar_events").update({ start_time: nextStart }).eq("id", id);
      if (error) throw error;

      const movedEvent = events.find((event) => event.id === id);
      if (movedEvent?.leadId) {
        await db.from("leads").update({ event_date: nextStart }).eq("id", movedEvent.leadId);
      }

      await qc.invalidateQueries({ queryKey: ["events", activeOrgId] });
      await qc.invalidateQueries({ queryKey: ["leads", activeOrgId] });
      if (selected?.id === id) setSelected((current) => (current ? { ...current, start: nextStart } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast("Não foi possível mover o evento", { description: message });
      arg.revert();
    }
  }

  async function handleDialogResult(result: EventDialogResult) {
    if (!activeOrgId) return;

    if (result.type === "save") {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast("Você precisa estar logado");
        return;
      }

      const payload: Record<string, string | number | null> = {
        id: result.event.id,
        organization_id: activeOrgId,
        lead_id: result.event.leadId ?? null,
        status: result.event.status,
        title: result.event.title,
        start_time: result.event.start,
        end_time: result.event.end ?? null,
        city: result.event.city ?? null,
        state: result.event.state ?? null,
        contractor_name: result.event.contractorName ?? null,
        fee: result.event.fee ?? null,
        stage: result.event.funnelStage ?? null,
        contract_status:
          result.event.contractStatus === "Pendente"
            ? "pending"
            : result.event.contractStatus === "Assinado"
              ? "signed"
              : result.event.contractStatus === "Cancelado"
                ? "canceled"
                : null,
        notes: result.event.notes ?? null,
        created_by: user.id,
      };

      let coordinates: { lat: number; lng: number } | null = null;
      if (result.event.city || result.event.state) {
        coordinates = await geocodeAddress({
          city: result.event.city,
          state: result.event.state,
        });
        if (coordinates) {
          payload.latitude = coordinates.lat;
          payload.longitude = coordinates.lng;
        }
      }

      const { error } = await db.from("calendar_events").upsert(payload, { onConflict: "id" });
      if (error) {
        toast("Não foi possível salvar", { description: error.message });
        return;
      }

      if (result.event.leadId && result.event.syncLead) {
        const leadUpdate: Record<string, string | number | null> = {
          contractor_name: result.event.contractorName ?? null,
          city: result.event.city ?? null,
          state: result.event.state ?? null,
          fee: result.event.fee ?? null,
          stage: deriveLeadStage(result.event),
          event_date: result.event.start,
        };

        if (coordinates) {
          leadUpdate.latitude = coordinates.lat;
          leadUpdate.longitude = coordinates.lng;
        }

        const { error: leadError } = await db.from("leads").update(leadUpdate).eq("id", result.event.leadId);
        if (leadError) {
          toast("Evento salvo, mas o lead não foi sincronizado", { description: leadError.message });
        }
      }

      await qc.invalidateQueries({ queryKey: ["events", activeOrgId] });
      await qc.invalidateQueries({ queryKey: ["leads", activeOrgId] });
      await qc.invalidateQueries({ queryKey: ["crm-leads", activeOrgId] });
      await qc.invalidateQueries({ queryKey: ["crm-conversations", activeOrgId] });
      setSelected(result.event);
      setPrefill(null);
      toast.success("Evento salvo", {
        description: result.event.leadId
          ? "Agenda e lead ficaram conectados nessa operação."
          : "Evento salvo na agenda.",
      });
      return;
    }

    if (result.type === "delete") {
      const { error } = await db.from("calendar_events").delete().eq("id", result.id);
      if (error) {
        toast("Não foi possível remover", { description: error.message });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["events", activeOrgId] });
      setSelected((current) => (current?.id === result.id ? null : current));
    }
  }

  const heroRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const element = heroRef.current;
    if (!element) return;
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 100;
      const my = ((event.clientY - rect.top) / rect.height) * 100;
      element.style.setProperty("--mx", `${mx.toFixed(2)}%`);
      element.style.setProperty("--my", `${my.toFixed(2)}%`);
    };
    element.addEventListener("pointermove", onMove);
    return () => element.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <div ref={heroRef} className="fade-up">
          <MonthSummary referenceDate={referenceDate} events={events} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden border border-border/60 bg-card/80 shadow-soft backdrop-blur-sm">
            <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight">Calendário</div>
                  <div className="text-xs text-muted-foreground">Mês • Semana • Lista • conectado ao lead</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => openCreate(new Date().toISOString())} size="sm" className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Novo evento
                </Button>

                <Separator orientation="vertical" className="hidden h-7 md:block" />

                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as CalendarStatus | "all")}
                    className="cursor-pointer bg-transparent text-xs font-medium text-foreground outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="negotiation">Negociação</option>
                    <option value="confirmed">Show fechado</option>
                    <option value="hold">Reserva técnica</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="flex flex-wrap gap-1.5">
                {(["confirmed", "negotiation", "hold", "blocked"] as const).map((status) => (
                  <Badge key={status} variant="outline" className={cn("border text-[0.65rem] font-medium", statusClass(status))}>
                    <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", {
                      "bg-status-confirmed": status === "confirmed",
                      "bg-status-negotiation": status === "negotiation",
                      "bg-status-hold": status === "hold",
                      "bg-status-blocked": status === "blocked",
                    })} />
                    {statusLabel(status)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="px-5 pb-2">
              <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                {prefill?.leadId ? (
                  <span>
                    Você veio do Inbox com o lead <strong className="text-foreground">{prefill.contractorName || "selecionado"}</strong>. Salve o evento para refletir no funil, agenda e mapa.
                  </span>
                ) : (
                  <span>Use a agenda para registrar o próximo passo comercial e manter o lead sincronizado com cidade, data e status.</span>
                )}
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-xl border border-border/40 bg-background/60 p-2">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,listWeek",
                  }}
                  initialView="dayGridMonth"
                  height="auto"
                  locale={ptBrLocale}
                  selectable
                  selectMirror
                  editable
                  eventStartEditable
                  eventDurationEditable={false}
                  dayMaxEvents
                  events={calendarEvents}
                  select={handleDateSelect}
                  eventClick={handleEventClick}
                  eventDrop={handleEventDrop}
                  datesSet={(arg) => setReferenceDate(arg.start)}
                  eventClassNames={() => ["rounded-md", "shadow-sm"]}
                />
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <DetailsPanel selected={selected} onEdit={() => (selected ? openEdit(selected) : null)} />

            <Card className="border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-2" />
                Regras inteligentes
              </div>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-confirmed" />
                  Bloqueia confirmação em data já fechada.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-negotiation" />
                  Alerta negociações no mesmo dia.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-hold" />
                  Sugere datas alternativas em conflito.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  Vincula lead e agenda para o funil não se perder entre telas.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      <EventDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setPrefill(null);
        }}
        mode={dialogMode}
        initialDateISO={dialogDateISO}
        initialEvent={dialogEvent}
        existingEvents={events}
        leads={leads}
        prefill={prefill}
        onResult={handleDialogResult}
      />
    </div>
  );
}
