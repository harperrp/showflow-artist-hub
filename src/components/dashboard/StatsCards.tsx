import { Card } from "@/components/ui/card";
import { CalendarDays, DollarSign, TrendingUp, Users, Clock, CheckCircle } from "lucide-react";
import { formatMoneyBRL } from "@/lib/mock-data";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  iconColor?: string;
  trend?: { value: number; positive: boolean };
}

export function StatCard({ icon: Icon, label, value, subtext, iconColor, trend }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden p-5 border bg-card shadow-card hover:shadow-soft transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor || "bg-primary/8 text-primary"}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
            trend.positive
              ? "bg-status-confirmed/10 text-status-confirmed"
              : "bg-destructive/10 text-destructive"
          }`}>
            <TrendingUp className={`h-3 w-3 ${!trend.positive && "rotate-180"}`} />
            {trend.value}%
          </div>
        )}
      </div>
      {subtext && <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>}
    </Card>
  );
}

interface DashboardStatsProps {
  confirmedShows: number;
  negotiationCount: number;
  totalLeads: number;
  estimatedRevenue: number;
  pendingContracts: number;
  freeDays: number;
}

export function DashboardStats({
  confirmedShows,
  negotiationCount,
  totalLeads,
  estimatedRevenue,
  pendingContracts,
  freeDays,
}: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={CheckCircle}
        label="Shows Agendados"
        value={confirmedShows}
        subtext="este mês"
        iconColor="bg-status-confirmed/10 text-status-confirmed"
        trend={{ value: 12, positive: true }}
      />
      <StatCard
        icon={Clock}
        label="Em Negociação"
        value={negotiationCount}
        subtext="aguardando resposta"
        iconColor="bg-status-negotiation/10 text-status-negotiation"
      />
      <StatCard
        icon={Users}
        label="Total de Leads"
        value={totalLeads}
        subtext="no funil"
        iconColor="bg-brand-2/10 text-brand-2"
        trend={{ value: 8, positive: true }}
      />
      <StatCard
        icon={DollarSign}
        label="Receita Projetada"
        value={formatMoneyBRL(estimatedRevenue)}
        subtext="confirmado + negociação"
        iconColor="bg-primary/8 text-primary"
        trend={{ value: 15, positive: true }}
      />
    </div>
  );
}
