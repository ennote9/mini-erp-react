import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  className?: string;
  /** Accessibility label for the sparkline graphic */
  "aria-label"?: string;
};

const VIEW_W = 100;
const VIEW_H = 22;
const PAD = 3;

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
 * Small subtle trend line for summary cards (last N amounts, oldest → newest).
 */
export function ItemPriceTrendSparkline({ values, className, ...rest }: Props) {
  if (values.length === 0) return null;

  const pts = buildPoints(values);
  const pathD = buildSmoothPath(pts);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={cn("h-5 w-full max-w-full text-muted-foreground/55", className)}
      preserveAspectRatio="none"
      role="img"
      data-testid="item-price-trend-sparkline"
      {...rest}
    >
      {values.length === 1 ? (
        <circle cx={VIEW_W / 2} cy={pts[0]![1]} r={1.5} fill="currentColor" className="opacity-80" />
      ) : (
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
