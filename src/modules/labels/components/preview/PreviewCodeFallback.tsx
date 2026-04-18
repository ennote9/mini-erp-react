import { cn } from "@/lib/utils";

type Props = {
  message: string;
  className?: string;
};

/** Compact preview placeholder for empty / unsupported / failed code generation. */
export function PreviewCodeFallback({ message, className }: Props) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden rounded border border-dashed border-border/80 bg-muted/25 px-1 text-center text-[10px] leading-tight text-muted-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}
