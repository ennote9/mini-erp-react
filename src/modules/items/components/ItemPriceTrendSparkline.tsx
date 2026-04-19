import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  className?: string;
  /** Accessibility label for the sparkline graphic */
  "aria-label"?: string;
};

/** Intrinsic SVG coordinate space (scales with container). */
const VIEW_W = 200;
const VIEW_H = 64;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 6;

function buildYScaledPoints(values: number[]): [number, number][] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const denom = Math.max(values.length - 1, 1);
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  return values.map((v, i) => {
    const x = PAD_X + (i / denom) * (VIEW_W - 2 * PAD_X);
    const t = span < 1e-12 ? 0.5 : (v - min) / span;
    const y = PAD_TOP + (1 - t) * plotH;
    return [x, y] as [number, number];
  });
}

/** Smooth curve through points (Catmull-Rom → cubic Bézier segments). */
function buildSmoothLinePath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]![0]} ${pts[0]![1]}`;
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function buildAreaPath(pts: [number, number][], linePath: string): string {
  if (pts.length < 2) return "";
  const bottom = VIEW_H - PAD_BOTTOM;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const mMatch = linePath.match(/^M\s*([\d.-]+)\s*([\d.-]+)\s*(.*)$/s);
  if (!mMatch?.[3]) return "";
  const curveRest = mMatch[3].trim();
  return `M ${first[0]} ${bottom} L ${first[0]} ${first[1]} ${curveRest} L ${last[0]} ${bottom} Z`;
}

function safeSvgId(reactId: string, suffix: string): string {
  return `spark-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}-${suffix}`;
}

/**
 * Monochrome mini trend chart for current-price cards (last N amounts, oldest → newest).
 * Sits on the card surface (no separate panel); light stroke, soft fill and glow — no Recharts.
 */
export function ItemPriceTrendSparkline({ values, className, ...rest }: Props) {
  const reactId = useId();
  const ids = useMemo(
    () => ({
      fillGrad: safeSvgId(reactId, "fill"),
      glow: safeSvgId(reactId, "glow"),
      lineGlow: safeSvgId(reactId, "lineGlow"),
    }),
    [reactId],
  );

  if (values.length === 0) return null;

  const pts = buildYScaledPoints(values);
  const linePath = buildSmoothLinePath(pts);
  const areaPath = buildAreaPath(pts, linePath);
  const last = pts[pts.length - 1]!;
  const valuesAttr = values.map((v) => String(v)).join(",");

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-full w-full min-h-[2.75rem] text-foreground/90"
        preserveAspectRatio="none"
        role="img"
        data-testid="item-price-trend-sparkline"
        data-sparkline-values={valuesAttr}
        {...rest}
      >
        <defs>
          <linearGradient id={ids.fillGrad} x1="0" y1="0" x2="0" y2="1">
            {/* Match --foreground (#fafafa) for fill; reads on same surface as card / --background */}
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.14" />
            <stop offset="55%" stopColor="var(--foreground)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </linearGradient>
          <filter id={ids.glow} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.25" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ids.lineGlow} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.45 0"
              in="blur"
              result="soft"
            />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {values.length > 1 ? (
          <>
            <path d={areaPath} fill={`url(#${ids.fillGrad})`} className="pointer-events-none" />
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
              filter={`url(#${ids.lineGlow})`}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={last[0]}
              cy={last[1]}
              r={3}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1.25}
              className="pointer-events-none opacity-95"
            />
          </>
        ) : (
          <>
            <circle
              cx={pts[0]![0]}
              cy={pts[0]![1]}
              r={4}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1}
              className="opacity-90"
              filter={`url(#${ids.glow})`}
            />
          </>
        )}
      </svg>
    </div>
  );
}
