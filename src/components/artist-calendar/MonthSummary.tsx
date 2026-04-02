import { CalendarDays, Handshake, MapPin, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoneyBRL, monthStats } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/calendar-types";

type Props = {
  referenceDate: Date;
  events: CalendarEvent[];
};

const statusDot: Record<string, string> = {
  confirmed: "bg-status-confirmed",
  negotiation: "bg-status-negotiation",
  free: "bg-status-free",
  revenue: "bg-brand-2",
};

function StatCard({
  icon: Icon,
  label,
  value,
  dotColor,
  delay,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  dotColor: string;
  delay: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3.5",
        "shadow-soft backdrop-blur-sm transition-all duration-200 hover:shadow-elev hover:-translate-y-0.5",
        "animate-fade-in"
      )}
      style={{ animationDelay: delay }}
    >
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary/10">
        <Icon className="h-4.5 w-4.5" />
        <span className={cn("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card", dotColor)} />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

export function MonthSummary({ referenceDate, events }: Props) {
  const stats = monthStats(referenceDate, events);
  const monthLabel = referenceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-accent/30 p-6 shadow-elev">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 bg-hero opacity-50" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-2/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand/8 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand-2" />
              Resumo do mês
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {monthLabel}
            </h1>
          </div>
          {stats.estimatedRevenue > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-status-confirmed/10 px-3 py-1.5 text-xs font-semibold text-status-confirmed">
              <TrendingUp className="h-3.5 w-3.5" />
              {stats.confirmedCount} show{stats.confirmedCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={MapPin}
            label="Shows fechados"
            value={String(stats.confirmedCount)}
            dotColor={statusDot.confirmed}
            delay="0ms"
          />
          <StatCard
            icon={Handshake}
            label="Em negociação"
            value={String(stats.negotiationCount)}
            dotColor={statusDot.negotiation}
            delay="60ms"
          />
          <StatCard
            icon={CalendarDays}
            label="Dias livres"
            value={String(stats.freeDays)}
            dotColor={statusDot.free}
            delay="120ms"
          />
          <StatCard
            icon={Wallet}
            label="Faturamento"
            value={formatMoneyBRL(stats.estimatedRevenue)}
            dotColor={statusDot.revenue}
            delay="180ms"
          />
        </div>
      </div>
    </Card>
  );
}
