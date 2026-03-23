import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Compact outline pill for categorical/state values inside AG Grid cells (not a full-cell border).
 * Chromatically neutral only (no green/amber/rose cues) — scanning relies on label text, not hue.
 */
const neutralPill =
  "border-border/55 bg-muted/10 text-foreground/90";

const gridOutlinePillVariants = cva(
  "inline-flex max-w-full min-w-0 items-center truncate rounded-full border px-2 py-px text-[11px] font-medium leading-tight shadow-none",
  {
    variants: {
      tone: {
        neutral: neutralPill,
        positive: neutralPill,
        muted: "border-border/55 bg-muted/10 text-muted-foreground",
        warning: neutralPill,
        negative: neutralPill,
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type GridOutlinePillTone = NonNullable<VariantProps<typeof gridOutlinePillVariants>["tone"]>;

export type GridOutlinePillBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof gridOutlinePillVariants>;

export function GridOutlinePillBadge({
  className,
  tone,
  children,
  ...props
}: GridOutlinePillBadgeProps) {
  return (
    <span className={cn(gridOutlinePillVariants({ tone }), "grid-outline-pill", className)} {...props}>
      {children}
    </span>
  );
}
