import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n";
import type { DashboardSignals as SignalsData } from "../dashboardStats";

type Props = {
  signals: SignalsData;
};

export function DashboardSignals({ signals }: Props) {
  const { t } = useTranslation();
  const rows: { label: string; value: number; hint?: string; to?: string }[] = [
    {
      label: t("dashboard.signals.inactiveItems"),
      value: signals.inactiveItems,
      to: "/items",
      hint: t("dashboard.signals.masterDataHint"),
    },
    {
      label: t("dashboard.signals.itemsWithoutImages"),
      value: signals.itemsWithoutImages,
      to: "/items",
    },
    {
      label: t("dashboard.signals.draftReceipts"),
      value: signals.draftReceipts,
      to: "/receipts",
    },
    {
      label: t("dashboard.signals.draftShipments"),
      value: signals.draftShipments,
      to: "/shipments",
    },
  ];

  return (
    <Card className="min-w-0 border-border/60 bg-card/40 shadow-none">
      <CardHeader className="space-y-0 p-3 pb-1">
        <CardTitle className="text-sm font-semibold">{t("dashboard.signals.title")}</CardTitle>
        <CardDescription className="text-xs">{t("dashboard.signals.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <ul className="m-0 list-none space-y-2 p-0 text-sm">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-baseline justify-between gap-2 border-b border-border/30 pb-2 last:border-0 last:pb-0"
            >
              <span className="min-w-0 text-muted-foreground">
                {r.to ? (
                  <Link to={r.to} className="hover:text-foreground">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
                {r.hint ? (
                  <span className="ml-1 text-[10px] text-muted-foreground/80">({r.hint})</span>
                ) : null}
              </span>
              <span
                className={`shrink-0 tabular-nums font-medium ${
                  r.value > 0 ? "text-foreground/90" : "text-muted-foreground"
                }`}
              >
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
