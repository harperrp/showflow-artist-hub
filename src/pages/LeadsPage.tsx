import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, Mail, Phone, MapPin } from 'lucide-react';

const mockLeads = [
  { id: '1', name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-0001', city: 'São Paulo', source: 'Instagram', stage: 'Novo', value: 5000 },
  { id: '2', name: 'Maria Eventos', email: 'maria@eventos.com', phone: '(21) 98888-0002', city: 'Rio de Janeiro', source: 'Indicação', stage: 'Contato', value: 12000 },
  { id: '3', name: 'Pedro Festas', email: 'pedro@festas.com', phone: '(31) 97777-0003', city: 'Belo Horizonte', source: 'Site', stage: 'Proposta', value: 8000 },
  { id: '4', name: 'Ana Produtora', email: 'ana@prod.com', phone: '(41) 96666-0004', city: 'Curitiba', source: 'Instagram', stage: 'Negociação', value: 15000 },
  { id: '5', name: 'Carlos Bar', email: 'carlos@bar.com', phone: '(51) 95555-0005', city: 'Porto Alegre', source: 'Indicação', stage: 'Novo', value: 3000 },
];

const stageColors: Record<string, string> = {
  'Novo': 'bg-accent/10 text-accent border-accent/20',
  'Contato': 'bg-primary/10 text-primary border-primary/20',
  'Proposta': 'bg-warning/10 text-warning border-warning/20',
  'Negociação': 'bg-success/10 text-success border-success/20',
};

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const filtered = mockLeads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Gerencie seus contatos e oportunidades.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Novo Lead</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cidade..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((lead) => (
          <Card key={lead.id} className="shadow-card hover:shadow-card-hover transition-all cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.source}</p>
                  </div>
                </div>
                <Badge variant="outline" className={stageColors[lead.stage]}>{lead.stage}</Badge>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{lead.email}</div>
                <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{lead.phone}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{lead.city}</div>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Valor estimado</span>
                <span className="font-display font-bold text-sm">
                  {lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
