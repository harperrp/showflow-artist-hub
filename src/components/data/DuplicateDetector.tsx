import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Merge, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface DuplicateDetectorProps {
  leads: any[];
  onMerge?: (keepId: string, mergeId: string) => void;
  onView?: (leadId: string) => void;
}

interface DuplicateGroup {
  key: string;
  reason: string;
  leads: any[];
}

function normalizeString(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function findDuplicates(leads: any[]): DuplicateGroup[] {
  const groups: Record<string, { reason: string; leads: any[] }> = {};

  // Check by contractor name similarity
  leads.forEach((lead, i) => {
    const nameNorm = normalizeString(lead.contractor_name);
    if (nameNorm.length < 3) return;

    leads.slice(i + 1).forEach((other) => {
      const otherNorm = normalizeString(other.contractor_name);
      if (otherNorm.length < 3) return;

      // Exact match or one contains the other
      if (nameNorm === otherNorm || nameNorm.includes(otherNorm) || otherNorm.includes(nameNorm)) {
        const key = [lead.id, other.id].sort().join("-");
        if (!groups[key]) {
          groups[key] = { reason: "Nome similar", leads: [lead, other] };
        }
      }
    });
  });

  // Check by email
  leads.forEach((lead, i) => {
    const email = normalizeString(lead.contact_email);
    if (!email || email.length < 5) return;

    leads.slice(i + 1).forEach((other) => {
      const otherEmail = normalizeString(other.contact_email);
      if (email === otherEmail) {
        const key = [lead.id, other.id].sort().join("-");
        if (!groups[key]) {
          groups[key] = { reason: "Email idêntico", leads: [lead, other] };
        }
      }
    });
  });

  // Check by phone
  leads.forEach((lead, i) => {
    const phone = (lead.contact_phone || "").replace(/\D/g, "");
    if (phone.length < 8) return;

    leads.slice(i + 1).forEach((other) => {
      const otherPhone = (other.contact_phone || "").replace(/\D/g, "");
      if (phone === otherPhone) {
        const key = [lead.id, other.id].sort().join("-");
        if (!groups[key]) {
          groups[key] = { reason: "Telefone idêntico", leads: [lead, other] };
        }
      }
    });
  });

  // Check by same city + same date
  leads.forEach((lead, i) => {
    if (!lead.city || !lead.event_date) return;

    leads.slice(i + 1).forEach((other) => {
      if (lead.city === other.city && lead.event_date === other.event_date) {
        const key = [lead.id, other.id].sort().join("-");
        if (!groups[key]) {
          groups[key] = { reason: "Mesma cidade e data", leads: [lead, other] };
        }
      }
    });
  });

  return Object.entries(groups).map(([key, data]) => ({ key, ...data }));
}

export function DuplicateDetector({ leads, onMerge, onView }: DuplicateDetectorProps) {
  const duplicates = useMemo(() => findDuplicates(leads), [leads]);

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <div className="bg-status-negotiation/10 border border-status-negotiation/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-status-negotiation" />
        <span className="font-medium text-sm">
          {duplicates.length} possível(eis) duplicata(s) encontrada(s)
        </span>
      </div>

      <div className="space-y-2">
        {duplicates.slice(0, 3).map((group) => (
          <div
            key={group.key}
            className="flex items-center justify-between gap-2 bg-background/80 rounded-md p-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="shrink-0 text-xs">
                {group.reason}
              </Badge>
              <span className="text-sm truncate">
                {group.leads.map((l) => l.contractor_name).join(" ↔ ")}
              </span>
            </div>
            <div className="flex gap-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onView(group.leads[0].id)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              {onMerge && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMerge(group.leads[0].id, group.leads[1].id)}
                >
                  <Merge className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {duplicates.length > 3 && (
          <p className="text-xs text-muted-foreground">
            E mais {duplicates.length - 3} possível(eis) duplicata(s)...
          </p>
        )}
      </div>
    </div>
  );
}

// Hook to use in other components
export function useDuplicateCheck(leads: any[], currentLead: any) {
  return useMemo(() => {
    if (!currentLead?.contractor_name) return [];

    const nameNorm = normalizeString(currentLead.contractor_name);

    return leads.filter((lead) => {
      if (lead.id === currentLead.id) return false;

      const otherNorm = normalizeString(lead.contractor_name);
      if (nameNorm === otherNorm) return true;
      if (nameNorm.includes(otherNorm) || otherNorm.includes(nameNorm)) return true;

      // Email match
      if (currentLead.contact_email && lead.contact_email) {
        if (normalizeString(currentLead.contact_email) === normalizeString(lead.contact_email)) {
          return true;
        }
      }

      return false;
    });
  }, [leads, currentLead]);
}
