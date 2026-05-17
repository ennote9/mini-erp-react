import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "radix-ui";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { stockBalanceRepository } from "../repository";
import {
  buildIncomingRemainingByWarehouseItem,
  buildOutgoingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
} from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
import {
  StockBalanceDetailContent,
  type StockBalanceDetailTab,
  type StockBalanceDrillDownSnapshot,
} from "../components/StockBalanceDetailContent";

export function StockBalanceDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<StockBalanceDetailTab>("operational");

  const row = useMemo((): StockBalanceDrillDownSnapshot | null => {
    if (!id) return null;
    const balance = stockBalanceRepository.getById(id);
    if (!balance) return null;
    const item = itemRepository.getById(balance.itemId);
    const warehouse = warehouseRepository.getById(balance.warehouseId);
    const outgoing = buildOutgoingRemainingByWarehouseItem();
    const incoming = buildIncomingRemainingByWarehouseItem();
    const operational = computeOperationalFieldsForBalance(balance, outgoing, incoming);

    return {
      itemId: balance.itemId,
      warehouseId: balance.warehouseId,
      style: balance.style,
      itemCode: item?.code ?? balance.itemId,
      itemName: item?.name ?? balance.itemId,
      warehouseName: warehouse?.name ?? balance.warehouseId,
      qtyOnHand: balance.qtyOnHand,
      reservedQty: operational.reservedQty,
      availableQty: operational.availableQty,
      outgoingQty: operational.outgoingQty,
      incomingQty: operational.incomingQty,
      deficitQty: operational.deficitQty,
      netShortageQty: operational.netShortageQty,
      coverageStatus: operational.coverageStatus,
    };
  }, [id]);

  if (!row) {
    return (
      <div className="doc-page">
        <div className="doc-page doc-page--not-found">
          <p>{t("ops.stockBalances.detail.notFound")}</p>
        </div>
      </div>
    );
  }

  const styleLabel = t(`ops.stock.styles.${row.style}`);
  const actions = [
    {
      key: "item",
      label: t("ops.stock.drilldown.openItemCard"),
      onClick: () => navigate(`/items/${row.itemId}`),
    },
    {
      key: "so",
      label: t("ops.stock.drilldown.openRelatedSo"),
      onClick: () => navigate(`/sales-orders?warehouseId=${encodeURIComponent(row.warehouseId)}&itemId=${encodeURIComponent(row.itemId)}`),
    },
    {
      key: "po",
      label: t("ops.stock.drilldown.openRelatedPo"),
      onClick: () => navigate(`/purchase-orders?warehouseId=${encodeURIComponent(row.warehouseId)}&itemId=${encodeURIComponent(row.itemId)}`),
    },
    {
      key: "moves",
      label: t("ops.stock.drilldown.openRelatedMovements"),
      onClick: () => navigate(`/stock-movements?warehouseId=${encodeURIComponent(row.warehouseId)}&itemId=${encodeURIComponent(row.itemId)}`),
    },
  ];

  return (
    <div className="doc-page">
      <div className="w-full max-w-[1480px] min-w-0 space-y-4">
        <div className="doc-page__breadcrumb">
          <div className="ml-1 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <Card className="border border-border/70 shadow-none">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground/90">
                    {t("ops.stock.drilldown.headerKicker")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                    <span className="font-mono tracking-tight">{row.itemCode}</span>
                    <span className="mx-1 font-normal text-muted-foreground">—</span>
                    <span>{row.itemName}</span>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="text-muted-foreground/80">{t("ops.stock.drilldown.warehouseLabel")}</span>{" "}
                    <span className="text-foreground/90">{row.warehouseName}</span>
                    <span className="mx-2 text-muted-foreground/60">•</span>
                    <span className="text-muted-foreground/80">{t("doc.columns.style")}</span>{" "}
                    <span className="text-foreground/90">{styleLabel}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as StockBalanceDetailTab)}>
            <Tabs.List className="inline-flex h-9 items-center justify-start rounded-lg border border-border/70 bg-muted/40 p-1 text-muted-foreground">
              <Tabs.Trigger
                value="operational"
                className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("ops.stock.drilldown.tabOperational")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="outgoing"
                className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("ops.stock.drilldown.tabOutgoing")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="incoming"
                className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("ops.stock.drilldown.tabIncoming")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="reservations"
                className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("ops.stock.drilldown.tabReservations")}
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value={activeTab} className="mt-3 outline-none">
              <StockBalanceDetailContent row={row} activeTab={activeTab} />
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
