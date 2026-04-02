import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface CompletenessIndicatorProps {
  data: Record<string, any>;
  requiredFields: string[];
  optionalFields?: string[];
  showLabel?: boolean;
  className?: string;
}

export function CompletenessIndicator({
  data,
  requiredFields,
  optionalFields = [],
  showLabel = true,
  className,
}: CompletenessIndicatorProps) {
  const allFields = [...requiredFields, ...optionalFields];
  
  const filledRequired = requiredFields.filter(
    (field) => data[field] !== null && data[field] !== undefined && data[field] !== ""
  ).length;
  
  const filledOptional = optionalFields.filter(
    (field) => data[field] !== null && data[field] !== undefined && data[field] !== ""
  ).length;
  
  const totalFilled = filledRequired + filledOptional;
  const totalFields = allFields.length;
  const percentage = Math.round((totalFilled / totalFields) * 100);
  
  const requiredComplete = filledRequired === requiredFields.length;
  
  const getColor = () => {
    if (percentage >= 80) return "text-status-confirmed";
    if (percentage >= 50) return "text-status-negotiation";
    return "text-status-blocked";
  };

  const getProgressColor = () => {
    if (percentage >= 80) return "bg-status-confirmed";
    if (percentage >= 50) return "bg-status-negotiation";
    return "bg-status-blocked";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        {showLabel && (
          <div className="flex items-center gap-1.5">
            {requiredComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-status-confirmed" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-status-negotiation" />
            )}
            <span className={cn("text-xs font-medium", getColor())}>
              {percentage}% completo
            </span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {totalFilled}/{totalFields} campos
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-500 rounded-full", getProgressColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Helper to get field configs for different entity types
export const LEAD_REQUIRED_FIELDS = ["contractor_name", "stage"];
export const LEAD_OPTIONAL_FIELDS = [
  "contractor_type",
  "city",
  "state",
  "event_date",
  "fee",
  "contact_email",
  "contact_phone",
  "venue_name",
  "origin",
  "notes",
];

export const CONTACT_REQUIRED_FIELDS = ["name"];
export const CONTACT_OPTIONAL_FIELDS = ["company", "role", "email", "phone", "notes"];

export const VENUE_REQUIRED_FIELDS = ["name", "city", "state"];
export const VENUE_OPTIONAL_FIELDS = ["address", "capacity", "latitude", "longitude", "notes"];
