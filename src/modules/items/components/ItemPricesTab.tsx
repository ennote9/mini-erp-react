import { useCallback, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import type { Item, ItemPriceReasonCode, ItemPriceRecord, ItemPriceType } from "../model";
import { itemRepository } from "../repository";
import {
  applyItemPriceAwaitPersist,
  cancelScheduledItemPriceAwaitPersist,
} from "../itemPriceService";
import {
  buildPriceHistoryRows,
  getCurrentActiveRecord,
  getNextScheduledRecord,
  todayYmdLocal,
  type PriceHistoryRow,
} from "../lib/itemPriceHistory";
import { ItemPriceEditDialog } from "./ItemPriceEditDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { cn } from "@/lib/utils";

type Filter = "all" | "purchase" | "sale";

type Props = {
  itemId: string | undefined;
  isNew: boolean;
  revision: number;
  onPricesChanged: () => void;
};

function statusLabelKey(status: PriceHistoryRow["status"]): string {
  switch (status) {
    case "active":
      return "master.item.prices.statusActive";
    case "scheduled":
      return "master.item.prices.statusScheduled";
    case "superseded":
      return "master.item.prices.statusSuperseded";
    case "cancelled":
      return "master.item.prices.statusCancelled";
    default:
      return "master.item.prices.statusActive";
  }
}

function statusBadgeClasses(status: PriceHistoryRow["status"]): string {
  switch (status) {
    case "active":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-100";
    case "scheduled":
      return "border-sky-500/35 bg-sky-500/12 text-sky-100";
    case "cancelled":
      return "border-destructive/40 bg-destructive/15 text-destructive-foreground";
    case "superseded":
      return "border-border/60 bg-muted/40 text-muted-foreground";
    default:
      return "border-border/60 bg-muted/30 text-foreground";
  }
}

export function ItemPricesTab({ itemId, isNew, revision, onPricesChanged }: Props) {
  const { t } = useTranslation();
  const { formatNumber } = useAppDisplayFormatters();
  const [filter, setFilter] = useState<Filter>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [fixedType, setFixedType] = useState<ItemPriceType | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacePayload, setReplacePayload] = useState<{
    priceType: ItemPriceType;
    amount: number;
    validFromYmd: string;
    reasonCode: ItemPriceReasonCode;
    comment?: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ recordId: string; priceType: ItemPriceType } | null>(null);

  const item: Item | undefined = useMemo(() => {
    if (!itemId) return undefined;
    return itemRepository.getById(itemId);
  }, [itemId, revision]);

  const todayYmd = todayYmdLocal();

  const purchaseCurrent = item ? getCurrentActiveRecord(item, "purchase", todayYmd) : undefined;
  const purchaseNext = item ? getNextScheduledRecord(item, "purchase", todayYmd) : undefined;
  const saleCurrent = item ? getCurrentActiveRecord(item, "sale", todayYmd) : undefined;
  const saleNext = item ? getNextScheduledRecord(item, "sale", todayYmd) : undefined;

  const rows = useMemo(() => {
    if (!item) return [];
    const built = buildPriceHistoryRows(item, todayYmd);
    if (filter === "all") return built;
    return built.filter((r) => r.priceType === filter);
  }, [item, filter, todayYmd]);

  const formatMoney = (n: number | undefined) =>
    formatNumber(n, { minFractionDigits: 2, maxFractionDigits: 2, empty: "—" });

  const reasonLabel = (code: string) =>
    t(`master.item.prices.reason_${code}` as "master.item.prices.reason_manual_update");

  const runApply = useCallback(
    async (
      payload: {
        priceType: ItemPriceType;
        amount: number;
        validFromYmd: string;
        reasonCode: ItemPriceReasonCode;
        comment?: string;
      },
      replaceConfirmed: boolean,
    ) => {
      if (!itemId) return;
      setBusy(true);
      try {
        const r = await applyItemPriceAwaitPersist(itemId, payload.priceType, {
          amount: payload.amount,
          validFromYmd: payload.validFromYmd,
          reasonCode: payload.reasonCode,
          comment: payload.comment,
          replaceScheduledConfirmed: replaceConfirmed,
        });
        if (!r.success) {
          if (r.needsReplaceScheduled) {
            setReplacePayload(payload);
            setReplaceOpen(true);
            return;
          }
          return;
        }
        setEditOpen(false);
        setReplaceOpen(false);
        setReplacePayload(null);
        onPricesChanged();
      } finally {
        setBusy(false);
      }
    },
    [itemId, onPricesChanged],
  );

  const openAdd = (pt: ItemPriceType) => {
    setFixedType(pt);
    setEditOpen(true);
  };

  if (isNew || !itemId) {
    return (
      <div
        data-testid="item-prices-unsaved-hint"
        className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-3 text-xs leading-snug text-muted-foreground"
      >
        {t("master.item.prices.unsavedHint")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{t("master.item.prices.tabIntro")}</p>

      <div
        data-testid="item-prices-summary-grid"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          dataTestId="item-prices-card-purchase-current"
          title={t("master.item.prices.summaryPurchaseCurrent")}
          roleHint={t("master.item.prices.summaryRoleCurrent")}
          record={purchaseCurrent}
          empty={t("master.item.prices.notSet")}
          emptyDetail={t("master.item.prices.notSetDetail")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          dataTestId="item-prices-card-purchase-next"
          title={t("master.item.prices.summaryPurchaseNext")}
          roleHint={t("master.item.prices.summaryRoleNext")}
          record={purchaseNext}
          empty={t("master.item.prices.notScheduled")}
          emptyDetail={t("master.item.prices.notScheduledDetail")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          dataTestId="item-prices-card-sale-current"
          title={t("master.item.prices.summarySaleCurrent")}
          roleHint={t("master.item.prices.summaryRoleCurrent")}
          record={saleCurrent}
          empty={t("master.item.prices.notSet")}
          emptyDetail={t("master.item.prices.notSetDetail")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          dataTestId="item-prices-card-sale-next"
          title={t("master.item.prices.summarySaleNext")}
          roleHint={t("master.item.prices.summaryRoleNext")}
          record={saleNext}
          empty={t("master.item.prices.notScheduled")}
          emptyDetail={t("master.item.prices.notScheduledDetail")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          data-testid="item-prices-add-purchase"
          onClick={() => openAdd("purchase")}
        >
          {t("master.item.prices.addPurchase")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          data-testid="item-prices-add-sale"
          onClick={() => openAdd("sale")}
        >
          {t("master.item.prices.addSale")}
        </Button>
        {purchaseNext && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={busy}
            data-testid="item-prices-cancel-scheduled-purchase"
            onClick={() => setCancelTarget({ recordId: purchaseNext.id, priceType: "purchase" })}
          >
            {t("master.item.prices.cancelScheduledPurchase")}
          </Button>
        )}
        {saleNext && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={busy}
            data-testid="item-prices-cancel-scheduled-sale"
            onClick={() => setCancelTarget({ recordId: saleNext.id, priceType: "sale" })}
          >
            {t("master.item.prices.cancelScheduledSale")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1" data-testid="item-prices-filter-row">
        {(["all", "purchase", "sale"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? t("master.item.prices.filterAll")
              : f === "purchase"
                ? t("master.item.prices.filterPurchase")
                : t("master.item.prices.filterSale")}
          </Button>
        ))}
      </div>

      <div className="border-t border-border/50 pt-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("master.item.prices.sectionHistory")}
          </h3>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card/20 shadow-sm">
          <table className="w-full min-w-[920px] table-fixed text-xs" data-testid="item-prices-history-table">
            <thead className="bg-muted/35 text-[11px]">
              <tr>
                <th className="w-[9%] px-2 py-2 text-left font-medium">{t("master.item.prices.colType")}</th>
                <th className="w-[11%] px-2 py-2 text-right font-semibold">{t("master.item.prices.colAmount")}</th>
                <th className="w-[10%] px-2 py-2 text-left font-medium">{t("master.item.prices.colValidFrom")}</th>
                <th className="w-[10%] px-2 py-2 text-left font-medium">{t("master.item.prices.colValidTo")}</th>
                <th className="w-[12%] px-2 py-2 text-left font-medium">{t("master.item.prices.colStatus")}</th>
                <th className="w-[14%] px-2 py-2 text-left font-medium">{t("master.item.prices.colReason")}</th>
                <th className="w-[18%] px-2 py-2 text-left font-medium">{t("master.item.prices.colComment")}</th>
                <th className="w-[10%] px-2 py-2 text-left font-medium">{t("master.item.prices.colCreated")}</th>
                <th className="w-[6%] px-2 py-2 text-right font-medium">{t("master.item.prices.colActions")}</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid="item-prices-history-row"
                  data-price-record-id={row.id}
                  className="border-t border-border/50"
                >
                  <td className="px-2 py-2 align-top">
                    {row.priceType === "purchase" ? t("master.item.prices.typePurchase") : t("master.item.prices.typeSale")}
                  </td>
                  <td className="px-2 py-2 text-right align-top text-sm font-semibold tabular-nums text-foreground">
                    {formatMoney(row.amount)}
                  </td>
                  <td className="px-2 py-2 align-top tabular-nums text-muted-foreground">{row.validFrom}</td>
                  <td className="px-2 py-2 align-top tabular-nums text-muted-foreground">{row.validTo ?? "—"}</td>
                  <td className="px-2 py-2 align-top">
                    <Badge
                      variant="outline"
                      className={cn("h-5 px-1.5 text-[10px] font-semibold leading-none", statusBadgeClasses(row.status))}
                    >
                      {t(statusLabelKey(row.status))}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 align-top leading-snug text-muted-foreground">{reasonLabel(row.reasonCode)}</td>
                  <td className="max-w-0 px-2 py-2 align-top leading-snug text-muted-foreground">
                    <span className="line-clamp-3 break-words" title={row.comment ?? undefined}>
                      {row.comment ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top text-[10px] tabular-nums text-muted-foreground">
                    {row.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-2 py-2 text-right align-top">
                    {row.status === "scheduled" && !row.cancelledAt ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        disabled={busy}
                        data-testid="item-prices-row-cancel-scheduled"
                        onClick={() => setCancelTarget({ recordId: row.id, priceType: row.priceType })}
                      >
                        {t("master.item.prices.actionCancel")}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ItemPriceEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        fixedPriceType={fixedType}
        busy={busy}
        onSubmit={(data) => void runApply(data, false)}
      />

      <Dialog.Root open={replaceOpen} onOpenChange={setReplaceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[132] bg-black/50" />
          <Dialog.Content
            data-testid="item-price-replace-dialog"
            className="fixed left-1/2 top-1/2 z-[133] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-4 shadow-lg"
          >
            <Dialog.Title className="text-sm font-semibold">{t("master.item.prices.replaceScheduledTitle")}</Dialog.Title>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("master.item.prices.replaceScheduledBody")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              <li>{t("master.item.prices.replaceScheduledBullet1")}</li>
              <li>{t("master.item.prices.replaceScheduledBullet2")}</li>
              <li>{t("master.item.prices.replaceScheduledBullet3")}</li>
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setReplaceOpen(false)}>
                {t("master.item.prices.dialogClose")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                data-testid="item-price-replace-confirm"
                disabled={busy || !replacePayload}
                onClick={() => replacePayload && void runApply(replacePayload, true)}
              >
                {t("master.item.prices.replaceScheduledConfirm")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[132] bg-black/50" />
          <Dialog.Content
            data-testid="item-price-cancel-dialog"
            className="fixed left-1/2 top-1/2 z-[133] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-4 shadow-lg"
          >
            <Dialog.Title className="text-sm font-semibold">{t("master.item.prices.cancelConfirmTitle")}</Dialog.Title>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("master.item.prices.cancelConfirmBody")}</p>
            <p className="mt-2 text-[11px] text-muted-foreground/90">{t("master.item.prices.cancelConfirmNote")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCancelTarget(null)}>
                {t("master.item.prices.dialogClose")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                data-testid="item-price-cancel-confirm"
                disabled={busy || !cancelTarget}
                onClick={async () => {
                  if (!cancelTarget || !itemId) return;
                  setBusy(true);
                  try {
                    await cancelScheduledItemPriceAwaitPersist(itemId, cancelTarget.recordId);
                    setCancelTarget(null);
                    onPricesChanged();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("master.item.prices.cancelConfirmAction")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SummaryCard({
  title,
  roleHint,
  record,
  empty,
  emptyDetail,
  formatMoney,
  reasonLabel,
  dataTestId,
}: {
  title: string;
  roleHint: string;
  record: ItemPriceRecord | undefined;
  empty: string;
  emptyDetail: string;
  formatMoney: (n: number | undefined) => string;
  reasonLabel: (c: string) => string;
  dataTestId?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "flex min-h-[7.5rem] flex-col rounded-lg border bg-card/30 p-3 shadow-sm",
        record ? "border-border/60" : "border-dashed border-border/60 bg-muted/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-primary/90">{roleHint}</div>
        </div>
      </div>
      {!record ? (
        <div className="mt-3 flex flex-1 flex-col justify-center">
          <div className="text-lg font-semibold tabular-nums text-muted-foreground">{empty}</div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">{emptyDetail}</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-1 flex-col">
          <div className="text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
            {formatMoney(record.amount)}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/75">
              {t("master.item.prices.summaryEffectiveFrom")}
            </span>
            <span className="ml-1 tabular-nums">{record.validFrom}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{reasonLabel(record.reasonCode)}</div>
          {record.comment ? (
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/85" title={record.comment}>
              {record.comment}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
