import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useDataOrganization";
import { useOrg } from "@/providers/OrgProvider";

export interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "select" | "tag" | "date-range";
  options?: { value: string; label: string }[];
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  className?: string;
}

export function AdvancedFilters({
  filters,
  values,
  onChange,
  className,
}: AdvancedFiltersProps) {
  const { activeOrgId } = useOrg();
  const { data: tags = [] } = useTags(activeOrgId);
  const [open, setOpen] = useState(false);

  const activeFiltersCount = Object.values(values).filter(
    (v) => v !== undefined && v !== "" && v !== null
  ).length;

  function updateFilter(key: string, value: any) {
    onChange({ ...values, [key]: value || undefined });
  }

  function clearFilters() {
    onChange({});
  }

  function clearFilter(key: string) {
    const newValues = { ...values };
    delete newValues[key];
    onChange(newValues);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Search input (always visible) */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={values.search || ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Filter popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros avançados</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  Limpar todos
                </Button>
              )}
            </div>

            {filters.map((filter) => (
              <div key={filter.key} className="space-y-1.5">
                <label className="text-sm text-muted-foreground">{filter.label}</label>

                {filter.type === "text" && (
                  <Input
                    value={values[filter.key] || ""}
                    onChange={(e) => updateFilter(filter.key, e.target.value)}
                    className="h-8"
                    placeholder={`Filtrar por ${filter.label.toLowerCase()}...`}
                  />
                )}

                {filter.type === "select" && filter.options && (
                  <Select
                    value={values[filter.key] || ""}
                    onValueChange={(v) => updateFilter(filter.key, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {filter.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {filter.type === "tag" && (
                  <Select
                    value={values[filter.key] || ""}
                    onValueChange={(v) => updateFilter(filter.key, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecionar tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as tags</SelectItem>
                      {tags.map((tag: any) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {Object.entries(values)
        .filter(([key, value]) => value && key !== "search")
        .map(([key, value]) => {
          const filter = filters.find((f) => f.key === key);
          const label = filter?.options?.find((o) => o.value === value)?.label || value;

          return (
            <Badge key={key} variant="secondary" className="gap-1 pr-1">
              {filter?.label}: {label}
              <button
                onClick={() => clearFilter(key)}
                className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
    </div>
  );
}

// Helper hook for filtering data
export function useFilteredData<T extends Record<string, any>>(
  data: T[],
  filters: Record<string, any>,
  searchFields: (keyof T)[]
): T[] {
  return useMemo(() => {
    return data.filter((item) => {
      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = searchFields.some((field) =>
          String(item[field] || "").toLowerCase().includes(searchLower)
        );
        if (!matchesSearch) return false;
      }

      // Other filters
      for (const [key, value] of Object.entries(filters)) {
        if (key === "search" || !value) continue;
        if (item[key] !== value) return false;
      }

      return true;
    });
  }, [data, filters, searchFields]);
}
