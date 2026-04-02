import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

const stages = [
  {
    name: 'Novo', color: 'border-accent', leads: [
      { id: '1', name: 'João Silva', value: 5000, city: 'São Paulo' },
      { id: '5', name: 'Carlos Bar', value: 3000, city: 'Porto Alegre' },
    ]
  },
  {
    name: 'Contato', color: 'border-primary', leads: [
      { id: '2', name: 'Maria Eventos', value: 12000, city: 'Rio de Janeiro' },
    ]
  },
  {
    name: 'Proposta', color: 'border-warning', leads: [
      { id: '3', name: 'Pedro Festas', value: 8000, city: 'Belo Horizonte' },
    ]
  },
  {
    name: 'Negociação', color: 'border-success', leads: [
      { id: '4', name: 'Ana Produtora', value: 15000, city: 'Curitiba' },
    ]
  },
  {
    name: 'Fechado', color: 'border-primary', leads: []
  },
];

export default function PipelinePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground">Visualize seu funil de vendas.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.name} className="min-w-[280px] flex-shrink-0">
            <div className={`rounded-t-lg border-t-4 ${stage.color} bg-card shadow-card`}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-display font-semibold">{stage.name}</h3>
                <Badge variant="secondary" className="text-xs">{stage.leads.length}</Badge>
              </div>
              <div className="p-3 space-y-3 min-h-[200px]">
                {stage.leads.map((lead) => (
                  <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{lead.name}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{lead.city}</span>
                        <span className="font-semibold">
                          {lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stage.leads.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum lead nesta etapa</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
