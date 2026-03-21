import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n";

export type DocumentStatChip = {
  key: string;
  label: string;
  value: number;
};

type Props = {
  title: string;
  listPath: string;
  total: number;
  stats: DocumentStatChip[];
};

/**
 * Compact document-family overview: total + status breakdown chips.
 */
export function DocumentOverviewCard({ title, listPath, total, stats }: Props) {
  const { t } = useTranslation();
  return (
    <Card className="min-w-0 border-border/60 bg-card/40 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold leading-tight">{title}</CardTitle>
          <Link
            to={listPath}
            className="mt-1 inline-block text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("dashboard.openList")}
          </Link>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold tabular-nums leading-none text-foreground/95">
            {total}
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("dashboard.totalLabel")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex flex-wrap gap-1.5" aria-label={`${title} status breakdown`}>
          {stats.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none"
            >
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium text-foreground/90">{s.value}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
