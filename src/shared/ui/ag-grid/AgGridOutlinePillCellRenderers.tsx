import type { ICellRendererParams } from "ag-grid-community";
import { useTranslation } from "@/shared/i18n/context";
import { GridOutlinePillBadge } from "./GridOutlinePillBadge";
import {
  activeBooleanToPillTone,
  carrierTypeLabelPillTone,
  factualStatusToPillTone,
  movementTypeToPillTone,
  planningStatusToPillTone,
  stockCoverageToPillTone,
} from "./gridOutlinePillMapping";
import type { StockBalanceCoverageStatus } from "@/shared/stockBalancesOperationalMetrics";
import { translateCarrierType } from "@/modules/carriers/carrierLabels";
import type { Carrier } from "@/modules/carriers/model";

/** PO / SO list — `field: "status"` */
export function AgGridPlanningStatusCellRenderer(
  params: ICellRendererParams<{ status?: string }>,
) {
  const { t } = useTranslation();
  const status = params.value as string | undefined;
  if (status == null) return null;
  return (
    <GridOutlinePillBadge tone={planningStatusToPillTone(status)}>
      {t(`status.labels.${status}`)}
    </GridOutlinePillBadge>
  );
}

/** Receipt / Shipment list — `field: "status"` */
export function AgGridFactualStatusCellRenderer(
  params: ICellRendererParams<{ status?: string }>,
) {
  const { t } = useTranslation();
  const status = params.value as string | undefined;
  if (status == null) return null;
  return (
    <GridOutlinePillBadge tone={factualStatusToPillTone(status)}>
      {t(`status.labels.${status}`)}
    </GridOutlinePillBadge>
  );
}

/** Master lists — `field: "isActive"` */
export function AgGridActiveBooleanCellRenderer(params: ICellRendererParams<{ isActive?: boolean }>) {
  const { t } = useTranslation();
  const isActive = params.value as boolean;
  const label = isActive ? t("ops.master.activeCell.active") : t("ops.master.activeCell.inactive");
  return (
    <GridOutlinePillBadge tone={activeBooleanToPillTone(isActive)}>{label}</GridOutlinePillBadge>
  );
}

/** Stock balances — `field: "coverageStatus"` */
export function AgGridStockCoverageCellRenderer(
  params: ICellRendererParams<{ coverageStatus?: StockBalanceCoverageStatus }>,
) {
  const { t } = useTranslation();
  const raw = params.value as StockBalanceCoverageStatus | undefined;
  if (raw == null) return null;
  return (
    <GridOutlinePillBadge tone={stockCoverageToPillTone(raw)}>
      {t(`ops.stock.coverage.${raw}`)}
    </GridOutlinePillBadge>
  );
}

/** Carriers list — carrier type label (categorical) */
export function AgGridCarrierTypeCellRenderer(params: ICellRendererParams<Carrier>) {
  const { t } = useTranslation();
  const row = params.data;
  if (!row) return null;
  return (
    <GridOutlinePillBadge tone={carrierTypeLabelPillTone()}>
      {translateCarrierType(t, row.carrierType)}
    </GridOutlinePillBadge>
  );
}

/** Stock movements — movement type code */
export function AgGridMovementTypeCellRenderer(params: ICellRendererParams<{ movementType?: string }>) {
  const { t } = useTranslation();
  const value = params.value as string | undefined;
  if (value == null) return null;
  const key = `ops.stockMovements.types.${value}`;
  const translated = t(key);
  const label = translated === value ? value : translated;
  return <GridOutlinePillBadge tone={movementTypeToPillTone(value)}>{label}</GridOutlinePillBadge>;
}
