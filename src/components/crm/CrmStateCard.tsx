import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CrmStateCard({
  message,
  tone = "neutral",
  className,
}: {
  message: string;
  tone?: "neutral" | "error";
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-8 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "text-muted-foreground",
        className,
      )}
    >
      {message}
    </Card>
  );
}
