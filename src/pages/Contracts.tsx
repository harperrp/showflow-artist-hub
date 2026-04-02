import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOrg } from "@/providers/OrgProvider";
import { useContracts } from "@/hooks/useCrmQueries";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FilePlus } from "lucide-react";

function statusLabel(s: string) {
  switch (s) {
    case "pending":
      return "Pendente";
    case "signed":
      return "Assinado";
    case "canceled":
      return "Cancelado";
    default:
      return s;
  }
}

export function ContractsPage() {
  const { activeOrgId } = useOrg();
  const { data = [], isLoading, refetch } = useContracts(activeOrgId);

  async function quickCreateContract() {
    if (!activeOrgId) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // MVP: precisa de um lead existente para vincular.
    const { data: leads, error: leadsErr } = await db
      .from("leads")
      .select("id")
      .eq("organization_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (leadsErr) {
      toast("Não foi possível buscar leads", { description: leadsErr.message });
      return;
    }
    if (!leads || leads.length === 0) {
      toast("Crie um lead primeiro", { description: "Para criar contrato, precisamos vincular a um lead." });
      return;
    }

    const { error } = await db.from("contracts").insert({
      organization_id: activeOrgId,
      lead_id: leads[0].id,
      status: "pending",
      document_url: null,
      created_by: user.id,
    });

    if (error) {
      toast("Não foi possível criar contrato", { description: error.message });
      return;
    }
    toast("Contrato criado");
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">Contratos / Financeiro (MVP)</div>
          <div className="text-sm text-muted-foreground">Status + link do documento (simples)</div>
        </div>
        <Button onClick={quickCreateContract} className="gap-2">
          <FilePlus className="h-4 w-4" />
          Novo contrato
        </Button>
      </div>

      <Card className="border bg-card/70 p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {["Pendente", "Assinado", "Cancelado"].map((s) => (
            <Badge key={s} variant="outline" className="bg-card/50">
              {s}
            </Badge>
          ))}
        </div>

        <Separator className="my-4" />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Sem contratos ainda. Clique em <span className="font-medium">Novo contrato</span>.
          </div>
        ) : (
          <div className="grid gap-3">
            {data.map((c: any) => (
              <Card key={c.id} className="border bg-card/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {c.leads?.contractor_name ?? "Contrato"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[c.leads?.city, c.leads?.state].filter(Boolean).join(" / ") || "—"}
                    </div>
                    {c.document_url ? (
                      <a className="text-sm text-primary underline" href={c.document_url} target="_blank" rel="noreferrer">
                        Abrir documento
                      </a>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem documento ainda</div>
                    )}
                  </div>

                  <Badge variant="outline" className="bg-card/50">
                    {statusLabel(c.status)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
