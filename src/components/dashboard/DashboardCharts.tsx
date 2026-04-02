import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { mockMonthlyStats, mockFunnelStats, formatMoneyBRL } from "@/lib/mock-data";

const FUNNEL_COLORS = [
  "hsl(220, 18%, 75%)",
  "hsl(200, 65%, 52%)",
  "hsl(262, 60%, 55%)",
  "hsl(40, 90%, 52%)",
  "hsl(215, 80%, 56%)",
  "hsl(152, 56%, 46%)",
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border bg-card shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-3 pb-4">
        {children}
      </div>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  fontSize: "12px",
  boxShadow: "var(--shadow-soft)",
};

export function ShowsPerMonthChart() {
  return (
    <ChartCard title="Shows por Mês">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockMonthlyStats} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Shows"]} />
            <Bar dataKey="shows" fill="hsl(152, 56%, 46%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function RevenueChart() {
  return (
    <ChartCard title="Receita por Mês">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockMonthlyStats} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatMoneyBRL(value), "Receita"]} />
            <Bar dataKey="revenue" fill="hsl(228, 58%, 46%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function FunnelPieChart() {
  return (
    <ChartCard title="Leads por Etapa">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={mockFunnelStats}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              fill="#8884d8"
              paddingAngle={3}
              dataKey="count"
              nameKey="stage"
              label={({ stage, count }) => `${stage}: ${count}`}
              labelLine={false}
              strokeWidth={0}
            >
              {mockFunnelStats.map((_, index) => (
                <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string, props: any) => [
                `${value} leads (${formatMoneyBRL(props.payload.value)})`,
                props.payload.stage,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function LeadsPerMonthChart() {
  return (
    <ChartCard title="Novos Leads por Mês">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockMonthlyStats} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Leads"]} />
            <Bar dataKey="leads" fill="hsl(40, 90%, 52%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
