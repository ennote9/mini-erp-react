import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/shared/ui/list/BackButton";
import { DocumentPageLayout } from "@/shared/ui/object/DocumentPageLayout";
import { useTranslation } from "@/shared/i18n/context";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import type { Item } from "@/modules/items/model";
import type { MarkdownReasonCode } from "../model";
import { createMarkdownBatch } from "../service";
import { MARKDOWN_REASONS } from "../pageConfig";
import { Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WAREHOUSE_ID = "1";

function buildCancelTarget(itemId: string): string {
  if (!itemId) return "/markdown-journal";
  return `/markdown-journal?itemId=${encodeURIComponent(itemId)}`;
}

export function MarkdownCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";

  const [itemId, setItemId] = useState(prefillItemId);
  const [itemSearch, setItemSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState(DEFAULT_WAREHOUSE_ID);
  const [locationId, setLocationId] = useState("");
  const [reasonCode, setReasonCode] = useState<MarkdownReasonCode>("OTHER");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const warehouses = useMemo(
    () => warehouseRepository.list().filter((w) => w.isActive),
    [appRevision],
  );

  useEffect(() => {
    if (prefillItemId) {
      setItemId(prefillItemId);
    }
  }, [prefillItemId]);

  useEffect(() => {
    if (warehouses.length === 0) return;
    setWarehouseId((prev) =>
      warehouses.some((w) => w.id === prev) ? prev : warehouses[0].id,
    );
  }, [warehouses]);

  const selectedCreateItem = useMemo(
    () => (itemId ? itemRepository.getById(itemId) : undefined),
    [itemId, appRevision],
  );

  useEffect(() => {
    if (!selectedCreateItem) return;
    setItemSearch((prev) =>
      prev.trim() === "" ? `${selectedCreateItem.code} — ${selectedCreateItem.name}` : prev,
    );
  }, [selectedCreateItem]);

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

  const cancelTarget = useMemo(() => buildCancelTarget(prefillItemId), [prefillItemId]);

  const handleCancel = useCallback(() => {
    navigate(cancelTarget);
  }, [cancelTarget, navigate]);

  const handleCreate = useCallback(() => {
    setCreateError(null);
    const result = createMarkdownBatch({
      itemId: itemId.trim(),
      markdownPrice: Number(price),
      reasonCode,
      warehouseId: warehouseId.trim() || (warehouses[0]?.id ?? DEFAULT_WAREHOUSE_ID),
      locationId: locationId.trim() || undefined,
      quantity: Number(quantity),
      comment: comment.trim() || undefined,
    });

    if (!result.success) {
      setCreateError(result.error);
      return;
    }

    if (result.records[0]) {
      navigate(`/markdown-journal/${result.records[0].id}`);
    }
  }, [comment, itemId, locationId, navigate, price, quantity, reasonCode, warehouseId, warehouses]);

  const breadcrumbItems = useMemo(
    () => [
      { label: t("shell.inventory"), to: "/markdown-journal" },
      { label: t("shell.nav.markdownJournal"), to: "/markdown-journal" },
      { label: t("markdown.journal.createTitle") },
    ],
    [t],
  );

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to={cancelTarget} aria-label={t("markdown.journal.backToListAria")} />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{t("markdown.journal.createTitle")}</h2>
          </div>
          <div className="doc-header__right">
            <div className="doc-header__actions">
              <Button type="button" onClick={handleCreate}>
                <Save aria-hidden />
                {t("markdown.actions.create")}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X aria-hidden />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      <Card className="max-w-3xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("markdown.journal.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError ? (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {t("markdown.messages.createFailed", { message: createError })}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="markdown-item-search">{t("markdown.fields.itemSearch")}</Label>
              <Input
                id="markdown-item-search"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={t("markdown.fields.itemSearch")}
                aria-label={t("markdown.fields.itemSearch")}
              />
              {itemPickCandidates.length > 0 ? (
                <div className="max-h-40 overflow-auto rounded border border-border/60 bg-muted/20 text-xs">
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
                <div className="space-y-1.5">
                  <Label htmlFor="markdown-item-id">{t("markdown.fields.itemId")}</Label>
                  <Input
                    id="markdown-item-id"
                    className="font-mono text-sm"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    placeholder={t("markdown.fields.itemId")}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-price">{t("markdown.fields.markdownPrice")}</Label>
              <Input
                id="markdown-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-quantity">{t("markdown.fields.quantity")}</Label>
              <Input
                id="markdown-quantity"
                type="number"
                min={1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-warehouse">{t("markdown.fields.warehouse")}</Label>
              {warehouses.length > 0 ? (
                <select
                  id="markdown-warehouse"
                  className={cn(
                    "flex h-9 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  )}
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
                <Input
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  placeholder={t("markdown.fields.warehouse")}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-location">{t("markdown.fields.location")}</Label>
              <Input
                id="markdown-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder={t("markdown.fields.location")}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="markdown-reason">{t("markdown.fields.reason")}</Label>
              <select
                id="markdown-reason"
                className={cn(
                  "flex h-9 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                )}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as MarkdownReasonCode)}
              >
                {MARKDOWN_REASONS.map((x) => (
                  <option key={x} value={x}>
                    {t(`markdown.reason.${x}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="markdown-comment">{t("common.description")}</Label>
              <Textarea
                id="markdown-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("common.optional")}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </DocumentPageLayout>
  );
}
