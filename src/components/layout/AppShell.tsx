import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  Handshake,
  FileText,
  LogOut,
  LayoutDashboard,
  Map,
  DollarSign,
  Users,
  UsersRound,
  UserCog,
  ListChecks,
  Menu,
  X,
  Music,
  Crown,
  MessageSquare,
  Kanban,
  Smartphone,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { QuickAddMenu } from "./QuickAddMenu";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalSearch } from "@/components/ui/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function TopNavItem({
  to,
  icon: Icon,
  label,
  onClick,
  className,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          className
        )
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useOrg();
  const { role, roleLabel, canViewFinancialTotals, canManageLeads, isArtista } = useUserRole();
  const { isSuperAdmin } = useSuperAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allNavItems = [
    { to: "/app/inbox", icon: MessageSquare, label: "Inbox", roles: ["admin", "comercial", "financeiro", "artista"] },
    { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "comercial", "financeiro", "artista"] },
    { to: "/app/artist", icon: Music, label: "Painel Artista", roles: ["artista", "admin"] },
    { to: "/app/leads", icon: Handshake, label: "Leads", roles: ["admin", "comercial", "financeiro"] },
    { to: "/app/pipeline", icon: Kanban, label: "Pipeline", roles: ["admin", "comercial"] },
    { to: "/app/agenda", icon: CalendarDays, label: "Agenda", roles: ["admin", "comercial", "financeiro", "artista"] },
    { to: "/app/contracts", icon: FileText, label: "Contratos", roles: ["admin", "comercial", "financeiro"] },
    { to: "/app/contacts", icon: Users, label: "Contatos", roles: ["admin", "comercial", "financeiro"] },
    { to: "/app/tasks", icon: ListChecks, label: "Tarefas", roles: ["admin", "comercial", "financeiro", "artista"] },
    { to: "/app/whatsapp", icon: Smartphone, label: "WhatsApp", roles: ["admin", "comercial"] },
    { to: "/app/team", icon: UsersRound, label: "Equipe", roles: ["admin"] },
    { to: "/app/users", icon: UserCog, label: "Usuários", roles: ["admin"] },
    { to: "/app/map", icon: Map, label: "Mapa", roles: ["admin", "comercial", "financeiro"] },
    { to: "/app/financial", icon: DollarSign, label: "Financeiro", roles: ["admin", "financeiro"] },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  if (isSuperAdmin) {
    navItems.push({ to: "/app/admin", icon: Crown, label: "Super Admin", roles: ["admin"] });
  }

  const MAX_VISIBLE_NAV_ITEMS = 7;
  const visibleNavItems = navItems.slice(0, MAX_VISIBLE_NAV_ITEMS);
  const overflowNavItems = navItems.slice(MAX_VISIBLE_NAV_ITEMS);
  const isOverflowItemActive = overflowNavItems.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-3 px-5 md:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-xs tracking-tight">
              RL
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold tracking-tight flex items-center gap-2">
                Rodrigo Lopes
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                  {roleLabel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden lg:flex">
            {visibleNavItems.map((item) => (
              <TopNavItem key={item.to} {...item} />
            ))}

            {overflowNavItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-all duration-150",
                      isOverflowItemActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span>Mais</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {overflowNavItems.map((item) => {
                    const isActive =
                      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <DropdownMenuItem
                        key={item.to}
                        className={cn("cursor-pointer gap-2", isActive && "bg-accent text-accent-foreground")}
                        onClick={() => navigate(item.to)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <GlobalSearch />
            {canManageLeads && <QuickAddMenu />}
            <NotificationBell />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-card p-4 animate-fade-in">
            <nav className="grid gap-1">
              {navItems.map((item) => (
                <TopNavItem
                  key={item.to}
                  {...item}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 mt-3 justify-start"
                onClick={() => supabase.auth.signOut()}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-[1440px] px-5 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
