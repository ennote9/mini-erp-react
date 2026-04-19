import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriceDeltaVsPrevious } from "../lib/itemPriceHistory";

type Props = {
  delta: PriceDeltaVsPrevious;
  formatMoney: (n: number | undefined) => string;
  className?: string;
};

/**
 * Compact delta vs previous active price (current-price cards only).
 */
export function ItemPriceDeltaBadge({ delta, formatMoney, className }: Props) {
  if (delta.direction === "same") {
    return (
      <span
        className={cn("shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground", className)}
        data-testid="item-price-delta"
        data-delta-direction="same"
      >
        —
      </span>
    );
  }

  const Icon = delta.direction === "up" ? ArrowUp : ArrowDown;
  const tone =
    delta.direction === "up" ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-rose-600/90 dark:text-rose-400/90";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums", tone, className)}
      data-testid="item-price-delta"
      data-delta-direction={delta.direction}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      <span>
        {delta.direction === "up" ? "+" : "−"}
        {formatMoney(Math.abs(delta.delta))}
      </span>
    </span>
  );
}
