import { useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";
import { useSettings } from "@/shared/settings";
import { getEffectiveWorkspaceFeatureEnabled } from "@/shared/workspace";
import {
  getPurchaseOrderBreakdown,
  getSalesOrderBreakdown,
  getReceiptBreakdown,
  getShipmentBreakdown,
  getInventoryOverview,
  getRecentReceipts,
  getRecentShipments,
  getDashboardSignals,
} from "../dashboardStats";
import {
  getAppReadModelRevision,
  subscribeAppReadModelRevision,
} from "@/shared/appReadModelRevision";
import {
  DocumentOverviewCard,
  InventoryOverviewCard,
  RecentActivityPanel,
  DashboardQuickLinks,
  DashboardSignals,
} from "../components";

export function DashboardPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const workspaceMode = settings.general.workspaceMode;
  const showStockMovementsCard = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    settings.general.profileOverrides,
    "dashboardStockMovementsCard",
  );

  const appReadModelRevision = useSyncExternalStore(
    subscribeAppReadModelRevision,
    getAppReadModelRevision,
    getAppReadModelRevision,
  );

  const po = useMemo(() => getPurchaseOrderBreakdown(), [appReadModelRevision]);
  const so = useMemo(() => getSalesOrderBreakdown(), [appReadModelRevision]);
  const receipts = useMemo(() => getReceiptBreakdown(), [appReadModelRevision]);
  const shipments = useMemo(() => getShipmentBreakdown(), [appReadModelRevision]);
  const inventory = useMemo(() => getInventoryOverview(), [appReadModelRevision]);
  const recentReceipts = useMemo(() => getRecentReceipts(8), [appReadModelRevision]);
  const recentShipments = useMemo(() => getRecentShipments(8), [appReadModelRevision]);
  const signals = useMemo(() => getDashboardSignals(), [appReadModelRevision]);

  return (
    <div className="dashboard-page mx-auto max-w-[1600px] space-y-6 p-4 md:p-5" data-module="dashboard">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          {t("dashboard.title")}
        </h1>
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </header>

      <section className="space-y-2" aria-labelledby="dash-doc-heading">
        <h2
          id="dash-doc-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("dashboard.sections.documents")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentOverviewCard
            title={t("dashboard.po.title")}
            listPath="/purchase-orders"
            total={po.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: po.draft },
              { key: "confirmed", label: t("dashboard.stats.confirmed"), value: po.confirmed },
              { key: "closed", label: t("dashboard.stats.closed"), value: po.closed },
              { key: "cancelled", label: t("dashboard.stats.cancelled"), value: po.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.so.title")}
            listPath="/sales-orders"
            total={so.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: so.draft },
              { key: "confirmed", label: t("dashboard.stats.confirmed"), value: so.confirmed },
              { key: "closed", label: t("dashboard.stats.closed"), value: so.closed },
              { key: "cancelled", label: t("dashboard.stats.cancelled"), value: so.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.receipts.title")}
            listPath="/receipts"
            total={receipts.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: receipts.draft },
              { key: "posted", label: t("dashboard.stats.posted"), value: receipts.posted },
              { key: "reversed", label: t("dashboard.stats.reversed"), value: receipts.reversed },
              { key: "cancelled", label: t("dashboard.stats.cancelled"), value: receipts.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.shipments.title")}
            listPath="/shipments"
            total={shipments.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: shipments.draft },
              { key: "posted", label: t("dashboard.stats.posted"), value: shipments.posted },
              { key: "reversed", label: t("dashboard.stats.reversed"), value: shipments.reversed },
              { key: "cancelled", label: t("dashboard.stats.cancelled"), value: shipments.cancelled },
            ]}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-inv-heading">
        <h2
          id="dash-inv-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("dashboard.sections.inventory")}
        </h2>
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            showStockMovementsCard ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          <InventoryOverviewCard
            title={t("dashboard.stockBalances.title")}
            listPath="/stock-balances"
            metrics={[
              { key: "rows", label: t("dashboard.stockBalances.balanceRows"), value: inventory.balanceRows },
            ]}
          />
          {showStockMovementsCard ? (
            <InventoryOverviewCard
              title={t("dashboard.stockMovements.title")}
              listPath="/stock-movements"
              metrics={[
                { key: "rows", label: t("dashboard.stockMovements.movementRows"), value: inventory.movementRows },
              ]}
            />
          ) : null}
          <InventoryOverviewCard
            title={t("dashboard.items.title")}
            listPath="/items"
            metrics={[
              { key: "total", label: t("dashboard.items.total"), value: inventory.itemsTotal },
              { key: "active", label: t("dashboard.items.active"), value: inventory.itemsActive },
              { key: "images", label: t("dashboard.items.withImages"), value: inventory.itemsWithImages },
            ]}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-activity-heading">
        <h2
          id="dash-activity-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("dashboard.sections.recentActivity")}
        </h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <RecentActivityPanel
            variant="receipt"
            title={t("dashboard.recentReceipts.title")}
            listPath="/receipts"
            emptyMessage={t("dashboard.recentReceipts.empty")}
            rows={recentReceipts}
          />
          <RecentActivityPanel
            variant="shipment"
            title={t("dashboard.recentShipments.title")}
            listPath="/shipments"
            emptyMessage={t("dashboard.recentShipments.empty")}
            rows={recentShipments}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-nav-heading">
        <h2
          id="dash-nav-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("dashboard.sections.navSignals")}
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DashboardQuickLinks />
          <DashboardSignals signals={signals} />
        </div>
      </section>
    </div>
  );
}
