import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { markdownRepository } from "../repository";
import { createMarkdownBatch } from "../service";
import type { MarkdownReasonCode, MarkdownStatus } from "../model";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { cn } from "@/lib/utils";
import type { Item } from "@/modules/items/model";

const REASONS: MarkdownReasonCode[] = [
  "DAMAGED_PACKAGING",
  "EXPIRED_SOON",
  "FOUND_OLD_MARKDOWN",
  "DISPLAY_WEAR",
  "NO_LONGER_SELLABLE_AS_REGULAR",
  "OTHER",
];

const STATUSES: Array<MarkdownStatus | "all"> = [
  "all",
  "ACTIVE",
  "SOLD",
  "CANCELLED",
  "WRITTEN_OFF",
  "SUPERSEDED",
];

function parseIsoDatePrefix(iso: string): string {
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

function inCreatedRange(iso: string, from: string, to: string): boolean {
  const day = parseIsoDatePrefix(iso);
  if (!day) return true;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function MarkdownJournalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";

  const [itemId, setItemId] = useState(prefillItemId);
  const [itemSearch, setItemSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("1");
  const [locationId, setLocationId] = useState("");
  const [reasonCode, setReasonCode] = useState<MarkdownReasonCode>("OTHER");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<MarkdownStatus | "all">("all");
  const [filterReason, setFilterReason] = useState<MarkdownReasonCode | "all">("all");
  const [filterWarehouseId, setFilterWarehouseId] = useState<string | "all">("all");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  useEffect(() => {
    if (prefillItemId) setItemId(prefillItemId);
  }, [prefillItemId]);

  const warehouses = useMemo(() => warehouseRepository.list().filter((w) => w.isActive), [appRevision]);

  useEffect(() => {
    if (warehouses.length === 0) return;
    setWarehouseId((prev) => (warehouses.some((w) => w.id === prev) ? prev : warehouses[0].id));
  }, [warehouses]);

  const itemPickCandidates = useMemo((): Item[] => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [];
    return itemRepository
      .list()
      .filter(
        (it) =>
          it.code.toLowerCase().includes(q) ||
          it.name.toLowerCase().includes(q) ||
          it.id === q,
      )
      .slice(0, 12);
  }, [itemSearch, appRevision]);

  const selectedCreateItem = itemId ? itemRepository.getById(itemId) : undefined;

  const allRows = useMemo(() => markdownRepository.list(), [appRevision]);

  const rows = useMemo(() => {
    let base = allRows;
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((x) => x.markdownCode.toLowerCase().includes(q));
    }
    if (prefillItemId) {
      base = base.filter((x) => x.itemId === prefillItemId);
    }
    if (filterStatus !== "all") {
      base = base.filter((x) => x.status === filterStatus);
    }
    if (filterReason !== "all") {
      base = base.filter((x) => x.reasonCode === filterReason);
    }
    if (filterWarehouseId !== "all") {
      base = base.filter((x) => x.warehouseId === filterWarehouseId);
    }
    const locQ = filterLocation.trim().toLowerCase();
    if (locQ) {
      base = base.filter((x) => (x.locationId ?? "").toLowerCase().includes(locQ));
    }
    const fi = filterItem.trim().toLowerCase();
    if (fi) {
      base = base.filter((x) => {
        const it = itemRepository.getById(x.itemId);
        if (!it) return x.itemId.toLowerCase().includes(fi);
        return (
          it.code.toLowerCase().includes(fi) ||
          it.name.toLowerCase().includes(fi) ||
          x.itemId.toLowerCase().includes(fi)
        );
      });
    }
    if (createdFrom || createdTo) {
      base = base.filter((x) => inCreatedRange(x.createdAt, createdFrom, createdTo));
    }
    return base.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [
    allRows,
    search,
    prefillItemId,
    filterStatus,
    filterReason,
    filterWarehouseId,
    filterLocation,
    filterItem,
    createdFrom,
    createdTo,
  ]);

  return (
    <div className="doc-page space-y-3">
      <div className="rounded-md border border-border/70 p-3">
        <div className="mb-2 text-sm font-medium">{t("markdown.journal.createTitle")}</div>
        {createError ? (
          <div
            className="mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {t("markdown.messages.createFailed", { message: createError })}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3 space-y-1">
            <Input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder={t("markdown.fields.itemSearch")}
              aria-label={t("markdown.fields.itemSearch")}
            />
            {itemPickCandidates.length > 0 ? (
              <div className="max-h-32 overflow-auto rounded border border-border/60 bg-muted/20 text-xs">
                {itemPickCandidates.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-accent/50"
                    onClick={() => {
                      setItemId(it.id);
                      setItemSearch(`${it.code} — ${it.name}`);
                    }}
                  >
                    <span className="font-mono tabular-nums">{it.code}</span>
                    <span className="ml-2 min-w-0 truncate">{it.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedCreateItem ? (
              <div className="text-xs text-muted-foreground">
                {t("markdown.fields.selectedItem")}:{" "}
                <span className="text-foreground">
                  {selectedCreateItem.code} — {selectedCreateItem.name}
                </span>{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setItemId("");
                    setItemSearch("");
                  }}
                >
                  {t("markdown.fields.clearItem")}
                </button>
              </div>
            ) : (
              <Input
                className="font-mono text-xs"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder={t("markdown.fields.itemId")}
              />
            )}
          </div>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("markdown.fields.markdownPrice")} />
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("markdown.fields.quantity")} />
          {warehouses.length > 0 ? (
            <select
              className="h-8 rounded border border-input bg-background px-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-label={t("markdown.fields.warehouse")}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          ) : (
            <Input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} placeholder={t("markdown.fields.warehouse")} />
          )}
          <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder={t("markdown.fields.location")} />
          <select
            className="h-8 rounded border border-input bg-background px-2 text-sm"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as MarkdownReasonCode)}
          >
            {REASONS.map((x) => (
              <option key={x} value={x}>
                {t(`markdown.reason.${x}`)}
              </option>
            ))}
          </select>
          <Input className="sm:col-span-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("common.description")} />
          <Button
            type="button"
            onClick={() => {
              setCreateError(null);
              const result = createMarkdownBatch({
                itemId: itemId.trim(),
                markdownPrice: Number(price),
                reasonCode,
                warehouseId: warehouseId.trim() || (warehouses[0]?.id ?? "1"),
                locationId: locationId.trim() || undefined,
                quantity: Number(quantity),
                comment: comment.trim() || undefined,
              });
              if (!result.success) {
                setCreateError(result.error);
                return;
              }
              if (result.records[0]) navigate(`/markdown-journal/${result.records[0].id}`);
            }}
          >
            {t("markdown.actions.create")}
          </Button>
        </div>
      </div>
      <div className="rounded-md border border-border/70 p-3">
        <div className="mb-2 text-sm font-medium">{t("markdown.journal.filtersTitle")}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("markdown.filters.searchCode")} />
          <Input value={filterItem} onChange={(e) => setFilterItem(e.target.value)} placeholder={t("markdown.filters.item")} />
          <select
            className="h-8 rounded border border-input bg-background px-2 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MarkdownStatus | "all")}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? t("markdown.filters.allStatuses") : t(`markdown.status.${s}`)}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded border border-input bg-background px-2 text-sm"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value as MarkdownReasonCode | "all")}
          >
            <option value="all">{t("markdown.filters.allReasons")}</option>
            {REASONS.map((x) => (
              <option key={x} value={x}>
                {t(`markdown.reason.${x}`)}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded border border-input bg-background px-2 text-sm"
            value={filterWarehouseId}
            onChange={(e) => setFilterWarehouseId(e.target.value as string | "all")}
          >
            <option value="all">{t("markdown.filters.allWarehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <Input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder={t("markdown.filters.location")} />
          <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} aria-label={t("markdown.filters.createdFrom")} />
          <Input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} aria-label={t("markdown.filters.createdTo")} />
        </div>
      </div>
      <div className="rounded-md border border-border/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{t("markdown.journal.title")}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length} / {allRows.length}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-2 py-1 text-left">{t("markdown.fields.markdownCode")}</th>
                <th className="px-2 py-1 text-left">{t("common.item")}</th>
                <th className="px-2 py-1 text-left">{t("common.status")}</th>
                <th className="px-2 py-1 text-left">{t("markdown.fields.markdownPrice")}</th>
                <th className="px-2 py-1 text-left">{t("markdown.fields.reason")}</th>
                <th className="px-2 py-1 text-left">{t("common.warehouse")}</th>
                <th className="px-2 py-1 text-left">{t("markdown.fields.location")}</th>
                <th className="px-2 py-1 text-left">{t("markdown.fields.createdAt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const it = itemRepository.getById(r.itemId);
                const wh = warehouseRepository.getById(r.warehouseId);
                return (
                  <tr
                    key={r.id}
                    className={cn("border-t border-border/60 cursor-pointer hover:bg-muted/20")}
                    onClick={() => navigate(`/markdown-journal/${r.id}`)}
                  >
                    <td className="px-2 py-1 font-mono tabular-nums">{r.markdownCode}</td>
                    <td className="px-2 py-1">{it ? `${it.code} — ${it.name}` : r.itemId}</td>
                    <td className="px-2 py-1">{t(`markdown.status.${r.status}`)}</td>
                    <td className="px-2 py-1">{r.markdownPrice.toFixed(2)}</td>
                    <td className="px-2 py-1">{t(`markdown.reason.${r.reasonCode}`)}</td>
                    <td className="px-2 py-1">{wh ? `${wh.code}` : r.warehouseId}</td>
                    <td className="px-2 py-1">{r.locationId ?? "—"}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.createdAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
