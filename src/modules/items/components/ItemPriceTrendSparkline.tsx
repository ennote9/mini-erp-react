import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  className?: string;
  /** Accessibility label for the sparkline graphic */
  "aria-label"?: string;
};

/** Larger intrinsic canvas so scaling to the card stays sharp; container CSS controls final size. */
const VIEW_W = 180;
const VIEW_H = 56;
const PAD = 4;

function buildPoints(values: number[]): [number, number][] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const denom = Math.max(values.length - 1, 1);
  return values.map((v, i) => {
    const x = PAD + (i / denom) * (VIEW_W - 2 * PAD);
    const t = span < 1e-12 ? 0.5 : (v - min) / span;
    const y = VIEW_H - PAD - t * (VIEW_H - 2 * PAD);
    return [x, y] as [number, number];
  });
}

/** Connected segments with round joins — reads as a smooth, subtle trend. */
function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

/**
 * Price trend line for current-price summary cards (last N amounts, oldest → newest).
 * Fills the parent box; size the parent with min-height / flex so the line stays readable.
 */
export function ItemPriceTrendSparkline({ values, className, ...rest }: Props) {
  if (values.length === 0) return null;

  const pts = buildPoints(values);
  const pathD = buildSmoothPath(pts);

  const valuesAttr = values.map((v) => String(v)).join(",");

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={cn("block h-full w-full min-h-0 text-muted-foreground/60", className)}
      preserveAspectRatio="none"
      role="img"
      data-testid="item-price-trend-sparkline"
      data-sparkline-values={valuesAttr}
      {...rest}
    >
      {values.length === 1 ? (
        <circle cx={VIEW_W / 2} cy={pts[0]![1]} r={2.25} fill="currentColor" className="opacity-85" />
      ) : (
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
