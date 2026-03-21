import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listReservationContributorsForWarehouseItem,
  listOutgoingContributorsForWarehouseItem,
  listIncomingContributorsForWarehouseItem,
} from "../../../shared/stockBalancesDrillDownContributors";
import { type StockBalanceCoverageStatus } from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";

export type StockBalanceDrillDownSnapshot = {
  itemId: string;
  warehouseId: string;
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
  onOpenChange: (open: boolean) => void;
};

const th =
  "text-left text-[0.62rem] font-medium text-muted-foreground py-1.5 px-1.5 first:pl-0 last:pr-0 border-b border-border/50";
const td =
  "py-1.5 px-1.5 first:pl-0 last:pr-0 border-b border-border/30 text-[0.6875rem] leading-snug tabular-nums align-top text-foreground/90";
const tfootLabel = "py-1.5 pr-2 text-[0.6875rem] font-medium text-muted-foreground first:pl-0";
const tfootValue = "py-1.5 pl-2 text-[0.6875rem] font-semibold tabular-nums text-foreground";
const linkBtn =
  "text-left text-foreground underline-offset-2 hover:underline font-medium text-[0.6875rem] p-0 h-auto min-h-0 bg-transparent border-0 cursor-pointer";

const sectionBlock = "rounded-md border border-border/70 bg-background px-3 py-2";

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
    <div className="rounded border border-border/60 bg-background px-2 py-1.5 min-w-0">
      <div className="text-[0.58rem] font-medium uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground leading-tight">{value}</div>
    </div>
  );
}

export function StockBalanceRowDrillDown({ row, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const coverageLabel = (s: StockBalanceCoverageStatus) => t(`ops.stock.coverage.${s}`);

  const reservations = useMemo(
    () => listReservationContributorsForWarehouseItem(row.warehouseId, row.itemId),
    [row.warehouseId, row.itemId],
  );
  const outgoing = useMemo(
    () => listOutgoingContributorsForWarehouseItem(row.warehouseId, row.itemId),
    [row.warehouseId, row.itemId],
  );
  const incoming = useMemo(
    () => listIncomingContributorsForWarehouseItem(row.warehouseId, row.itemId),
    [row.warehouseId, row.itemId],
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
    onOpenChange(false);
    navigate(`/sales-orders?${params.toString()}`);
  };

  const navigateToRelatedPurchaseOrders = () => {
    const params = new URLSearchParams();
    params.set("warehouseId", row.warehouseId);
    params.set("itemId", row.itemId);
    onOpenChange(false);
    navigate(`/purchase-orders?${params.toString()}`);
  };

  return (
    <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[min(88vh,840px)] w-[min(100vw-1.5rem,52rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">
            {t("ops.stock.drilldown.titleSr", { code: row.itemCode })}
          </Dialog.Title>
          <Dialog.Description className="sr-only">{t("ops.stock.drilldown.descSr")}</Dialog.Description>

          {/* Header — fixed */}
          <header className="shrink-0 border-b border-border bg-background px-4 pt-3 pb-2">
            <p className="text-[0.6rem] font-medium uppercase tracking-widest text-muted-foreground/90">
              {t("ops.stock.drilldown.headerKicker")}
            </p>
            <h2 className="mt-1 text-sm font-semibold leading-snug text-foreground">
              <span className="font-mono tracking-tight">{row.itemCode}</span>
              <span className="mx-1 font-normal text-muted-foreground">—</span>
              <span>{row.itemName}</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="text-muted-foreground/80">{t("ops.stock.drilldown.warehouseLabel")}</span>{" "}
              <span className="text-foreground/90">{row.warehouseName}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  {t("doc.columns.coverage")}
                </span>
                <Badge variant={coverageBadgeVariant(row.coverageStatus)} className="text-[0.62rem] px-1.5 py-0 h-5">
                  {coverageLabel(row.coverageStatus)}
                </Badge>
              </div>
              <div className="h-3.5 w-px bg-border/80 hidden sm:block" aria-hidden />
              <div className="flex items-baseline gap-1">
                <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  {t("doc.columns.netShortage")}
                </span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{row.netShortageQty}</span>
              </div>
            </div>
          </header>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2.5 space-y-3 bg-background">
            {/* Summary — stat tiles */}
            <div>
              <h3 className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("ops.stock.drilldown.summarySection")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <StatTile label={t("doc.columns.totalQuantity")} value={row.qtyOnHand} />
                <StatTile label={t("doc.columns.reserved")} value={row.reservedQty} />
                <StatTile label={t("doc.columns.available")} value={row.availableQty} />
                <StatTile label={t("doc.columns.outgoing")} value={row.outgoingQty} />
                <StatTile label={t("doc.columns.incoming")} value={row.incomingQty} />
                <StatTile label={t("doc.columns.deficit")} value={row.deficitQty} />
                <StatTile label={t("doc.columns.netShortage")} value={row.netShortageQty} />
                <StatTile label={t("doc.columns.coverage")} value={coverageLabel(row.coverageStatus)} />
              </div>
            </div>

            {/* Active reservations */}
            <section className={sectionBlock} aria-labelledby="sb-src-res">
              <h3
                id="sb-src-res"
                className="text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90 mb-1.5 pb-1 border-b border-border/50"
              >
                {t("ops.stock.drilldown.reservationsTitle")}
              </h3>
              {reservations.length === 0 ? (
                <p className="text-[0.6875rem] text-muted-foreground leading-snug">
                  {t("ops.stock.drilldown.reservationsEmpty")}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
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
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate(`/sales-orders/${r.salesOrderId}`);
                                }}
                              >
                                {r.salesOrderNumber}
                              </button>
                            </td>
                            <td className={td}>{r.salesOrderStatus}</td>
                            <td className={cn(td, "font-mono text-[0.65rem] text-muted-foreground")}>
                              {r.salesOrderLineId}
                            </td>
                            <td className={cn(td, "text-right")}>{r.qty}</td>
                            <td className={cn(td, "text-muted-foreground text-[0.65rem]")}>
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

            {/* Outgoing demand */}
            <section className={sectionBlock} aria-labelledby="sb-src-out">
              <h3
                id="sb-src-out"
                className="text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90 mb-1.5 pb-1 border-b border-border/50"
              >
                {t("ops.stock.drilldown.outgoingTitle")}
              </h3>
              {outgoing.length === 0 ? (
                <p className="text-[0.6875rem] text-muted-foreground leading-snug">
                  {t("ops.stock.drilldown.outgoingEmpty")}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
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
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate(`/sales-orders/${r.salesOrderId}`);
                                }}
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

            {/* Incoming supply */}
            <section className={sectionBlock} aria-labelledby="sb-src-in">
              <h3
                id="sb-src-in"
                className="text-[0.62rem] font-semibold uppercase tracking-wider text-foreground/90 mb-1.5 pb-1 border-b border-border/50"
              >
                {t("ops.stock.drilldown.incomingTitle")}
              </h3>
              {incoming.length === 0 ? (
                <p className="text-[0.6875rem] text-muted-foreground leading-snug">
                  {t("ops.stock.drilldown.incomingEmpty")}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
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
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate(`/purchase-orders/${r.purchaseOrderId}`);
                                }}
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
          </div>

          {/* Footer — fixed */}
          <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {hasSalesSideContext ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[0.6875rem] px-2 text-muted-foreground"
                  onClick={navigateToRelatedSalesOrders}
                >
                  {t("ops.stock.drilldown.openRelatedSo")}
                </Button>
              ) : null}
              {hasPurchaseSideContext ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[0.6875rem] px-2 text-muted-foreground"
                  onClick={navigateToRelatedPurchaseOrders}
                >
                  {t("ops.stock.drilldown.openRelatedPo")}
                </Button>
              ) : null}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 min-w-[4.5rem] text-[0.6875rem]" onClick={() => onOpenChange(false)}>
              {t("ops.stock.drilldown.close")}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
