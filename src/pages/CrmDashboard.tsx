import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { LayoutDashboard, MessageSquare, Users, TrendingUp } from "lucide-react";
import { useOrg } from "@/providers/OrgProvider";
import * as api from "@/services/api";

export function CrmDashboardPage() {
  const { activeOrgId } = useOrg();

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads", activeOrgId],
    queryFn: () => api.fetchLeads(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["crm-conversations", activeOrgId],
    queryFn: () => api.fetchConversations(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const openDeals = leads.filter((l) => !["Fechado", "Perdido"].includes(l.stage)).length;
  const closedDeals = leads.filter((l) => l.stage === "Fechado").length;

  const stats = [
    { label: "Total Leads", value: leads.length, icon: Users, color: "text-blue-400" },
    { label: "Conversas", value: conversations.length, icon: MessageSquare, color: "text-green-400" },
    { label: "Negócios Abertos", value: openDeals, icon: TrendingUp, color: "text-yellow-400" },
    { label: "Fechados", value: closedDeals, icon: LayoutDashboard, color: "text-emerald-400" },
  ];

  return (
    <div className="p-6 space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do CRM</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <s.icon className={`h-8 w-8 ${s.color} opacity-70`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Recent leads */}
      <Card className="border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Leads Recentes</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {leads.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{l.contractor_name}</p>
                  <p className="text-xs text-muted-foreground">{l.contact_phone || "Sem telefone"}</p>
                </div>
                <span className="text-xs bg-accent px-2 py-0.5 rounded-full">{l.stage}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
