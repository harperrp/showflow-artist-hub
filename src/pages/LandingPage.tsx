import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Users, Calendar, DollarSign, GitBranch, BarChart3, ArrowRight, Star, CheckCircle } from 'lucide-react';

const features = [
  { icon: Users, title: 'Gestão de Leads', desc: 'Capture e organize seus contatos de forma inteligente.' },
  { icon: GitBranch, title: 'Pipeline Comercial', desc: 'Visualize e gerencie cada etapa do funil de vendas.' },
  { icon: Calendar, title: 'Agenda de Shows', desc: 'Controle datas, cidades e status dos seus eventos.' },
  { icon: DollarSign, title: 'Controle de Receita', desc: 'Acompanhe seus ganhos e previsões financeiras.' },
  { icon: BarChart3, title: 'Métricas em Tempo Real', desc: 'Dashboards intuitivos com KPIs do seu negócio.' },
  { icon: Music, title: 'Feito para Artistas', desc: 'Fluxos pensados para a rotina de quem faz show.' },
];

const testimonials = [
  { name: 'Lucas Martins', role: 'Cantor Sertanejo', text: 'ShowCRM organizou toda minha agenda. Hoje sei exatamente quanto faturei e quais leads estão quentes.' },
  { name: 'Ana Beatriz', role: 'DJ & Produtora', text: 'Finalmente um CRM que entende a rotina de artista. Pipeline visual e agenda integrada são incríveis.' },
  { name: 'Rodrigo Alves', role: 'Manager de Banda', text: 'Gerenciar 3 bandas ficou muito mais simples. Os relatórios de receita são essenciais.' },
];

const plans = [
  { name: 'Starter', price: 'Grátis', features: ['Até 50 leads', 'Agenda básica', 'Pipeline simples', 'Suporte por email'] },
  { name: 'Pro', price: 'R$ 79/mês', popular: true, features: ['Leads ilimitados', 'Agenda completa', 'Pipeline avançado', 'Relatórios de receita', 'Upload de arquivos', 'Suporte prioritário'] },
  { name: 'Enterprise', price: 'Sob consulta', features: ['Tudo do Pro', 'Multi-artistas', 'API personalizada', 'Onboarding dedicado', 'SLA garantido'] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">ShowCRM</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Depoimentos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/registro">
              <Button size="sm">Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero pt-32 pb-20">
        <div className="container text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Star className="h-3.5 w-3.5" />
              CRM #1 para artistas e shows
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
              Gerencie seus shows com
              <span className="block text-primary"> inteligência e estilo</span>
            </h1>
            <p className="mt-6 text-lg text-primary-foreground/70 max-w-2xl mx-auto">
              Controle leads, agenda, pipeline comercial e receita em um único lugar. 
              Feito por quem entende a rotina de artistas.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link to="/registro">
                <Button size="lg" className="text-base px-8">
                  Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#funcionalidades">
                <Button variant="outline" size="lg" className="text-base px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                  Saiba Mais
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Tudo que você precisa</h2>
            <p className="mt-3 text-lg text-muted-foreground">Ferramentas poderosas para organizar sua carreira artística.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="shadow-card hover:shadow-card-hover transition-all group">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-24 bg-muted/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Planos para cada momento</h2>
            <p className="mt-3 text-lg text-muted-foreground">Comece grátis e escale conforme sua carreira cresce.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((p) => (
              <Card key={p.name} className={`relative shadow-card hover:shadow-card-hover transition-all ${p.popular ? 'border-primary ring-2 ring-primary/20' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                    Mais Popular
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-2 text-3xl font-extrabold font-display">{p.price}</p>
                  <ul className="mt-6 space-y-3">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link to="/registro">
                    <Button className="mt-8 w-full" variant={p.popular ? 'default' : 'outline'}>
                      {p.name === 'Enterprise' ? 'Fale Conosco' : 'Escolher Plano'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Quem usa, recomenda</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <Card key={t.name} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                  <div className="mt-4 border-t pt-4">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">ShowCRM</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 ShowCRM. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
