import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";
import { brandRepository } from "../repository";
import { saveBrand } from "../service";
import { itemRepository } from "../../items/repository";
import { categoryRepository } from "../../categories/repository";
import type { Item } from "../../items/model";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  actionIssueFromServiceMessage,
  combineIssues,
  hasErrors,
  hasWarnings,
  issueListContainsMessage,
  type Issue,
} from "../../../shared/issues";
import { getBrandFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import {
  MasterStockBalancesBlock,
  MasterStockMovementsBlock,
  useAppReadModelRevision,
} from "@/shared/inventoryMasterPageBlocks";
import {
  buildAggregatedWarehouseBalancesForItemIds,
  buildRecentScopedMovementsForItemIds,
} from "@/shared/masterInventoryByItemScope";
import {
  ITEM_RECENT_MOVEMENTS_LIMIT,
  summarizeItemPageBalances,
} from "../../items/itemInventoryRelated";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  comment: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    comment: "",
  };
}

function itemImageCount(item: Item): number {
  return Array.isArray(item.images) ? item.images.length : 0;
}

function RelatedItemsImagesCell({ item }: { item: Item }) {
  const { t } = useTranslation();
  const n = itemImageCount(item);
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">{t("domain.audit.summary.emDash")}</span>;
  }
  return <span className="tabular-nums text-foreground/90">{n}</span>;
}

export function BrandPage() {
  const { t, locale } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const brand = useMemo(
    () => (id && !isNew ? brandRepository.getById(id) : undefined),
    [id, isNew],
  );

  const appReadModelRevision = useAppReadModelRevision();

  const relatedItems = useMemo(() => {
    if (!brand?.id) return [];
    return itemRepository
      .list()
      .filter((item) => item.brandId === brand.id)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: "base" }));
  }, [brand?.id, appReadModelRevision]);

  const relatedSummary = useMemo(() => {
    const total = relatedItems.length;
    const active = relatedItems.filter((x) => x.isActive).length;
    return { total, active, inactive: total - active };
  }, [relatedItems]);

  const itemIdsForInventory = useMemo(
    () => new Set(relatedItems.map((i) => i.id)),
    [relatedItems],
  );

  const brandBalanceRows = useMemo(
    () => buildAggregatedWarehouseBalancesForItemIds(itemIdsForInventory),
    [itemIdsForInventory, appReadModelRevision],
  );

  const brandBalanceSummary = useMemo(
    () => summarizeItemPageBalances(brandBalanceRows),
    [brandBalanceRows],
  );

  const brandMovementRows = useMemo(
    () =>
      buildRecentScopedMovementsForItemIds(
        itemIdsForInventory,
        t,
        ITEM_RECENT_MOVEMENTS_LIMIT,
      ),
    [itemIdsForInventory, t, locale, appReadModelRevision],
  );

  const movementTypeLabel = useCallback(
    (code: string) => {
      const translated = t(`ops.stockMovements.types.${code}`);
      return translated === code ? code : translated;
    },
    [t],
  );

  const openStockBalancesForBrand = useCallback(() => {
    if (!brand?.id) return;
    navigate(`/stock-balances?brandId=${encodeURIComponent(brand.id)}`);
  }, [brand?.id, navigate]);

  const openStockBalancesForBrandWarehouse = useCallback(
    (row: { warehouseId: string }) => {
      if (!brand?.id) return;
      navigate(
        `/stock-balances?brandId=${encodeURIComponent(brand.id)}&warehouseId=${encodeURIComponent(row.warehouseId)}`,
      );
    },
    [brand?.id, navigate],
  );

  const openStockMovementsForBrand = useCallback(() => {
    if (!brand?.id) return;
    navigate(`/stock-movements?brandId=${encodeURIComponent(brand.id)}`);
  }, [brand?.id, navigate]);

  const openStockMovementsForBrandRow = useCallback(
    (row: { warehouseId: string; itemId: string }) => {
      if (!brand?.id) return;
      navigate(
        `/stock-movements?brandId=${encodeURIComponent(brand.id)}&warehouseId=${encodeURIComponent(row.warehouseId)}&itemId=${encodeURIComponent(row.itemId)}`,
      );
    },
    [brand?.id, navigate],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getBrandFormHealth({
        code: form.code,
        name: form.name,
      }),
    [form.code, form.name],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (brand) {
      setForm({
        code: brand.code,
        name: brand.name,
        isActive: brand.isActive,
        comment: brand.comment ?? "",
      });
    }
  }, [id, isNew, brand?.id, brand?.code, brand?.name, brand?.isActive, brand?.comment]);

  const handleSave = () => {
    setActionIssues([]);
    const result = saveBrand(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        comment: form.comment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/brands");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/brands");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.brand.notFound")}</p>
      </div>
    );
  }

  if (!isNew && !brand) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.brand.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/brands" },
    { label: t("master.brand.listBreadcrumb"), to: "/brands" },
    { label: isNew ? t("master.common.newLabel") : brand!.code },
  ];

  const displayTitle = isNew ? t("master.brand.titleNew") : t("master.brand.titleWithCode", { code: brand!.code });

  const em = t("domain.audit.summary.emDash");

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/brands" aria-label={t("master.brand.backToListAria")} />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
          </div>
          <div className="doc-header__right">
            {(hasErrors(combinedIssues) || hasWarnings(combinedIssues)) && (
              <DocumentIssueStrip issues={combinedIssues} />
            )}
            <div className="doc-header__actions">
              <Button type="button" onClick={handleSave}>
                <Save aria-hidden />
                {t("common.save")}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X aria-hidden />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">{t("master.common.detailsTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("master.brand.detailsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="brand-code" className="text-sm">
                {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="brand-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t("master.brand.codePlaceholderAlt")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="brand-name" className="text-sm">
                {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="brand-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("master.brand.namePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="brand-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              <Label
                htmlFor="brand-active"
                className="cursor-pointer text-sm font-normal"
              >
                {t("ops.master.activeCell.active")}
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="brand-comment" className="text-sm">{t("doc.columns.comment")}</Label>
              <Textarea
                id="brand-comment"
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
                placeholder={t("common.optional")}
                rows={2}
                className="resize-none min-h-[4.5rem] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && brand ? (
        <>
        <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
          <CardHeader className="p-2 pb-0.5 space-y-0">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
              <div className="min-w-0 space-y-0.5 flex-1">
                <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                  {t("master.related.itemsTitle")}
                </CardTitle>
                <CardDescription className="text-xs leading-snug">
                  {t("master.related.itemsHint")}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={() =>
                  navigate(`/items?brandId=${encodeURIComponent(brand.id)}`)
                }
              >
                {t("master.related.openAllItems")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-1 space-y-2">
            <div
              className="flex flex-wrap gap-1.5"
              aria-label={t("master.related.summaryAria")}
            >
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("master.related.chipItems")}</span>
                <span className="font-medium text-foreground/90">{relatedSummary.total}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("master.related.chipActive")}</span>
                <span className="font-medium text-foreground/90">{relatedSummary.active}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("master.related.chipInactive")}</span>
                <span className="font-medium text-foreground/90">{relatedSummary.inactive}</span>
              </span>
            </div>
            {relatedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 m-0">
                {t("master.related.emptyBrand")}
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                <table className="list-table text-sm">
                  <thead>
                    <tr>
                      <th className="list-table__cell--code">{t("master.related.colCode")}</th>
                      <th className="list-table__cell--name">{t("master.related.colName")}</th>
                      <th className="min-w-[100px]">{t("master.related.colCategory")}</th>
                      <th className="w-16 text-right whitespace-nowrap">{t("master.related.colImages")}</th>
                      <th className="list-table__cell--active">{t("master.related.colActive")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedItems.map((item) => {
                      const catName =
                        item.categoryId != null && item.categoryId !== ""
                          ? categoryRepository.getById(item.categoryId)?.name ?? em
                          : em;
                      return (
                        <tr
                          key={item.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/items/${item.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={t("master.related.openItemAria", { code: item.code })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/items/${item.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-mono text-xs">{item.code}</td>
                          <td className="list-table__cell--name">{item.name}</td>
                          <td className="text-muted-foreground">{catName}</td>
                          <td className="text-right">
                            <RelatedItemsImagesCell item={item} />
                          </td>
                          <td className="list-table__cell--active">
                            <span
                              className={
                                item.isActive
                                  ? "status-plain-text status-plain-text--active"
                                  : "status-plain-text status-plain-text--inactive"
                              }
                            >
                              {item.isActive
                                ? t("ops.master.activeCell.active")
                                : t("ops.master.activeCell.inactive")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <MasterStockBalancesBlock
          labels={{
            title: t("master.brand.relatedStockBalancesTitle"),
            description: t("master.brand.relatedStockBalancesHint"),
            openAll: t("master.brand.openAllStockBalances"),
            summaryAria: t("master.brand.relatedStockBalancesSummaryAria"),
            empty: t("master.brand.emptyRelatedStockBalances"),
          }}
          summary={brandBalanceSummary}
          rows={brandBalanceRows}
          onOpenAll={openStockBalancesForBrand}
          onBalanceRowClick={openStockBalancesForBrandWarehouse}
          rowAriaLabel={(row) =>
            t("master.brand.openStockBalancesListRowAria", { warehouse: row.warehouseName })
          }
        />

        <MasterStockMovementsBlock
          variant="scoped"
          labels={{
            title: t("master.brand.relatedStockMovementsTitle"),
            description: t("master.brand.relatedStockMovementsHint", {
              limit: ITEM_RECENT_MOVEMENTS_LIMIT,
            }),
            openAll: t("master.brand.openAllStockMovements"),
            empty: t("master.brand.emptyRelatedStockMovements"),
          }}
          rows={brandMovementRows}
          onOpenAll={openStockMovementsForBrand}
          onMovementRowClick={openStockMovementsForBrandRow}
          movementTypeLabel={movementTypeLabel}
          rowAriaLabel={(row) =>
            t("master.brand.openStockMovementsListRowAria", {
              item: row.itemCode,
              warehouse: row.warehouseName,
            })
          }
        />
        </>
      ) : null}
    </div>
  );
}
