import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Link2, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CalendarEvent, ContractStatus } from "@/lib/calendar-types";

function dayConflicts(target: Date, events: CalendarEvent[]) {
  const dayKey = format(target, "yyyy-MM-dd");
  const sameDay = events.filter((event) => format(parseISO(event.start), "yyyy-MM-dd") === dayKey);
  return {
    hasConfirmed: sameDay.some((event) => event.status === "confirmed"),
    negotiationCount: sameDay.filter((event) => event.status === "negotiation").length,
  };
}

function suggestAlternativeDates(target: Date, events: CalendarEvent[]) {
  const suggestions: Date[] = [];
  let cursor = new Date(target);
  let tries = 0;
  while (suggestions.length < 3 && tries < 21) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    const { hasConfirmed, negotiationCount } = dayConflicts(cursor, events);
    if (!hasConfirmed && negotiationCount === 0) suggestions.push(cursor);
    tries += 1;
  }
  return suggestions.map((date) => ({
    date,
    label: format(date, "dd/MM/yyyy • HH:mm"),
  }));
}

const schema = z.object({
  leadId: z.string().optional(),
  syncLead: z.boolean().default(true),
  title: z.string().min(3, "Informe um título"),
  status: z.enum(["negotiation", "confirmed", "hold", "blocked"]),
  start: z.string().min(1, "Selecione a data e hora"),
  contractorName: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, "Use a sigla da UF").optional(),
  fee: z.coerce.number().optional(),
  funnelStage: z.string().optional(),
  contractStatus: z.enum(["Pendente", "Assinado", "Cancelado"]).optional().or(z.literal("")),
  leadUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  contractUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type LeadOption = {
  id: string;
  contractor_name: string;
  stage?: string | null;
  city?: string | null;
  state?: string | null;
  fee?: number | null;
  contact_phone?: string | null;
};

export type AgendaPrefill = {
  leadId?: string | null;
  title?: string;
  contractorName?: string;
  city?: string;
  state?: string;
  fee?: number;
  funnelStage?: string;
  notes?: string;
  start?: string;
  contactPhone?: string;
};

export type EventDialogEvent = CalendarEvent & {
  leadId?: string | null;
  syncLead?: boolean;
};

export type EventDialogResult =
  | { type: "save"; event: EventDialogEvent }
  | { type: "delete"; id: string }
  | { type: "cancel" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialDateISO: string;
  initialEvent?: EventDialogEvent | null;
  existingEvents: CalendarEvent[];
  leads: LeadOption[];
  prefill?: AgendaPrefill | null;
  onResult: (result: EventDialogResult) => void;
};

type FormValues = z.infer<typeof schema>;

function toLocalInputValue(iso: string) {
  const date = parseISO(iso);
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function toISOFromLocalInput(value: string) {
  return new Date(value).toISOString();
}

export function EventDialog({
  open,
  onOpenChange,
  mode,
  initialDateISO,
  initialEvent,
  existingEvents,
  leads,
  prefill,
  onResult,
}: Props) {
  const base = React.useMemo<EventDialogEvent>(() => {
    if (initialEvent) return initialEvent;

    return {
      id: crypto.randomUUID(),
      title: prefill?.title || "Nova negociação",
      status: "negotiation",
      start: prefill?.start || initialDateISO,
      contractorName: prefill?.contractorName || "",
      city: prefill?.city || "",
      state: prefill?.state || "",
      fee: prefill?.fee,
      funnelStage: prefill?.funnelStage || "Negociação",
      contractStatus: "Pendente",
      leadUrl: "",
      contractUrl: "",
      notes: prefill?.notes || "",
      leadId: prefill?.leadId || undefined,
      syncLead: true,
    };
  }, [initialDateISO, initialEvent, prefill]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leadId: base.leadId || undefined,
      syncLead: base.syncLead ?? true,
      title: base.title,
      status: base.status,
      start: toLocalInputValue(base.start),
      contractorName: base.contractorName ?? "",
      city: base.city ?? "",
      state: base.state ?? "",
      fee: base.fee,
      funnelStage: base.funnelStage ?? "",
      contractStatus: base.contractStatus ?? "",
      leadUrl: base.leadUrl ?? "",
      contractUrl: base.contractUrl ?? "",
      notes: base.notes ?? "",
    },
  });

  React.useEffect(() => {
    form.reset({
      leadId: base.leadId || undefined,
      syncLead: base.syncLead ?? true,
      title: base.title,
      status: base.status,
      start: toLocalInputValue(base.start),
      contractorName: base.contractorName ?? "",
      city: base.city ?? "",
      state: base.state ?? "",
      fee: base.fee,
      funnelStage: base.funnelStage ?? "",
      contractStatus: base.contractStatus ?? "",
      leadUrl: base.leadUrl ?? "",
      contractUrl: base.contractUrl ?? "",
      notes: base.notes ?? "",
    });
  }, [base, form]);

  const selectedLeadId = form.watch("leadId");
  const selectedLead = React.useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const startDate = React.useMemo(() => new Date(form.watch("start")), [form]);
  const conflicts = React.useMemo(
    () => dayConflicts(startDate, existingEvents.filter((event) => event.id !== base.id)),
    [startDate, existingEvents, base.id]
  );
  const suggestions = React.useMemo(
    () => suggestAlternativeDates(startDate, existingEvents),
    [startDate, existingEvents]
  );

  const applyLeadContext = React.useCallback((leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    form.setValue("leadId", lead.id, { shouldDirty: true });
    form.setValue("contractorName", lead.contractor_name || "", { shouldDirty: true });
    form.setValue("city", lead.city || "", { shouldDirty: true });
    form.setValue("state", lead.state || "", { shouldDirty: true });
    form.setValue("funnelStage", lead.stage || "Negociação", { shouldDirty: true });

    if (typeof lead.fee === "number") {
      form.setValue("fee", lead.fee, { shouldDirty: true });
    }

    const currentTitle = form.getValues("title").trim();
    if (!currentTitle || currentTitle === "Nova negociação") {
      form.setValue("title", `Negociação — ${lead.contractor_name}`, { shouldDirty: true });
    }
  }, [form, leads]);

  function onSubmit(values: FormValues) {
    const startISO = toISOFromLocalInput(values.start);

    const { hasConfirmed, negotiationCount } = dayConflicts(
      new Date(values.start),
      existingEvents.filter((event) => event.id !== base.id)
    );
    if (values.status === "confirmed" && hasConfirmed) {
      toast("Essa data já tem show fechado", {
        description: "Não permitimos confirmar um novo show em um dia já fechado. Veja as datas alternativas sugeridas.",
      });
      return;
    }

    if (values.status === "negotiation" && negotiationCount >= 1) {
      toast("Conflito de negociação", {
        description: "Já existe negociação disputando esse dia. Você pode manter, mas vale alinhar prioridade.",
      });
    }

    const event: EventDialogEvent = {
      id: base.id,
      title: values.title,
      status: values.status,
      start: startISO,
      contractorName: values.contractorName || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      fee: typeof values.fee === "number" && !Number.isNaN(values.fee) ? values.fee : undefined,
      funnelStage: values.funnelStage || undefined,
      contractStatus: (values.contractStatus || undefined) as ContractStatus | undefined,
      leadUrl: values.leadUrl || undefined,
      contractUrl: values.contractUrl || undefined,
      notes: values.notes || undefined,
      leadId: values.leadId || undefined,
      syncLead: values.syncLead,
    };

    onResult({ type: "save", event });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Criar evento" : "Editar evento"}</DialogTitle>
          <DialogDescription>
            Conecte agenda, lead e negociação na mesma ação para o CRM não ficar solto.
          </DialogDescription>
        </DialogHeader>

        {(conflicts.hasConfirmed || conflicts.negotiationCount >= 2) && (
          <div className="rounded-lg border bg-card/60 p-3">
            <div className="text-sm font-semibold">Atenção: possíveis conflitos</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {conflicts.hasConfirmed ? "Existe show fechado nesse dia. " : ""}
              {conflicts.negotiationCount >= 2 ? "Duas ou mais negociações disputam esse dia. " : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Badge key={suggestion.label} variant="outline" className="border-status-hold/40 bg-status-hold/10">
                  {suggestion.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                Vincular ao lead
              </div>
              <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
                <FormField
                  control={form.control}
                  name="leadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead relacionado</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => {
                          field.onChange(value);
                          applyLeadContext(value);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um lead existente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.contractor_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="syncLead"
                  render={({ field }) => (
                    <FormItem className="flex h-full flex-row items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                      <div className="space-y-1">
                        <FormLabel className="text-sm">Atualizar lead junto</FormLabel>
                        <p className="text-xs text-muted-foreground">Sincroniza etapa, cidade, cachê e data.</p>
                      </div>
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {selectedLead && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Etapa: {selectedLead.stage || "Sem etapa"}</Badge>
                  {(selectedLead.city || selectedLead.state) && (
                    <Badge variant="outline">{[selectedLead.city, selectedLead.state].filter(Boolean).join(" / ")}</Badge>
                  )}
                  {selectedLead.contact_phone && <Badge variant="outline">{selectedLead.contact_phone}</Badge>}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Show — Festa da Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="negotiation">Negociação</SelectItem>
                        <SelectItem value="confirmed">Show fechado</SelectItem>
                        <SelectItem value="hold">Reserva técnica</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e hora</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cachê (R$)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="Ex: 18000" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="contractorName"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Contratante</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome / Empresa" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Goiânia" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: GO" maxLength={2} className="uppercase" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="funnelStage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etapa do funil</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Proposta" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status do contrato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Assinado">Assinado</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="leadUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do lead</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do contrato</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: pagar 50% na assinatura"
                      className={cn("min-h-24", field.value ? "" : "text-muted-foreground")}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-border/60 bg-primary/5 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                O que acontece ao salvar
              </div>
              <p className="mt-1 leading-relaxed">
                O evento vai para a agenda e, se houver lead vinculado com sincronização ligada, o CRM atualiza etapa, data, cidade, cachê e mantém funil e agenda conectados.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              {mode === "edit" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onResult({ type: "delete", id: base.id });
                    onOpenChange(false);
                  }}
                  className="border-status-blocked/40"
                >
                  Remover
                </Button>
              ) : null}

              <Button type="button" variant="secondary" onClick={() => onResult({ type: "cancel" })}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
