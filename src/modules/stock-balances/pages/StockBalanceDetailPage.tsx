import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { stockBalanceRepository } from "../repository";
import {
  buildIncomingRemainingByWarehouseItem,
  buildOutgoingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
  type StockBalanceCoverageStatus,
} from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
import {
  StockBalanceDetailContent,
  type StockBalanceDrillDownSnapshot,
} from "../components/StockBalanceDetailContent";

function coverageBadgeVariant(
  s: StockBalanceCoverageStatus,
): "destructive" | "secondary" | "outline" {
  if (s === "short") return "destructive";
  if (s === "at_risk") return "secondary";
  return "outline";
}

export function StockBalanceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const backHref = location.search === "" ? "/stock-balances" : `/stock-balances${location.search}`;

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
        <div className="doc-page__breadcrumb">
          <BackButton to={backHref} aria-label={t("ops.stockBalances.detail.backToListAria")} />
          <Breadcrumb items={[{ label: t("routes.stockBalances"), to: backHref }]} />
        </div>
        <div className="doc-page doc-page--not-found">
          <p>{t("ops.stockBalances.detail.notFound")}</p>
        </div>
      </div>
    );
  }

  const coverageLabel = t(`ops.stock.coverage.${row.coverageStatus}`);
  const breadcrumbItems = [
    { label: t("routes.stockBalances"), to: backHref },
    { label: `${row.itemCode} — ${row.warehouseName}` },
  ];

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to={backHref} aria-label={t("ops.stockBalances.detail.backToListAria")} />
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="doc-page__header">
        <div className="doc-header">
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground/90">
              {t("ops.stock.drilldown.headerKicker")}
            </p>
            <div className="doc-header__title-row">
              <h2 className="doc-header__title">
                <span className="font-mono tracking-tight">{row.itemCode}</span>
                <span className="mx-1 font-normal text-muted-foreground">—</span>
                <span>{row.itemName}</span>
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-muted-foreground/80">
                {t("ops.stock.drilldown.warehouseLabel")}
              </span>{" "}
              <span className="text-foreground/90">{row.warehouseName}</span>
            </p>
          </div>
          <div className="doc-header__right">
            <Card className="border border-border/70 shadow-none">
              <CardContent className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {t("doc.columns.coverage")}
                  </span>
                  <Badge
                    variant={coverageBadgeVariant(row.coverageStatus)}
                    className="h-5 px-1.5 text-[0.62rem]"
                  >
                    {coverageLabel}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {t("doc.columns.netShortage")}
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {row.netShortageQty}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-5xl">
        <StockBalanceDetailContent row={row} />
      </div>
    </div>
  );
}
