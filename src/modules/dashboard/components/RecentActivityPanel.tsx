import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import type { FactualDocumentStatus } from "../../../shared/domain";

export type RecentActivityReceiptRow = {
  id: string;
  number: string;
  date: string;
  status: FactualDocumentStatus;
  purchaseOrderNumber: string;
  warehouseName: string;
};

export type RecentActivityShipmentRow = {
  id: string;
  number: string;
  date: string;
  status: FactualDocumentStatus;
  salesOrderNumber: string;
  warehouseName: string;
};

type ReceiptProps = {
  variant: "receipt";
  title: string;
  listPath: string;
  emptyMessage: string;
  rows: RecentActivityReceiptRow[];
};

type ShipmentProps = {
  variant: "shipment";
  title: string;
  listPath: string;
  emptyMessage: string;
  rows: RecentActivityShipmentRow[];
};

type Props = ReceiptProps | ShipmentProps;

export function RecentActivityPanel(props: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { title, listPath, emptyMessage, rows } = props;

  return (
    <Card className="min-w-0 border-border/60 bg-card/40 shadow-none">
      <CardHeader className="space-y-0 p-3 pb-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs">{t("dashboard.recent.byDate")}</CardDescription>
          </div>
          <button
            type="button"
            className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => navigate(listPath)}
          >
            {t("dashboard.recent.openList")}
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {rows.length === 0 ? (
          <p className="m-0 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
            <table className="list-table text-sm">
              <thead>
                <tr>
                  <th className="list-table__cell--code">{t("dashboard.recent.columns.number")}</th>
                  <th className="whitespace-nowrap">{t("dashboard.recent.columns.date")}</th>
                  <th className="min-w-[88px]">{t("dashboard.recent.columns.status")}</th>
                  <th className="min-w-[100px]">{t("dashboard.recent.columns.source")}</th>
                  <th className="min-w-[100px]">{t("dashboard.recent.columns.warehouse")}</th>
                </tr>
              </thead>
              <tbody>
                {props.variant === "receipt"
                  ? props.rows.map((r) => (
                      <tr
                        key={r.id}
                        className="list-table__row list-table__row--clickable"
                        onClick={() => navigate(`/receipts/${r.id}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={t("dashboard.recent.openReceiptAria", { number: r.number })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/receipts/${r.id}`);
                          }
                        }}
                      >
                        <td className="list-table__cell--code font-medium">{r.number}</td>
                        <td className="tabular-nums whitespace-nowrap text-foreground/90">
                          {r.date}
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="truncate max-w-[10rem]" title={r.purchaseOrderNumber}>
                          {t("dashboard.recent.poPrefix")} {r.purchaseOrderNumber}
                        </td>
                        <td className="truncate max-w-[10rem]" title={r.warehouseName}>
                          {r.warehouseName}
                        </td>
                      </tr>
                    ))
                  : props.rows.map((s) => (
                      <tr
                        key={s.id}
                        className="list-table__row list-table__row--clickable"
                        onClick={() => navigate(`/shipments/${s.id}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={t("dashboard.recent.openShipmentAria", { number: s.number })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/shipments/${s.id}`);
                          }
                        }}
                      >
                        <td className="list-table__cell--code font-medium">{s.number}</td>
                        <td className="tabular-nums whitespace-nowrap text-foreground/90">
                          {s.date}
                        </td>
                        <td>
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="truncate max-w-[10rem]" title={s.salesOrderNumber}>
                          {t("dashboard.recent.soPrefix")} {s.salesOrderNumber}
                        </td>
                        <td className="truncate max-w-[10rem]" title={s.warehouseName}>
                          {s.warehouseName}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
