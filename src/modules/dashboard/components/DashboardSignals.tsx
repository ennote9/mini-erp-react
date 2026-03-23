import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n";
import { cn } from "@/lib/utils";
import type { DashboardSignals as SignalsData } from "../dashboardStats";

type Props = {
  signals: SignalsData;
};

type SignalRow = {
  id: string;
  label: string;
  value: number;
  hint?: string;
  to: string;
};

/**
 * Operational attention panel: counts with deep links into filtered lists where supported.
 */
export function DashboardSignals({ signals }: Props) {
  const { t } = useTranslation();
  const rows: SignalRow[] = [
    {
      id: "inactive",
      label: t("dashboard.signals.inactiveItems"),
      value: signals.inactiveItems,
      to: "/items?lifecycle=inactive",
      hint: t("dashboard.signals.masterDataHint"),
    },
    {
      id: "noImages",
      label: t("dashboard.signals.itemsWithoutImages"),
      value: signals.itemsWithoutImages,
      to: "/items",
    },
    {
      id: "draftRcpt",
      label: t("dashboard.signals.draftReceipts"),
      value: signals.draftReceipts,
      to: "/receipts?status=draft",
    },
    {
      id: "draftShp",
      label: t("dashboard.signals.draftShipments"),
      value: signals.draftShipments,
      to: "/shipments?status=draft",
    },
  ];

  const attentionTotal = rows.reduce((acc, r) => acc + r.value, 0);
  const hasAttention = attentionTotal > 0;

  return (
    <Card
      className={cn(
        "min-w-0 border-border/60 bg-card/40 shadow-none",
        hasAttention && "border-l-[3px] border-l-amber-500/55",
      )}
    >
      <CardHeader className="space-y-0 p-3 pb-1">
        <CardTitle className="text-sm font-semibold">{t("dashboard.signals.title")}</CardTitle>
        <CardDescription className="text-xs">{t("dashboard.signals.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <ul className="m-0 list-none space-y-2 p-0 text-sm">
          {rows.map((r) => {
            const hot = r.value > 0;
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-border/30 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground">
                    {r.label}
                    {r.hint ? (
                      <span className="ml-1 text-[10px] text-muted-foreground/80">({r.hint})</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span
                    className={cn(
                      "tabular-nums font-semibold",
                      hot ? "text-foreground/95" : "text-muted-foreground",
                    )}
                  >
                    {r.value}
                  </span>
                  <Link
                    to={r.to}
                    className="whitespace-nowrap text-[11px] font-medium text-primary hover:underline"
                  >
                    {t("dashboard.signals.reviewAction")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
