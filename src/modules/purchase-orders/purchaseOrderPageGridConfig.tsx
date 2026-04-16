import { cn } from "@/lib/utils";

export function ExecutionMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          danger ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
