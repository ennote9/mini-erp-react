import { useMemo } from "react";
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
  DocumentOverviewCard,
  InventoryOverviewCard,
  RecentActivityPanel,
  DashboardQuickLinks,
  DashboardSignals,
} from "../components";

export function DashboardPage() {
  const po = useMemo(() => getPurchaseOrderBreakdown(), []);
  const so = useMemo(() => getSalesOrderBreakdown(), []);
  const receipts = useMemo(() => getReceiptBreakdown(), []);
  const shipments = useMemo(() => getShipmentBreakdown(), []);
  const inventory = useMemo(() => getInventoryOverview(), []);
  const recentReceipts = useMemo(() => getRecentReceipts(8), []);
  const recentShipments = useMemo(() => getRecentShipments(8), []);
  const signals = useMemo(() => getDashboardSignals(), []);

  return (
    <div className="dashboard-page mx-auto max-w-[1600px] space-y-6 p-4 md:p-5" data-module="dashboard">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          Dashboard
        </h1>
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          Operational snapshot: document and inventory counts, recent receipts and shipments, and
          quick navigation.
        </p>
      </header>

      <section className="space-y-2" aria-labelledby="dash-doc-heading">
        <h2
          id="dash-doc-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Documents
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentOverviewCard
            title="Purchase orders"
            listPath="/purchase-orders"
            total={po.total}
            stats={[
              { key: "draft", label: "Draft", value: po.draft },
              { key: "confirmed", label: "Confirmed", value: po.confirmed },
              { key: "closed", label: "Closed", value: po.closed },
              { key: "cancelled", label: "Cancelled", value: po.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title="Sales orders"
            listPath="/sales-orders"
            total={so.total}
            stats={[
              { key: "draft", label: "Draft", value: so.draft },
              { key: "confirmed", label: "Confirmed", value: so.confirmed },
              { key: "closed", label: "Closed", value: so.closed },
              { key: "cancelled", label: "Cancelled", value: so.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title="Receipts"
            listPath="/receipts"
            total={receipts.total}
            stats={[
              { key: "draft", label: "Draft", value: receipts.draft },
              { key: "posted", label: "Posted", value: receipts.posted },
              { key: "cancelled", label: "Cancelled", value: receipts.cancelled },
            ]}
          />
          <DocumentOverviewCard
            title="Shipments"
            listPath="/shipments"
            total={shipments.total}
            stats={[
              { key: "draft", label: "Draft", value: shipments.draft },
              { key: "posted", label: "Posted", value: shipments.posted },
              { key: "cancelled", label: "Cancelled", value: shipments.cancelled },
            ]}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-inv-heading">
        <h2
          id="dash-inv-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Inventory
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InventoryOverviewCard
            title="Stock balances"
            listPath="/stock-balances"
            metrics={[{ key: "rows", label: "Balance rows", value: inventory.balanceRows }]}
          />
          <InventoryOverviewCard
            title="Stock movements"
            listPath="/stock-movements"
            metrics={[{ key: "rows", label: "Movement rows", value: inventory.movementRows }]}
          />
          <InventoryOverviewCard
            title="Items"
            listPath="/items"
            metrics={[
              { key: "total", label: "Total items", value: inventory.itemsTotal },
              { key: "active", label: "Active", value: inventory.itemsActive },
              { key: "images", label: "With images", value: inventory.itemsWithImages },
            ]}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-activity-heading">
        <h2
          id="dash-activity-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Recent activity
        </h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <RecentActivityPanel
            variant="receipt"
            title="Recent receipts"
            listPath="/receipts"
            emptyMessage="No receipts yet."
            rows={recentReceipts}
          />
          <RecentActivityPanel
            variant="shipment"
            title="Recent shipments"
            listPath="/shipments"
            emptyMessage="No shipments yet."
            rows={recentShipments}
          />
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="dash-nav-heading">
        <h2
          id="dash-nav-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Navigation &amp; signals
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DashboardQuickLinks />
          <DashboardSignals signals={signals} />
        </div>
      </section>
    </div>
  );
}
