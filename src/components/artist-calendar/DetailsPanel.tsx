import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDateTimeLabel, formatMoneyBRL, statusLabel } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/calendar-types";
import { Calendar, ExternalLink, MapPinned, Pencil, User, Wallet, GitBranch, FileText, StickyNote } from "lucide-react";

type Props = {
  selected: CalendarEvent | null;
  onEdit: () => void;
};

function statusBadgeClass(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-status-confirmed/15 text-status-confirmed border-status-confirmed/40";
    case "negotiation":
      return "bg-status-negotiation/15 text-status-negotiation border-status-negotiation/45";
    case "blocked":
      return "bg-status-blocked/15 text-status-blocked border-status-blocked/45";
    case "hold":
      return "bg-status-hold/15 text-status-hold border-status-hold/45";
  }
}

function statusDotColor(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed": return "bg-status-confirmed";
    case "negotiation": return "bg-status-negotiation";
    case "blocked": return "bg-status-blocked";
    case "hold": return "bg-status-hold";
  }
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

export function DetailsPanel({ selected, onEdit }: Props) {
  if (!selected) {
    return (
      <Card className="flex h-full flex-col items-center justify-center border border-dashed border-border/60 bg-card/50 p-8 text-center shadow-soft backdrop-blur-sm">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="mt-4 text-sm font-semibold">Nenhum evento selecionado</div>
        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
          Clique em um evento no calendário para ver detalhes, contratante e links.
        </p>
      </Card>
    );
  }

  const locationLabel = [selected.city, selected.state].filter(Boolean).join(" / ") || "—";
  const mapsQuery = encodeURIComponent([selected.city, selected.state].filter(Boolean).join(", "));
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : undefined;

  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card/80 shadow-soft backdrop-blur-sm">
      {/* Status accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-1", statusDotColor(selected.status))} />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold tracking-tight">{selected.title}</div>
          </div>
          <Badge variant="outline" className={cn("shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide", statusBadgeClass(selected.status))}>
            {statusLabel(selected.status)}
          </Badge>
        </div>

        <Separator className="my-4" />

        <div className="space-y-0.5">
          <DetailRow icon={Calendar} label="Data" value={formatDateTimeLabel(selected.start)} />
          <DetailRow icon={User} label="Contratante" value={selected.contractorName || "—"} />
          <DetailRow icon={MapPinned} label="Local" value={locationLabel} />
          <DetailRow icon={Wallet} label="Cachê" value={formatMoneyBRL(selected.fee)} />
          <DetailRow icon={GitBranch} label="Funil" value={selected.funnelStage || "—"} />
          <DetailRow icon={FileText} label="Contrato" value={selected.contractStatus || "—"} />
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-2">
          <Button onClick={onEdit} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Editar evento
          </Button>

          {mapsUrl && (
            <Button asChild variant="outline" size="sm" className="justify-between text-xs">
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <span className="flex items-center gap-2">
                  <MapPinned className="h-3.5 w-3.5" />
                  Abrir no Maps
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </Button>
          )}
        </div>

        {selected.notes && (
          <div className="mt-4 rounded-lg bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              Notas
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{selected.notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
