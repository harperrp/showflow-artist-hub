import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock } from 'lucide-react';

const months = ['Abril 2026', 'Maio 2026', 'Junho 2026'];
const events = [
  { id: '1', title: 'Festival de Verão', city: 'Salvador', date: '2026-04-15', time: '20:00', status: 'confirmado' },
  { id: '2', title: 'Casa de Shows SP', city: 'São Paulo', date: '2026-04-22', time: '22:00', status: 'pendente' },
  { id: '3', title: 'Evento Corporativo', city: 'Brasília', date: '2026-05-05', time: '19:00', status: 'confirmado' },
  { id: '4', title: 'Festa Junina', city: 'Campina Grande', date: '2026-06-10', time: '18:00', status: 'confirmado' },
];

const statusMap: Record<string, string> = {
  confirmado: 'bg-success/10 text-success border-success/20',
  pendente: 'bg-warning/10 text-warning border-warning/20',
};

export default function AgendaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Agenda</h1>
        <p className="text-muted-foreground">Seu calendário de shows e eventos.</p>
      </div>

      <div className="space-y-8">
        {months.map((month) => {
          const monthEvents = events.filter(e => {
            const d = new Date(e.date);
            const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return label.charAt(0).toUpperCase() + label.slice(1) === month ||
              `${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][d.getMonth()]} ${d.getFullYear()}` === month;
          });
          if (monthEvents.length === 0) return null;
          return (
            <div key={month}>
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {month}
              </h2>
              <div className="space-y-3">
                {monthEvents.map((event) => (
                  <Card key={event.id} className="shadow-card hover:shadow-card-hover transition-all">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[48px]">
                          <p className="text-2xl font-bold font-display">{new Date(event.date).getDate()}</p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {new Date(event.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.city}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.time}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusMap[event.status]}>{event.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
