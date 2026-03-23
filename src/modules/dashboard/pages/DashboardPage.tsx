import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "@/shared/i18n";
import {
  getPurchaseOrderBreakdown,
  getSalesOrderBreakdown,
  getReceiptBreakdown,
  getShipmentBreakdown,
} from "../dashboardStats";
import {
  getAppReadModelRevision,
  subscribeAppReadModelRevision,
} from "@/shared/appReadModelRevision";
import { DocumentOverviewCard } from "../components";

function statusHref(basePath: string, status: string): string {
  return `${basePath}?status=${encodeURIComponent(status)}`;
}

export function DashboardPage() {
  const { t } = useTranslation();

  const appReadModelRevision = useSyncExternalStore(
    subscribeAppReadModelRevision,
    getAppReadModelRevision,
    getAppReadModelRevision,
  );

  const po = useMemo(() => getPurchaseOrderBreakdown(), [appReadModelRevision]);
  const so = useMemo(() => getSalesOrderBreakdown(), [appReadModelRevision]);
  const receipts = useMemo(() => getReceiptBreakdown(), [appReadModelRevision]);
  const shipments = useMemo(() => getShipmentBreakdown(), [appReadModelRevision]);

  const poPath = "/purchase-orders";
  const soPath = "/sales-orders";
  const rcPath = "/receipts";
  const shPath = "/shipments";

  return (
    <div className="dashboard-page mx-auto max-w-[1600px] space-y-6 p-4 md:p-5" data-module="dashboard">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          {t("dashboard.title")}
        </h1>
      </header>

      <section className="space-y-2" aria-labelledby="dash-doc-heading">
        <h2
          id="dash-doc-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("dashboard.sections.pipeline")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentOverviewCard
            title={t("dashboard.po.title")}
            listPath={poPath}
            total={po.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: po.draft, href: statusHref(poPath, "draft") },
              {
                key: "confirmed",
                label: t("dashboard.stats.confirmed"),
                value: po.confirmed,
                href: statusHref(poPath, "confirmed"),
              },
              { key: "closed", label: t("dashboard.stats.closed"), value: po.closed, href: statusHref(poPath, "closed") },
              {
                key: "cancelled",
                label: t("dashboard.stats.cancelled"),
                value: po.cancelled,
                href: statusHref(poPath, "cancelled"),
              },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.so.title")}
            listPath={soPath}
            total={so.total}
            stats={[
              { key: "draft", label: t("dashboard.stats.draft"), value: so.draft, href: statusHref(soPath, "draft") },
              {
                key: "confirmed",
                label: t("dashboard.stats.confirmed"),
                value: so.confirmed,
                href: statusHref(soPath, "confirmed"),
              },
              { key: "closed", label: t("dashboard.stats.closed"), value: so.closed, href: statusHref(soPath, "closed") },
              {
                key: "cancelled",
                label: t("dashboard.stats.cancelled"),
                value: so.cancelled,
                href: statusHref(soPath, "cancelled"),
              },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.receipts.title")}
            listPath={rcPath}
            total={receipts.total}
            stats={[
              {
                key: "draft",
                label: t("dashboard.stats.draft"),
                value: receipts.draft,
                href: statusHref(rcPath, "draft"),
              },
              {
                key: "posted",
                label: t("dashboard.stats.posted"),
                value: receipts.posted,
                href: statusHref(rcPath, "posted"),
              },
              {
                key: "reversed",
                label: t("dashboard.stats.reversed"),
                value: receipts.reversed,
                href: statusHref(rcPath, "reversed"),
              },
              {
                key: "cancelled",
                label: t("dashboard.stats.cancelled"),
                value: receipts.cancelled,
                href: statusHref(rcPath, "cancelled"),
              },
            ]}
          />
          <DocumentOverviewCard
            title={t("dashboard.shipments.title")}
            listPath={shPath}
            total={shipments.total}
            stats={[
              {
                key: "draft",
                label: t("dashboard.stats.draft"),
                value: shipments.draft,
                href: statusHref(shPath, "draft"),
              },
              {
                key: "posted",
                label: t("dashboard.stats.posted"),
                value: shipments.posted,
                href: statusHref(shPath, "posted"),
              },
              {
                key: "reversed",
                label: t("dashboard.stats.reversed"),
                value: shipments.reversed,
                href: statusHref(shPath, "reversed"),
              },
              {
                key: "cancelled",
                label: t("dashboard.stats.cancelled"),
                value: shipments.cancelled,
                href: statusHref(shPath, "cancelled"),
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
