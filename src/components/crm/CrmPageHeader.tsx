import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CrmPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function CrmPageHeader({ title, description, actions, className }: CrmPageHeaderProps) {
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br from-background via-background to-primary/5 p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground mt-0.5">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
