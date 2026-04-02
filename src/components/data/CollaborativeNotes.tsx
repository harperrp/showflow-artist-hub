import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Pin, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNotes, useCreateNote, useDeleteNote } from "@/hooks/useDataOrganization";
import { useOrg } from "@/providers/OrgProvider";
import { useAuth } from "@/providers/AuthProvider";

interface CollaborativeNotesProps {
  entityType: string;
  entityId: string;
  className?: string;
}

export function CollaborativeNotes({ entityType, entityId, className }: CollaborativeNotesProps) {
  const { activeOrgId } = useOrg();
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useNotes(entityType, entityId);
  const createNote = useCreateNote(activeOrgId);
  const deleteNote = useDeleteNote();

  const [newNote, setNewNote] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;

    await createNote.mutateAsync({
      entity_type: entityType,
      entity_id: entityId,
      content: newNote.trim(),
    });
    setNewNote("");
  }

  async function handleDelete(noteId: string) {
    await deleteNote.mutateAsync({
      id: noteId,
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-12 w-full bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Notes list */}
      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma nota ainda</p>
              <p className="text-xs">Adicione uma nota para começar</p>
            </div>
          ) : (
            notes.map((note: any) => (
              <div
                key={note.id}
                className={cn(
                  "flex gap-3 group",
                  note.is_pinned && "bg-accent/50 -mx-2 px-2 py-2 rounded-lg"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {note.created_by?.slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {note.created_by === user?.id ? "Você" : "Equipe"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    {note.is_pinned && <Pin className="h-3 w-3 text-primary" />}

                    {note.created_by === user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(note.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <p className="text-sm mt-1 whitespace-pre-wrap">{note.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* New note form */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t">
        <Textarea
          placeholder="Adicionar uma nota..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[60px] resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newNote.trim() || createNote.isPending}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-1">⌘+Enter para enviar</p>
    </div>
  );
}
