import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listIncomingContributorsForWarehouseItem,
  listOutgoingContributorsForWarehouseItem,
  listReservationContributorsForWarehouseItem,
} from "../../../shared/stockBalancesDrillDownContributors";
import { type StockBalanceCoverageStatus } from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import type { StockStyle } from "@/shared/inventoryStyle";

export type StockBalanceDrillDownSnapshot = {
  itemId: string;
  warehouseId: string;
  style: StockStyle;
  itemCode: string;
  itemName: string;
  warehouseName: string;
  qtyOnHand: number;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
  deficitQty: number;
  netShortageQty: number;
  coverageStatus: StockBalanceCoverageStatus;
};

export type StockBalanceDetailTab =
  | "operational"
  | "outgoing"
  | "incoming"
  | "reservations";

type Props = {
  row: StockBalanceDrillDownSnapshot;
  activeTab: StockBalanceDetailTab;
};

const th =
  "border-b border-border/50 px-1.5 py-1.5 text-left text-[0.62rem] font-medium text-muted-foreground first:pl-0 last:pr-0";
const td =
  "border-b border-border/30 px-1.5 py-1.5 text-[0.6875rem] leading-snug tabular-nums align-top text-foreground/90 first:pl-0 last:pr-0";
const tfootLabel = "py-1.5 pr-2 text-[0.6875rem] font-medium text-muted-foreground first:pl-0";
const tfootValue = "py-1.5 pl-2 text-[0.6875rem] font-semibold tabular-nums text-foreground";
const linkBtn =
  "h-auto min-h-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[0.6875rem] font-medium text-foreground underline-offset-2 hover:underline";

function coverageBadgeVariant(
  s: StockBalanceCoverageStatus,
): "destructive" | "secondary" | "outline" {
  if (s === "short") return "destructive";
  if (s === "at_risk") return "secondary";
  return "outline";
}

function sumRemaining(rows: { remainingCounted: number }[]) {
  return rows.reduce((a, r) => a + r.remainingCounted, 0);
}

function sumOutgoingImpact(rows: { impactShortage: number }[]) {
  return rows.reduce((a, r) => a + r.impactShortage, 0);
}

function sumIncomingCoverage(rows: { coverageImpact: number }[]) {
  return rows.reduce((a, r) => a + r.coverageImpact, 0);
}

function sumReservations(rows: { qty: number }[]) {
  return rows.reduce((a, r) => a + r.qty, 0);
}

export function StockBalanceDetailContent({ row, activeTab }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatDateTime, formatNumber } = useAppDisplayFormatters();
  const isOperationalStyle = row.style === "GOOD";

  const formatQty = (value: number) =>
    formatNumber(value, { minFractionDigits: 0, maxFractionDigits: 0 });

  const reservations = useMemo(
    () =>
      isOperationalStyle
        ? listReservationContributorsForWarehouseItem(row.warehouseId, row.itemId)
        : [],
    [isOperationalStyle, row.warehouseId, row.itemId],
  );
  const outgoing = useMemo(
    () =>
      isOperationalStyle
        ? listOutgoingContributorsForWarehouseItem(row.warehouseId, row.itemId)
        : [],
    [isOperationalStyle, row.warehouseId, row.itemId],
  );
  const incoming = useMemo(
    () =>
      isOperationalStyle
        ? listIncomingContributorsForWarehouseItem(row.warehouseId, row.itemId)
        : [],
    [isOperationalStyle, row.warehouseId, row.itemId],
  );

  const outgoingRows = useMemo(
    () =>
      outgoing.map((record) => ({
        ...record,
        impactShortage: Math.max(0, record.remainingCounted - record.lineReservedQty),
      })),
    [outgoing],
  );
  const incomingRows = useMemo(() => {
    let restToCover = row.netShortageQty;
    return incoming.map((record) => {
      const coverageImpact = Math.min(record.remainingCounted, Math.max(0, restToCover));
      restToCover = Math.max(0, restToCover - coverageImpact);
      return {
        ...record,
        coverageImpact,
      };
    });
  }, [incoming, row.netShortageQty]);

  if (activeTab === "operational") {
    return (
      <div className="space-y-3">
        <section className="rounded-md border border-border/70 bg-background p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.available")}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{formatQty(row.availableQty)}</div>
            </div>
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.reserved")}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{formatQty(row.reservedQty)}</div>
            </div>
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.outgoing")}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{formatQty(row.outgoingQty)}</div>
            </div>
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.incoming")}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{formatQty(row.incomingQty)}</div>
            </div>
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.netShortage")}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{formatQty(row.netShortageQty)}</div>
            </div>
            <div className="rounded border border-border/60 bg-background px-2.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t("doc.columns.coverage")}</div>
              <div className="mt-1">
                <Badge variant={coverageBadgeVariant(row.coverageStatus)} className="h-5 px-2 text-[0.68rem]">
                  {t(`ops.stock.coverage.${row.coverageStatus}`)}
                </Badge>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "outgoing") {
    const sumOut = sumRemaining(outgoingRows);
    const sumOutImpact = sumOutgoingImpact(outgoingRows);
    return (
      <section className="rounded-md border border-border/70 bg-background px-3 py-2">
        {outgoingRows.length === 0 ? (
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            {t("ops.stock.drilldown.outgoingEmpty")}
          </p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-background">
                    <th className={th}>{t("doc.columns.salesOrder")}</th>
                    <th className={th}>{t("doc.columns.status")}</th>
                    <th className={th}>{t("doc.columns.line")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.ordered")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.shipped")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.remaining")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.reserved")}</th>
                    <th className={cn(th, "text-right")}>{t("ops.stock.drilldown.shortageImpact")}</th>
                  </tr>
                </thead>
                <tbody>
                  {outgoingRows.map((record) => (
                    <tr key={`${record.salesOrderId}-${record.lineId}`} className="hover:bg-background">
                      <td className={td}>
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => navigate(`/sales-orders/${record.salesOrderId}`)}
                        >
                          {record.salesOrderNumber}
                        </button>
                      </td>
                      <td className={td}>{record.salesOrderStatus}</td>
                      <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                        {record.lineId}
                      </td>
                      <td className={cn(td, "text-right")}>{formatQty(record.orderedQty)}</td>
                      <td className={cn(td, "text-right")}>{formatQty(record.shippedQty)}</td>
                      <td className={cn(td, "text-right font-medium")}>{formatQty(record.remainingCounted)}</td>
                      <td className={cn(td, "text-right")}>{formatQty(record.lineReservedQty)}</td>
                      <td className={cn(td, "text-right font-medium")}>{formatQty(record.impactShortage)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background">
                    <td colSpan={5} className={tfootLabel}>
                      {t("doc.columns.totalRemaining")}
                    </td>
                    <td className={cn(tfootValue, "text-right")}>{formatQty(sumOut)}</td>
                    <td />
                    <td className={cn(tfootValue, "text-right")}>{formatQty(sumOutImpact)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {sumOut !== row.outgoingQty ? (
              <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
                {t("ops.stock.drilldown.mismatchOutgoing", { sum: formatQty(sumOut), grid: formatQty(row.outgoingQty) })}
              </p>
            ) : null}
          </>
        )}
      </section>
    );
  }

  if (activeTab === "incoming") {
    const sumInc = sumRemaining(incomingRows);
    const sumIncCoverage = sumIncomingCoverage(incomingRows);
    return (
      <section className="rounded-md border border-border/70 bg-background px-3 py-2">
        {incomingRows.length === 0 ? (
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            {t("ops.stock.drilldown.incomingEmpty")}
          </p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="bg-background">
                    <th className={th}>{t("doc.columns.purchaseOrder")}</th>
                    <th className={th}>{t("doc.columns.status")}</th>
                    <th className={th}>{t("doc.columns.line")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.ordered")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.received")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.remaining")}</th>
                    <th className={cn(th, "text-right")}>{t("ops.stock.drilldown.coverageImpact")}</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingRows.map((record) => (
                    <tr key={`${record.purchaseOrderId}-${record.lineId}`} className="hover:bg-background">
                      <td className={td}>
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => navigate(`/purchase-orders/${record.purchaseOrderId}`)}
                        >
                          {record.purchaseOrderNumber}
                        </button>
                      </td>
                      <td className={td}>{record.purchaseOrderStatus}</td>
                      <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                        {record.lineId}
                      </td>
                      <td className={cn(td, "text-right")}>{formatQty(record.orderedQty)}</td>
                      <td className={cn(td, "text-right")}>{formatQty(record.receivedQty)}</td>
                      <td className={cn(td, "text-right font-medium")}>{formatQty(record.remainingCounted)}</td>
                      <td className={cn(td, "text-right font-medium")}>{formatQty(record.coverageImpact)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background">
                    <td colSpan={5} className={tfootLabel}>
                      {t("doc.columns.totalRemaining")}
                    </td>
                    <td className={cn(tfootValue, "text-right")}>{formatQty(sumInc)}</td>
                    <td className={cn(tfootValue, "text-right")}>{formatQty(sumIncCoverage)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {sumInc !== row.incomingQty ? (
              <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
                {t("ops.stock.drilldown.mismatchIncoming", { sum: formatQty(sumInc), grid: formatQty(row.incomingQty) })}
              </p>
            ) : null}
          </>
        )}
      </section>
    );
  }

  const sumRes = sumReservations(reservations);
  return (
    <section className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
      {reservations.length === 0 ? (
        <p className="text-[0.6875rem] leading-snug text-muted-foreground/90">
          {t("ops.stock.drilldown.reservationsEmptyLight")}
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-background">
                <th className={th}>{t("doc.columns.salesOrder")}</th>
                <th className={th}>{t("doc.columns.status")}</th>
                <th className={th}>{t("doc.columns.line")}</th>
                <th className={cn(th, "text-right")}>{t("doc.columns.reserved")}</th>
                <th className={th}>{t("doc.columns.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((record) => (
                <tr key={record.reservationId} className="hover:bg-background">
                  <td className={td}>
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => navigate(`/sales-orders/${record.salesOrderId}`)}
                    >
                      {record.salesOrderNumber}
                    </button>
                  </td>
                  <td className={td}>{record.salesOrderStatus}</td>
                  <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                    {record.salesOrderLineId}
                  </td>
                  <td className={cn(td, "text-right")}>{formatQty(record.qty)}</td>
                  <td className={cn(td, "text-[0.65rem] text-muted-foreground")}>
                    {formatDateTime(record.updatedAt, { empty: "—" })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-background">
                <td colSpan={3} className={tfootLabel}>
                  {t("doc.columns.total")}
                </td>
                <td className={cn(tfootValue, "text-right")}>{formatQty(sumRes)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {reservations.length > 0 && sumRes !== row.reservedQty ? (
        <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
          {t("ops.stock.drilldown.mismatchReserved", { sum: formatQty(sumRes), grid: formatQty(row.reservedQty) })}
        </p>
      ) : null}
    </section>
  );
}
