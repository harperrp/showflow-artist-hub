import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar, Music, DollarSign, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/shows', icon: Music, label: 'Shows' },
  { to: '/receita', icon: DollarSign, label: 'Receita' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <Music className="h-6 w-6 text-sidebar-primary" />
        <span className="font-display text-xl font-bold text-sidebar-primary">ShowCRM</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 text-xs text-sidebar-foreground/50 truncate">{user?.email}</div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
