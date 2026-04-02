import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Music, MapPin, Plus } from 'lucide-react';

const shows = [
  { id: '1', title: 'Festival de Verão', city: 'Salvador', state: 'BA', venue: 'Arena Fonte Nova', date: '2026-04-15', value: 15000, status: 'confirmado' },
  { id: '2', title: 'Casa de Shows SP', city: 'São Paulo', state: 'SP', venue: 'Espaço das Américas', date: '2026-04-22', value: 8000, status: 'pendente' },
  { id: '3', title: 'Evento Corporativo', city: 'Brasília', state: 'DF', venue: 'Centro de Convenções', date: '2026-05-05', value: 20000, status: 'confirmado' },
  { id: '4', title: 'Festa Junina', city: 'Campina Grande', state: 'PB', venue: 'Parque do Povo', date: '2026-06-10', value: 12000, status: 'confirmado' },
  { id: '5', title: 'Réveillon Praia', city: 'Florianópolis', state: 'SC', venue: 'Praia de Jurerê', date: '2026-12-31', value: 25000, status: 'pendente' },
];

const statusColors: Record<string, string> = {
  confirmado: 'bg-success/10 text-success border-success/20',
  pendente: 'bg-warning/10 text-warning border-warning/20',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/20',
  realizado: 'bg-accent/10 text-accent border-accent/20',
};

export default function ShowsPage() {
  const total = shows.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Shows</h1>
          <p className="text-muted-foreground">
            {shows.length} shows cadastrados • Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Novo Show</Button>
      </div>

      <div className="space-y-3">
        {shows.map((show) => (
          <Card key={show.id} className="shadow-card hover:shadow-card-hover transition-all cursor-pointer">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{show.title}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{show.city}/{show.state}</span>
                    <span>{show.venue}</span>
                    <span>{new Date(show.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display font-bold text-lg">
                  {show.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <Badge variant="outline" className={statusColors[show.status]}>{show.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
