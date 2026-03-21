import { Link } from "react-router-dom";
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

const LINKS: { to: string; label: string; feature?: "navStockMovements" }[] = [
  { to: "/purchase-orders", label: "Purchase orders" },
  { to: "/sales-orders", label: "Sales orders" },
  { to: "/receipts", label: "Receipts" },
  { to: "/shipments", label: "Shipments" },
  { to: "/stock-balances", label: "Stock balances" },
  { to: "/stock-movements", label: "Stock movements", feature: "navStockMovements" },
  { to: "/items", label: "Items" },
];

export function DashboardQuickLinks() {
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
        <CardTitle className="text-sm font-semibold">Quick links</CardTitle>
        <CardDescription className="text-xs">
          Jump to common operational lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex flex-wrap gap-2">
          {links.map(({ to, label }) => (
            <Button key={to} variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link to={to}>{label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
