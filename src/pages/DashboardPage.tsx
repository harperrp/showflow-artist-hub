import MetricCard from '@/components/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, DollarSign, TrendingUp, Music, MapPin } from 'lucide-react';

const mockShows = [
  { id: '1', title: 'Festival de Verão', city: 'Salvador', date: '2026-04-15', status: 'confirmado' as const, value: 15000 },
  { id: '2', title: 'Casa de Shows SP', city: 'São Paulo', date: '2026-04-22', status: 'pendente' as const, value: 8000 },
  { id: '3', title: 'Festa Junina', city: 'Campina Grande', date: '2026-06-10', status: 'confirmado' as const, value: 12000 },
  { id: '4', title: 'Réveillon Praia', city: 'Florianópolis', date: '2026-12-31', status: 'pendente' as const, value: 25000 },
];

const statusColors: Record<string, string> = {
  confirmado: 'bg-success/10 text-success border-success/20',
  pendente: 'bg-warning/10 text-warning border-warning/20',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/20',
  realizado: 'bg-accent/10 text-accent border-accent/20',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio artístico.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} title="Total de Leads" value={47} change="+12% este mês" trend="up" />
        <MetricCard icon={Calendar} title="Próximos Shows" value={4} change="2 confirmados" trend="neutral" />
        <MetricCard icon={DollarSign} title="Receita Prevista" value="R$ 60.000" change="+23% vs mês anterior" trend="up" />
        <MetricCard icon={TrendingUp} title="Taxa de Conversão" value="32%" change="+5pp" trend="up" />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Próximos Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockShows.map((show) => (
              <div key={show.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Music className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{show.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {show.city}
                      <span>•</span>
                      {new Date(show.date).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display font-bold">
                    {show.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <Badge variant="outline" className={statusColors[show.status]}>
                    {show.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
