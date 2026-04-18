import { useCallback, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { functionalUpdate, type SortingState } from "@tanstack/react-table";
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
import { ItemPriceHistoryTanstackTable } from "../ItemPriceHistoryTanstackTable";
import { ItemsHeaderFilterPanel } from "../ItemsHeaderFilterPanel";
import { buildItemPriceHistoryTableSchema } from "../itemPriceHistoryTableSchema";
import {
  buildItemPriceHistoryFieldRegistry,
  buildItemPriceHistoryFilterConfigs,
} from "../itemPriceHistoryFieldRegistry";
import {
  applyDeepSortModel,
  buildListViewColumnFilterModelFromDeepRules,
  normalizeDeepFilterRules,
  type ListViewDeepFilterRule,
} from "@/shared/ui/list-view/listViewConfig";
import { applyListViewColumnFilters, type ListViewColumnFilterConfig } from "@/shared/ui/list-view";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { cn } from "@/lib/utils";

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
  const { t, locale } = useTranslation();
  const { formatNumber } = useAppDisplayFormatters();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deepFilterRules, setDeepFilterRules] = useState<ListViewDeepFilterRule[]>([]);
  const [headerFilterAnchor, setHeaderFilterAnchor] = useState<{
    fieldId: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
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

  const priceHistorySchema = useMemo(() => buildItemPriceHistoryTableSchema(t), [t, locale]);
  const priceHistoryRegistry = useMemo(() => buildItemPriceHistoryFieldRegistry(t), [t, locale]);
  const priceHistoryFilterConfigs = useMemo(() => buildItemPriceHistoryFilterConfigs(t), [t, locale]);

  const registryByFieldKey = useMemo(
    () => new Map(priceHistoryRegistry.map((e) => [e.fieldKey, e])),
    [priceHistoryRegistry],
  );

  const baseHistoryRows = useMemo(() => {
    if (!item) return [];
    return buildPriceHistoryRows(item, todayYmd);
  }, [item, todayYmd]);

  const normalizedFilterRules = useMemo(
    () => normalizeDeepFilterRules({ rules: deepFilterRules, registry: priceHistoryRegistry }),
    [deepFilterRules, priceHistoryRegistry],
  );

  const columnFilterModel = useMemo(
    () => buildListViewColumnFilterModelFromDeepRules(normalizedFilterRules),
    [normalizedFilterRules],
  );

  const filteredHistoryRows = useMemo(
    () => applyListViewColumnFilters(baseHistoryRows, columnFilterModel, priceHistoryFilterConfigs),
    [baseHistoryRows, columnFilterModel, priceHistoryFilterConfigs],
  );

  const getHistoryFieldValue = useCallback(
    (row: PriceHistoryRow, fieldKey: string) => {
      const cfg = priceHistoryFilterConfigs[fieldKey];
      if (cfg?.getValue) return cfg.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [priceHistoryFilterConfigs],
  );

  const displayHistoryRows = useMemo(() => {
    const sortModel = sorting.map((s) => ({ colId: s.id, sort: s.desc ? ("desc" as const) : ("asc" as const) }));
    return applyDeepSortModel({
      rows: filteredHistoryRows,
      sortModel,
      getFieldValue: getHistoryFieldValue,
    });
  }, [filteredHistoryRows, sorting, getHistoryFieldValue]);

  const activeHeaderFilterFieldState = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const r of normalizedFilterRules) {
      if (r.enabled !== false) m[r.fieldKey] = true;
    }
    return m;
  }, [normalizedFilterRules]);

  const activeHeaderFilterField = headerFilterAnchor?.fieldId ?? null;
  const activeHeaderFilterRegistryField = activeHeaderFilterField
    ? registryByFieldKey.get(activeHeaderFilterField) ?? null
    : null;
  const activeHeaderFilterRule = activeHeaderFilterField
    ? normalizedFilterRules.find((r) => r.fieldKey === activeHeaderFilterField && r.enabled !== false) ?? null
    : null;
  const activeHeaderFilterConfig =
    activeHeaderFilterField != null ? priceHistoryFilterConfigs[activeHeaderFilterField] : undefined;

  const handleHeaderFilterApply = useCallback(
    (rule: ListViewDeepFilterRule) => {
      setDeepFilterRules((prev) => {
        const others = prev.filter((r) => r.fieldKey !== rule.fieldKey);
        return normalizeDeepFilterRules({
          rules: [...others, { ...rule, enabled: true, priority: others.length }],
          registry: priceHistoryRegistry,
        });
      });
      setHeaderFilterAnchor(null);
    },
    [priceHistoryRegistry],
  );

  const handleHeaderFilterReset = useCallback(() => {
    const field = headerFilterAnchor?.fieldId;
    if (!field) return;
    setDeepFilterRules((prev) => prev.filter((r) => r.fieldKey !== field));
    setHeaderFilterAnchor(null);
  }, [headerFilterAnchor?.fieldId]);

  const handleTanstackSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting((old) => functionalUpdate(updater, old));
    },
    [],
  );

  const statusLabelForRow = useCallback(
    (status: PriceHistoryRow["status"]) => t(statusLabelKey(status)),
    [t],
  );

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

      <div className="border-t border-border/50 pt-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("master.item.prices.sectionHistory")}
          </h3>
        </div>

        <div className="relative">
          <ItemPriceHistoryTanstackTable
            rows={displayHistoryRows}
            schema={priceHistorySchema}
            sorting={sorting}
            onSortingChange={handleTanstackSortingChange}
            onHeaderFilterClick={(fieldId, anchorRect) => setHeaderFilterAnchor({ fieldId, ...anchorRect })}
            headerFilterState={activeHeaderFilterFieldState}
            openHeaderFilterFieldId={activeHeaderFilterField}
            t={t}
            formatMoney={formatMoney}
            reasonLabel={reasonLabel}
            statusLabel={statusLabelForRow}
            busy={busy}
            onCancelScheduled={(row) => setCancelTarget({ recordId: row.id, priceType: row.priceType })}
          />
          <ItemsHeaderFilterPanel
            open={headerFilterAnchor != null}
            anchorRect={
              headerFilterAnchor
                ? {
                    left: headerFilterAnchor.left,
                    top: headerFilterAnchor.top,
                    width: headerFilterAnchor.width,
                    height: headerFilterAnchor.height,
                  }
                : null
            }
            field={activeHeaderFilterRegistryField}
            filterConfig={activeHeaderFilterConfig as ListViewColumnFilterConfig<unknown> | undefined}
            rule={activeHeaderFilterRule}
            onOpenChange={(open) => {
              if (!open) setHeaderFilterAnchor(null);
            }}
            onApply={handleHeaderFilterApply}
            onReset={handleHeaderFilterReset}
          />
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
