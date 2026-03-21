import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n";

export type InventoryMetric = {
  key: string;
  label: string;
  value: number;
};

type Props = {
  title: string;
  listPath: string;
  metrics: InventoryMetric[];
};

export function InventoryOverviewCard({ title, listPath, metrics }: Props) {
  const { t } = useTranslation();
  return (
    <Card className="min-w-0 border-border/60 bg-card/40 shadow-none">
      <CardHeader className="space-y-0 p-3 pb-2">
        <div className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Link
            to={listPath}
            className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("dashboard.openArrow")}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <dl className="grid gap-1.5 text-sm">
          {metrics.map((m) => (
            <div
              key={m.key}
              className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
            >
              <dt className="text-muted-foreground">{m.label}</dt>
              <dd className="font-medium tabular-nums text-foreground/90">{m.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
