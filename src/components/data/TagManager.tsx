import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Plus, Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTags, useCreateTag, useEntityTags, useAddEntityTag, useRemoveEntityTag } from "@/hooks/useDataOrganization";
import { useOrg } from "@/providers/OrgProvider";

const TAG_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

interface TagManagerProps {
  entityType: "lead" | "contact" | "venue" | "event";
  entityId: string;
  compact?: boolean;
}

export function TagManager({ entityType, entityId, compact = false }: TagManagerProps) {
  const { activeOrgId } = useOrg();
  const { data: allTags = [] } = useTags(activeOrgId);
  const { data: entityTags = [] } = useEntityTags(entityType, entityId);
  const createTag = useCreateTag(activeOrgId);
  const addEntityTag = useAddEntityTag();
  const removeEntityTag = useRemoveEntityTag();

  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);

  const appliedTagIds = entityTags.map((et: any) => et.tag_id);
  const availableTags = allTags.filter((t: any) => !appliedTagIds.includes(t.id));

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    await createTag.mutateAsync({ name: newTagName.trim(), color: selectedColor });
    setNewTagName("");
  }

  async function handleAddTag(tagId: string) {
    await addEntityTag.mutateAsync({ tag_id: tagId, entity_type: entityType, entity_id: entityId });
  }

  async function handleRemoveTag(tagId: string) {
    await removeEntityTag.mutateAsync({ tag_id: tagId, entity_type: entityType, entity_id: entityId });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entityTags.map((et: any) => (
        <Badge
          key={et.id}
          variant="secondary"
          className="gap-1 pr-1"
          style={{ backgroundColor: et.tag?.color + "20", borderColor: et.tag?.color, color: et.tag?.color }}
        >
          {et.tag?.name}
          <button
            onClick={() => handleRemoveTag(et.tag_id)}
            className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={cn("gap-1 h-6 px-2", compact && "h-5 px-1.5")}>
            <Tag className="h-3 w-3" />
            {!compact && <Plus className="h-3 w-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            {/* Existing tags */}
            {availableTags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Tags disponíveis</p>
                <div className="flex flex-wrap gap-1">
                  {availableTags.map((tag: any) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="cursor-pointer hover:opacity-80 gap-1"
                      style={{ backgroundColor: tag.color + "20", borderColor: tag.color, color: tag.color }}
                      onClick={() => handleAddTag(tag.id)}
                    >
                      <Plus className="h-3 w-3" />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Create new tag */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground font-medium">Criar nova tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                />
                <Button
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Color picker */}
              <div className="flex gap-1">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                      selectedColor === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Check className="h-3 w-3 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
