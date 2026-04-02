import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  X,
} from "lucide-react";
import { useOrg } from "@/providers/OrgProvider";
import { useAuth } from "@/providers/AuthProvider";
import * as api from "@/services/api";
import { toast } from "sonner";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-status-confirmed/80",
  negotiation: "bg-status-negotiation/80",
  blocked: "bg-status-blocked/80",
  hold: "bg-status-hold/80",
};

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-status-confirmed",
  negotiation: "bg-status-negotiation",
  blocked: "bg-status-blocked",
  hold: "bg-status-hold",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  negotiation: "Negociação",
  blocked: "Bloqueado",
  hold: "Reserva",
};

export function CrmAgendaPage() {
  const { activeOrgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["crm-events", activeOrgId],
    queryFn: () => api.fetchEvents(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads", activeOrgId],
    queryFn: () => api.fetchLeads(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const createMut = useMutation({
    mutationFn: (form: any) =>
      api.createEvent({
        ...form,
        organization_id: activeOrgId!,
        created_by: user!.id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-events"] });
      toast.success("Evento criado");
      setCreateOpen(false);
      setCreateDate(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof events> = {};
    events.forEach((ev) => {
      const key = format(parseISO(ev.start_time), "yyyy-MM-dd");
      (map[key] ??= []).push(ev);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort(
        (a, b) =>
          parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime(),
      );
    });
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate[key] || [];
  }, [selectedDate, eventsByDate]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function handleDayClick(day: Date) {
    setSelectedDate(day);
    setSelectedEventId(null);
  }

  function handleEventClick(day: Date, eventId: string) {
    setSelectedDate(day);
    setSelectedEventId(eventId);
  }

  function handleCreateOnDay(day: Date) {
    setCreateDate(day);
    setCreateOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const leadId = String(fd.get("lead_id") || "").trim();
    const linkedLead = leads.find((l: any) => l.id === leadId);
    const city = String(fd.get("city") || "").trim();
    const data: any = {
      title: fd.get("title"),
      start_time: fd.get("start_time"),
      city: city || linkedLead?.city || null,
      state: linkedLead?.state || null,
      latitude: linkedLead?.latitude || null,
      longitude: linkedLead?.longitude || null,
      venue_name: linkedLead?.venue_name || null,
      notes: fd.get("notes") || null,
      lead_id: leadId || null,
      status: fd.get("status") || "negotiation",
    };
    createMut.mutate(data);
  }

  const monthEvents = useMemo(() => {
    const ms = startOfMonth(currentMonth);
    const me = endOfMonth(currentMonth);
    return events.filter((ev) => {
      const d = parseISO(ev.start_time);
      return d >= ms && d <= me;
    });
  }, [events, currentMonth]);

  const confirmed = monthEvents.filter((e) => e.status === "confirmed").length;
  const negotiation = monthEvents.filter((e) => e.status === "negotiation").length;

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {monthEvents.length} eventos •{" "}
            <span className="text-status-confirmed">{confirmed} confirmados</span> •{" "}
            <span className="text-status-negotiation">{negotiation} em negociação</span>
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateDate(new Date());
            setCreateOpen(true);
          }}
          className="gap-2 rounded-lg"
          size="sm"
        >
          <Plus className="h-4 w-4" /> Novo Evento
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs h-7 text-muted-foreground hover:text-foreground">
            Hoje
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Calendar Grid */}
        <Card className="flex-1 border bg-card shadow-card overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b bg-secondary/40">
            {weekDays.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2.5 tracking-wide uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate[key] || [];
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[80px] md:min-h-[96px] border-b border-r border-border/50 p-1.5 cursor-pointer transition-all duration-150 relative group
                    ${!inMonth ? "bg-muted/10" : "hover:bg-accent/30"}
                    ${isSelected ? "bg-primary/5 ring-1 ring-primary/30" : ""}
                    ${today && !isSelected ? "bg-primary/[0.03]" : ""}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`
                        text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors
                        ${!inMonth ? "text-muted-foreground/30" : "text-foreground/70"}
                        ${today ? "bg-primary text-primary-foreground font-semibold" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateOnDay(day);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(day, ev.id);
                        }}
                        className={`
                          w-full text-left text-[10px] md:text-[11px] leading-tight px-2 py-1 rounded-md truncate text-white font-medium
                          transition-all duration-150 hover:brightness-110 hover:shadow-sm
                          ${STATUS_COLORS[ev.status] || "bg-muted"}
                          ${selectedEventId === ev.id ? "ring-1 ring-white/80 shadow-sm" : ""}
                        `}
                        title={`${format(parseISO(ev.start_time), "HH:mm")} • ${ev.title}`}
                      >
                        <span className="opacity-90 mr-1">{format(parseISO(ev.start_time), "HH:mm")}</span>
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(day);
                        }}
                        className="text-[10px] md:text-[11px] text-primary hover:text-primary/80 px-1 font-semibold transition-colors"
                      >
                        +{dayEvents.length - 3} eventos
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Side panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {selectedDate ? (
            <Card className="border bg-card shadow-card p-5 space-y-4 animate-in fade-in-50 slide-in-from-right-2 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm capitalize">
                  {format(selectedDate, "EEEE, dd MMM", { locale: ptBR })}
                </h3>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCreateOnDay(selectedDate)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedDate(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Nenhum evento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Este dia está livre</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 text-xs"
                    onClick={() => handleCreateOnDay(selectedDate)}
                  >
                    <Plus className="h-3 w-3" /> Criar evento
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2.5">
                    {selectedDayEvents.map((ev) => (
                      <Card
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`
                          border p-3.5 space-y-2 transition-all duration-150 cursor-pointer
                          ${selectedEventId === ev.id ? "bg-primary/10 border-primary/30 shadow-sm" : "bg-accent/20 hover:bg-accent/30"}
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{ev.title}</p>
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0 font-medium"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 ${STATUS_DOT[ev.status] || ""}`} />
                            {STATUS_LABELS[ev.status] || ev.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(ev.start_time), "HH:mm")}
                          </span>
                          {ev.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {ev.city}
                              {ev.state && `, ${ev.state}`}
                            </span>
                          )}
                        </div>
                        {(ev as any).contractor_name && (
                          <p className="text-xs text-muted-foreground">🎤 {(ev as any).contractor_name}</p>
                        )}
                        {ev.fee != null && (
                          <p className="text-xs font-semibold text-status-confirmed">
                            {Number(ev.fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        )}
                        {ev.notes && <p className="text-xs text-muted-foreground italic">{ev.notes}</p>}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </Card>
          ) : (
            <Card className="border bg-card shadow-card p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                <CalendarIcon className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Selecione um dia</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clique em um dia para ver os eventos</p>
            </Card>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-1">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${STATUS_DOT[key]}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input name="title" required className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data e hora *</Label>
                <Input
                  name="start_time"
                  type="datetime-local"
                  required
                  className="mt-1"
                  defaultValue={
                    createDate
                      ? format(createDate, "yyyy-MM-dd") + "T20:00"
                      : ""
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  name="status"
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue="negotiation"
                >
                  <option value="negotiation">Negociação</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="hold">Reserva</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input name="city" className="mt-1" />
              </div>
              <div>
                <Label>Lead vinculado</Label>
                <select
                  name="lead_id"
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">Nenhum</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.contractor_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea name="notes" rows={3} className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>
              Criar Evento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
