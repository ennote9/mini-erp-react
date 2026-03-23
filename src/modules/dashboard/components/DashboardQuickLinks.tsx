import { Link } from "react-router-dom";
import { useTranslation } from "@/shared/i18n";
import { useSettings } from "@/shared/settings";
import { getEffectiveWorkspaceFeatureEnabled } from "@/shared/workspace";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LINKS: { to: string; labelKey: string; feature?: "navStockMovements" }[] = [
  { to: "/purchase-orders", labelKey: "dashboard.quickLinks.po" },
  { to: "/sales-orders", labelKey: "dashboard.quickLinks.so" },
  { to: "/receipts", labelKey: "dashboard.quickLinks.receipts" },
  { to: "/shipments", labelKey: "dashboard.quickLinks.shipments" },
  { to: "/stock-balances", labelKey: "dashboard.quickLinks.stockBalances" },
  { to: "/stock-movements", labelKey: "dashboard.quickLinks.stockMovements", feature: "navStockMovements" },
  { to: "/items", labelKey: "dashboard.items.title" },
  { to: "/customers", labelKey: "dashboard.quickLinks.customers" },
  { to: "/suppliers", labelKey: "dashboard.quickLinks.suppliers" },
  { to: "/warehouses", labelKey: "dashboard.quickLinks.warehouses" },
  { to: "/carriers", labelKey: "dashboard.quickLinks.carriers" },
];

export function DashboardQuickLinks() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const mode = settings.general.workspaceMode;
  const overrides = settings.general.profileOverrides;
  const links = LINKS.filter((l) => {
    if (l.feature === "navStockMovements")
      return getEffectiveWorkspaceFeatureEnabled(mode, overrides, "navStockMovements");
    return true;
  });

  return (
    <Card className="min-w-0 border-border/60 bg-card/40 shadow-none">
      <CardHeader className="space-y-0 p-3 pb-1">
        <CardTitle className="text-sm font-semibold">{t("dashboard.quickLinks.title")}</CardTitle>
        <CardDescription className="text-xs">{t("dashboard.quickLinksSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex flex-wrap gap-2">
          {links.map(({ to, labelKey }) => (
            <Button key={to} variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link to={to}>{t(labelKey)}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
