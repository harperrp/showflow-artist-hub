import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  MessageSquare,
  Tag,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivityLogs } from "@/hooks/useDataOrganization";

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  created: { icon: Plus, label: "Criado", color: "text-status-confirmed" },
  updated: { icon: Pencil, label: "Atualizado", color: "text-primary" },
  deleted: { icon: Trash2, label: "Removido", color: "text-status-blocked" },
  stage_changed: { icon: ArrowRight, label: "Etapa alterada", color: "text-status-negotiation" },
  status_changed: { icon: CheckCircle2, label: "Status alterado", color: "text-status-confirmed" },
  note_added: { icon: MessageSquare, label: "Nota adicionada", color: "text-primary" },
  tag_added: { icon: Tag, label: "Tag adicionada", color: "text-brand-2" },
  tag_removed: { icon: Tag, label: "Tag removida", color: "text-muted-foreground" },
};

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
  className?: string;
}

export function ActivityTimeline({ entityType, entityId, className }: ActivityTimelineProps) {
  const { data: logs = [], isLoading } = useActivityLogs(entityType, entityId);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[300px]", className)}>
      <div className="space-y-4 pr-4">
        {logs.map((log: any, index: number) => {
          const config = ACTION_CONFIG[log.action] || {
            icon: Clock,
            label: log.action,
            color: "text-muted-foreground",
          };
          const Icon = config.icon;

          return (
            <div key={log.id} className="flex gap-3 relative">
              {/* Timeline line */}
              {index < logs.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-px bg-border -translate-x-1/2" />
              )}

              {/* Icon */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border-2",
                  config.color.replace("text-", "border-")
                )}
              >
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium">{config.label}</p>

                {/* Stage change details */}
                {log.action === "stage_changed" && log.old_value && log.new_value && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span className="text-status-blocked">{log.old_value}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-status-confirmed">{log.new_value}</span>
                  </p>
                )}

                {/* Note content */}
                {log.action === "note_added" && log.metadata?.content && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    "{log.metadata.content}"
                  </p>
                )}

                {/* Time */}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
