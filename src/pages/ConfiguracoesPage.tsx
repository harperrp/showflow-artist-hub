import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Settings } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências.</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>Informações básicas da sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nome Artístico</Label>
            <Input placeholder="Seu nome artístico" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input placeholder="(00) 00000-0000" />
          </div>
          <Button>Salvar Alterações</Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Conexão Supabase</CardTitle>
          <CardDescription>Status da conexão com o backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p><span className="font-medium">VITE_SUPABASE_URL:</span>{' '}
              <span className="text-muted-foreground">{import.meta.env.VITE_SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado'}</span>
            </p>
            <p><span className="font-medium">VITE_SUPABASE_ANON_KEY:</span>{' '}
              <span className="text-muted-foreground">{import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Não configurado'}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Configure as variáveis de ambiente no painel de Secrets do Lovable ou em um arquivo .env.local para conectar ao seu projeto Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
