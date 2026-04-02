import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, GripVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { FunnelStageRow } from "@/hooks/useFunnelStages";
import {
  useAddFunnelStage,
  useRenameFunnelStage,
  useReorderFunnelStages,
  useDeleteFunnelStage,
} from "@/hooks/useFunnelStages";

const STAGE_COLORS = [
  "#64748b", "#3b82f6", "#8b5cf6", "#eab308", "#f97316", "#22c55e",
  "#ef4444", "#ec4899", "#06b6d4", "#14b8a6",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: FunnelStageRow[];
  orgId: string;
}

export function StageManagerDialog({ open, onOpenChange, stages, orgId }: Props) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addStage = useAddFunnelStage(orgId);
  const renameStage = useRenameFunnelStage(orgId);
  const reorderStages = useReorderFunnelStages(orgId);
  const deleteStage = useDeleteFunnelStage(orgId);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (stages.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe uma etapa com esse nome");
      return;
    }
    const nextPos = stages.length > 0 ? Math.max(...stages.map((s) => s.position)) + 1 : 0;
    const color = STAGE_COLORS[nextPos % STAGE_COLORS.length];
    try {
      await addStage.mutateAsync({ name: trimmed, position: nextPos, color });
      setNewName("");
      toast.success(`Etapa "${trimmed}" adicionada`);
    } catch (e: any) {
      toast.error("Erro ao adicionar etapa", { description: e.message });
    }
  }

  async function handleRename(stage: FunnelStageRow) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === stage.name) {
      setEditingId(null);
      return;
    }
    if (stages.some((s) => s.id !== stage.id && s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe uma etapa com esse nome");
      return;
    }
    try {
      await renameStage.mutateAsync({ id: stage.id, oldName: stage.name, newName: trimmed });
      setEditingId(null);
      toast.success(`Etapa renomeada para "${trimmed}"`);
    } catch (e: any) {
      toast.error("Erro ao renomear", { description: e.message });
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    const updates = newStages.map((s, i) => ({ id: s.id, position: i }));
    await reorderStages.mutateAsync(updates);
  }

  async function handleMoveDown(index: number) {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    const updates = newStages.map((s, i) => ({ id: s.id, position: i }));
    await reorderStages.mutateAsync(updates);
  }

  async function handleDelete(stage: FunnelStageRow) {
    if (stages.length <= 1) {
      toast.error("É necessário ter pelo menos uma etapa");
      return;
    }
    const moveToStage = stages.find((s) => s.id !== stage.id)!.name;
    try {
      await deleteStage.mutateAsync({ id: stage.id, name: stage.name, moveToStage });
      toast.success(`Etapa "${stage.name}" removida. Leads movidos para "${moveToStage}".`);
    } catch (e: any) {
      toast.error("Erro ao remover etapa", { description: e.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Etapas do Funil</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2 group">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMoveUp(i)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveDown(i)}
                  disabled={i === stages.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                >
                  ▼
                </button>
              </div>
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              {editingId === stage.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(stage);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(stage)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{stage.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setEditingId(stage.id);
                      setEditName(stage.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => handleDelete(stage)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new stage */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Input
            placeholder="Nova etapa..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
