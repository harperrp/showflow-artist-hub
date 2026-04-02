import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Kanban,
  Calendar,
  Smartphone,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/crm", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/crm/inbox", icon: MessageSquare, label: "Inbox" },
  { to: "/crm/leads", icon: Users, label: "Leads" },
  { to: "/crm/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/crm/agenda", icon: Calendar, label: "Agenda" },
  { to: "/crm/whatsapp", icon: Smartphone, label: "WhatsApp" },
];

export function CrmLayout() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-foreground">
              ShowForge
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((item) => {
            const active = pathname === item.to || (item.to !== "/crm" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
