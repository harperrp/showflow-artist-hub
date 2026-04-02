import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, DollarSign } from "lucide-react";
import { useOrg } from "@/providers/OrgProvider";
import * as api from "@/services/api";
import { toast } from "sonner";
import type { Lead, PipelineStage } from "@/types/crm";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

export function CrmPipelinePage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages", activeOrgId],
    queryFn: () => api.fetchStages(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads", activeOrgId],
    queryFn: () => api.fetchLeads(activeOrgId!),
    enabled: !!activeOrgId,
  });

  function getLeadsForStage(stageName: string) {
    return leads.filter((l) => l.stage === stageName);
  }

  function stageTotal(stageName: string) {
    return getLeadsForStage(stageName).reduce((sum, l) => sum + (Number(l.fee) || 0), 0);
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;

    // Flash highlight on dropped card
    setJustDroppedId(leadId);
    setTimeout(() => setJustDroppedId(null), 800);

    try {
      await api.updateLead(leadId, { stage: newStage });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success(`Lead movido para ${newStage}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-6 space-y-4 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Arraste leads entre as etapas</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageLeads = getLeadsForStage(stage.name);
            const total = stageTotal(stage.name);
            return (
              <Droppable key={stage.name} droppableId={stage.name}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "w-72 shrink-0 rounded-xl border p-3 transition-all duration-200",
                      snapshot.isDraggingOver
                        ? "bg-accent/50 border-primary/40 scale-[1.01] shadow-md"
                        : "bg-card/50 border-border"
                    )}
                  >
                    {/* Column header */}
                    <div className="mb-3 pb-2 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full ring-2 ring-background shadow-sm"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm font-bold tracking-tight">{stage.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {stageLeads.length}
                        </Badge>
                      </div>
                      {total > 0 && (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="space-y-2 min-h-[80px]">
                      {stageLeads.map((lead, idx) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                          {(prov, snap) => (
                            <Card
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={cn(
                                "border bg-card p-3 cursor-grab transition-all duration-200",
                                snap.isDragging && "shadow-xl ring-2 ring-primary/50 scale-105 rotate-1 opacity-90",
                                !snap.isDragging && "hover:shadow-md hover:-translate-y-0.5",
                                justDroppedId === lead.id && "animate-scale-in ring-2 ring-primary/40 bg-primary/5"
                              )}
                              style={{
                                ...prov.draggableProps.style,
                              }}
                            >
                              <p className="text-sm font-semibold truncate text-foreground">
                                {lead.contractor_name}
                              </p>
                              <div className="mt-1.5 space-y-0.5">
                                {lead.contact_phone && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 shrink-0" /> {lead.contact_phone}
                                  </p>
                                )}
                                {lead.city && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {lead.city}{lead.state ? `, ${lead.state}` : ""}
                                  </p>
                                )}
                              </div>
                              {lead.fee != null && Number(lead.fee) > 0 && (
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 bg-emerald-500/10 rounded-md px-2 py-0.5 inline-block">
                                  {Number(lead.fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </p>
                              )}
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
