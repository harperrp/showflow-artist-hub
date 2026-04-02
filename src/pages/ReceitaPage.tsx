import MetricCard from '@/components/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Calendar, PiggyBank } from 'lucide-react';

const monthlyData = [
  { month: 'Jan', value: 12000 },
  { month: 'Fev', value: 18000 },
  { month: 'Mar', value: 8000 },
  { month: 'Abr', value: 23000 },
  { month: 'Mai', value: 20000 },
  { month: 'Jun', value: 12000 },
];

export default function ReceitaPage() {
  const total = monthlyData.reduce((s, m) => s + m.value, 0);
  const maxValue = Math.max(...monthlyData.map(m => m.value));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Receita</h1>
        <p className="text-muted-foreground">Acompanhe seus ganhos e previsões.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={DollarSign} title="Receita Total" value={total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} change="+15% vs período anterior" trend="up" />
        <MetricCard icon={TrendingUp} title="Ticket Médio" value={(total / monthlyData.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} trend="neutral" />
        <MetricCard icon={Calendar} title="Shows Realizados" value={monthlyData.length} change="6 no período" trend="neutral" />
        <MetricCard icon={PiggyBank} title="Melhor Mês" value="Abril" change="R$ 23.000" trend="up" />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Receita Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-64">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-semibold">
                  {m.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors"
                  style={{ height: `${(m.value / maxValue) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground font-medium">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
