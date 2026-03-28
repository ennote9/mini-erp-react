import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  listIncomingContributorsForWarehouseItem,
  listOutgoingContributorsForWarehouseItem,
  listReservationContributorsForWarehouseItem,
} from "../../../shared/stockBalancesDrillDownContributors";
import { type StockBalanceCoverageStatus } from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
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

type Props = {
  row: StockBalanceDrillDownSnapshot;
};

const th =
  "border-b border-border/50 px-1.5 py-1.5 text-left text-[0.62rem] font-medium text-muted-foreground first:pl-0 last:pr-0";
const td =
  "border-b border-border/30 px-1.5 py-1.5 text-[0.6875rem] leading-snug tabular-nums align-top text-foreground/90 first:pl-0 last:pr-0";
const tfootLabel = "py-1.5 pr-2 text-[0.6875rem] font-medium text-muted-foreground first:pl-0";
const tfootValue = "py-1.5 pl-2 text-[0.6875rem] font-semibold tabular-nums text-foreground";
const linkBtn =
  "h-auto min-h-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[0.6875rem] font-medium text-foreground underline-offset-2 hover:underline";

function sumReservations(rows: { qty: number }[]) {
  return rows.reduce((a, r) => a + r.qty, 0);
}

function sumRemaining(rows: { remainingCounted: number }[]) {
  return rows.reduce((a, r) => a + r.remainingCounted, 0);
}

function coverageBadgeVariant(
  s: StockBalanceCoverageStatus,
): "destructive" | "secondary" | "outline" {
  if (s === "short") return "destructive";
  if (s === "at_risk") return "secondary";
  return "outline";
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded border border-border/60 bg-background px-2 py-1.5">
      <div className="text-[0.58rem] font-medium uppercase leading-none tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold leading-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function StockBalanceDetailContent({ row }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const coverageLabel = (s: StockBalanceCoverageStatus) => t(`ops.stock.coverage.${s}`);
  const isOperationalStyle = row.style === "GOOD";
  const nonOperationalStyleHint =
    row.style === "MARKDOWN"
      ? t("ops.stock.drilldown.markdownStyleHint")
      : row.style === "DEFECT"
        ? t("ops.stock.drilldown.defectStyleHint")
        : t("ops.stock.drilldown.nonGoodStyleHint");

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

  const sumRes = sumReservations(reservations);
  const sumOut = sumRemaining(outgoing);
  const sumInc = sumRemaining(incoming);

  const hasSalesSideContext = reservations.length > 0 || outgoing.length > 0;
  const hasPurchaseSideContext = incoming.length > 0;

  const navigateToRelatedSalesOrders = () => {
    const params = new URLSearchParams();
    params.set("warehouseId", row.warehouseId);
    params.set("itemId", row.itemId);
    navigate(`/sales-orders?${params.toString()}`);
  };

  const navigateToRelatedPurchaseOrders = () => {
    const params = new URLSearchParams();
    params.set("warehouseId", row.warehouseId);
    params.set("itemId", row.itemId);
    navigate(`/purchase-orders?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      <Card className="border border-border/70 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("ops.stock.drilldown.summarySection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <StatTile label={t("doc.columns.style")} value={t(`ops.stock.styles.${row.style}`)} />
            <StatTile label={t("doc.columns.totalQuantity")} value={row.qtyOnHand} />
            <StatTile label={t("doc.columns.reserved")} value={row.reservedQty} />
            <StatTile label={t("doc.columns.available")} value={row.availableQty} />
            <StatTile label={t("doc.columns.outgoing")} value={row.outgoingQty} />
            <StatTile label={t("doc.columns.incoming")} value={row.incomingQty} />
            <StatTile label={t("doc.columns.deficit")} value={row.deficitQty} />
            <StatTile label={t("doc.columns.netShortage")} value={row.netShortageQty} />
            <StatTile label={t("doc.columns.coverage")} value={coverageLabel(row.coverageStatus)} />
          </div>
          {!isOperationalStyle ? (
            <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
              {nonOperationalStyleHint}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="rounded-md border border-border/70 bg-background px-3 py-2" aria-labelledby="sb-src-res">
        <h3
          id="sb-src-res"
          className="mb-1.5 border-b border-border/50 pb-1 text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90"
        >
          {t("ops.stock.drilldown.reservationsTitle")}
        </h3>
        {reservations.length === 0 ? (
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            {t("ops.stock.drilldown.reservationsEmpty")}
          </p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px]">
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
                  {reservations.map((r) => (
                    <tr key={r.reservationId} className="hover:bg-background">
                      <td className={td}>
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => navigate(`/sales-orders/${r.salesOrderId}`)}
                        >
                          {r.salesOrderNumber}
                        </button>
                      </td>
                      <td className={td}>{r.salesOrderStatus}</td>
                      <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                        {r.salesOrderLineId}
                      </td>
                      <td className={cn(td, "text-right")}>{r.qty}</td>
                      <td className={cn(td, "text-[0.65rem] text-muted-foreground")}>
                        {r.updatedAt.slice(0, 19)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background">
                    <td colSpan={3} className={tfootLabel}>
                      {t("doc.columns.total")}
                    </td>
                    <td className={cn(tfootValue, "text-right")}>{sumRes}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {sumRes !== row.reservedQty ? (
              <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
                {t("ops.stock.drilldown.mismatchReserved", { sum: sumRes, grid: row.reservedQty })}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-md border border-border/70 bg-background px-3 py-2" aria-labelledby="sb-src-out">
        <h3
          id="sb-src-out"
          className="mb-1.5 border-b border-border/50 pb-1 text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90"
        >
          {t("ops.stock.drilldown.outgoingTitle")}
        </h3>
        {outgoing.length === 0 ? (
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            {t("ops.stock.drilldown.outgoingEmpty")}
          </p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-background">
                    <th className={th}>{t("doc.columns.salesOrder")}</th>
                    <th className={th}>{t("doc.columns.status")}</th>
                    <th className={th}>{t("doc.columns.line")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.ordered")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.shipped")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.remaining")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.reserved")}</th>
                  </tr>
                </thead>
                <tbody>
                  {outgoing.map((r) => (
                    <tr key={`${r.salesOrderId}-${r.lineId}`} className="hover:bg-background">
                      <td className={td}>
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => navigate(`/sales-orders/${r.salesOrderId}`)}
                        >
                          {r.salesOrderNumber}
                        </button>
                      </td>
                      <td className={td}>{r.salesOrderStatus}</td>
                      <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                        {r.lineId}
                      </td>
                      <td className={cn(td, "text-right")}>{r.orderedQty}</td>
                      <td className={cn(td, "text-right")}>{r.shippedQty}</td>
                      <td className={cn(td, "text-right font-medium")}>{r.remainingCounted}</td>
                      <td className={cn(td, "text-right")}>{r.lineReservedQty}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background">
                    <td colSpan={5} className={tfootLabel}>
                      {t("doc.columns.totalRemaining")}
                    </td>
                    <td className={cn(tfootValue, "text-right")}>{sumOut}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {sumOut !== row.outgoingQty ? (
              <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
                {t("ops.stock.drilldown.mismatchOutgoing", { sum: sumOut, grid: row.outgoingQty })}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-md border border-border/70 bg-background px-3 py-2" aria-labelledby="sb-src-in">
        <h3
          id="sb-src-in"
          className="mb-1.5 border-b border-border/50 pb-1 text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90"
        >
          {t("ops.stock.drilldown.incomingTitle")}
        </h3>
        {incoming.length === 0 ? (
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            {t("ops.stock.drilldown.incomingEmpty")}
          </p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="bg-background">
                    <th className={th}>{t("doc.columns.purchaseOrder")}</th>
                    <th className={th}>{t("doc.columns.status")}</th>
                    <th className={th}>{t("doc.columns.line")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.ordered")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.received")}</th>
                    <th className={cn(th, "text-right")}>{t("doc.columns.remaining")}</th>
                  </tr>
                </thead>
                <tbody>
                  {incoming.map((r) => (
                    <tr key={`${r.purchaseOrderId}-${r.lineId}`} className="hover:bg-background">
                      <td className={td}>
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => navigate(`/purchase-orders/${r.purchaseOrderId}`)}
                        >
                          {r.purchaseOrderNumber}
                        </button>
                      </td>
                      <td className={td}>{r.purchaseOrderStatus}</td>
                      <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                        {r.lineId}
                      </td>
                      <td className={cn(td, "text-right")}>{r.orderedQty}</td>
                      <td className={cn(td, "text-right")}>{r.receivedQty}</td>
                      <td className={cn(td, "text-right font-medium")}>{r.remainingCounted}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background">
                    <td colSpan={5} className={tfootLabel}>
                      {t("doc.columns.totalRemaining")}
                    </td>
                    <td className={cn(tfootValue, "text-right")}>{sumInc}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {sumInc !== row.incomingQty ? (
              <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground/85">
                {t("ops.stock.drilldown.mismatchIncoming", { sum: sumInc, grid: row.incomingQty })}
              </p>
            ) : null}
          </>
        )}
      </section>

      {hasSalesSideContext || hasPurchaseSideContext ? (
        <div className="flex flex-wrap gap-2">
          {hasSalesSideContext ? (
            <Button type="button" variant="outline" size="sm" onClick={navigateToRelatedSalesOrders}>
              {t("ops.stock.drilldown.openRelatedSo")}
            </Button>
          ) : null}
          {hasPurchaseSideContext ? (
            <Button type="button" variant="outline" size="sm" onClick={navigateToRelatedPurchaseOrders}>
              {t("ops.stock.drilldown.openRelatedPo")}
            </Button>
          ) : null}
          <Badge variant={coverageBadgeVariant(row.coverageStatus)} className="h-8 px-2 text-xs">
            {coverageLabel(row.coverageStatus)}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
