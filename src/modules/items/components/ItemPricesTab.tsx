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
        className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] leading-snug text-muted-foreground"
      >
        {t("master.item.prices.unsavedHint")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">{t("master.item.prices.tabIntro")}</p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={t("master.item.prices.summaryPurchaseCurrent")}
          record={purchaseCurrent}
          empty={t("master.item.prices.notSet")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          title={t("master.item.prices.summaryPurchaseNext")}
          record={purchaseNext}
          empty={t("master.item.prices.notScheduled")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          title={t("master.item.prices.summarySaleCurrent")}
          record={saleCurrent}
          empty={t("master.item.prices.notSet")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
        <SummaryCard
          title={t("master.item.prices.summarySaleNext")}
          record={saleNext}
          empty={t("master.item.prices.notScheduled")}
          formatMoney={formatMoney}
          reasonLabel={reasonLabel}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => openAdd("purchase")}>
          {t("master.item.prices.addPurchase")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => openAdd("sale")}>
          {t("master.item.prices.addSale")}
        </Button>
        {purchaseNext && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={() => setCancelTarget({ recordId: purchaseNext.id, priceType: "purchase" })}
          >
            {t("master.item.prices.cancelScheduledPurchase")}
          </Button>
        )}
        {saleNext && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={() => setCancelTarget({ recordId: saleNext.id, priceType: "sale" })}
          >
            {t("master.item.prices.cancelScheduledSale")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
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

      <div className="overflow-x-auto rounded border border-border/70">
        <table className="w-full min-w-[880px] text-[11px]">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colType")}</th>
              <th className="px-2 py-1 text-right font-medium">{t("master.item.prices.colAmount")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colValidFrom")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colValidTo")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colStatus")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colReason")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colComment")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colCreated")}</th>
              <th className="px-2 py-1 text-left font-medium">{t("master.item.prices.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border/60">
                <td className="px-2 py-1">
                  {row.priceType === "purchase" ? t("master.item.prices.typePurchase") : t("master.item.prices.typeSale")}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{formatMoney(row.amount)}</td>
                <td className="px-2 py-1">{row.validFrom}</td>
                <td className="px-2 py-1">{row.validTo ?? "—"}</td>
                <td className="px-2 py-1">{t(statusLabelKey(row.status))}</td>
                <td className="px-2 py-1">{reasonLabel(row.reasonCode)}</td>
                <td className="px-2 py-1 text-muted-foreground">{row.comment ?? "—"}</td>
                <td className="px-2 py-1 text-muted-foreground">{row.createdAt.slice(0, 19).replace("T", " ")}</td>
                <td className="px-2 py-1">
                  {row.status === "scheduled" && !row.cancelledAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      disabled={busy}
                      onClick={() => setCancelTarget({ recordId: row.id, priceType: row.priceType })}
                    >
                      {t("master.item.prices.actionCancel")}
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[133] w-[min(100vw-1.5rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-3 shadow-lg">
            <Dialog.Title className="text-sm font-semibold">{t("master.item.prices.replaceScheduledTitle")}</Dialog.Title>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("master.item.prices.replaceScheduledBody")}</p>
            <div className="mt-2 flex justify-end gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReplaceOpen(false)}>
                {t("master.item.prices.dialogClose")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
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
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[133] w-[min(100vw-1.5rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-3 shadow-lg">
            <Dialog.Title className="text-sm font-semibold">{t("master.item.prices.cancelConfirmTitle")}</Dialog.Title>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("master.item.prices.cancelConfirmBody")}</p>
            <div className="mt-2 flex justify-end gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCancelTarget(null)}>
                {t("master.item.prices.dialogClose")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
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
  record,
  empty,
  formatMoney,
  reasonLabel,
}: {
  title: string;
  record: ItemPriceRecord | undefined;
  empty: string;
  formatMoney: (n: number | undefined) => string;
  reasonLabel: (c: string) => string;
}) {
  return (
    <div className={cn("rounded-md border border-border/60 bg-muted/10 p-2")}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {!record ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{empty}</div>
      ) : (
        <div className="mt-1 space-y-0.5 text-[11px]">
          <div className="tabular-nums text-foreground">{formatMoney(record.amount)}</div>
          <div className="text-muted-foreground">{record.validFrom}</div>
          <div className="text-muted-foreground">{reasonLabel(record.reasonCode)}</div>
          {record.comment ? <div className="text-muted-foreground">{record.comment}</div> : null}
        </div>
      )}
    </div>
  );
}
