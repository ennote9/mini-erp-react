import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";
import { itemRepository } from "../repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { nextTesterCodeForBaseItem, saveItemAwaitPersist } from "../service";
import { bridgeLegacyBarcodeValueFromCollection } from "../lib/itemBarcodes";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tabs } from "radix-ui";
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
import { getItemFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { ItemImagesCard } from "../components/ItemImagesCard";
import { ItemBarcodesCard } from "../components/ItemBarcodesCard";
import { markdownRepository } from "@/modules/markdown-journal";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";

type FormState = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description: string;
  brandId: string;
  categoryId: string;
  purchasePrice: string;
  salePrice: string;
  baseItemId: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    uom: "",
    isActive: true,
    description: "",
    brandId: "",
    categoryId: "",
    purchasePrice: "",
    salePrice: "",
    baseItemId: "",
  };
}

export function ItemPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [imagesRevision, setImagesRevision] = useState(0);
  const [barcodesRevision, setBarcodesRevision] = useState(0);
  const requestedKind = (searchParams.get("kind") ?? "").toUpperCase();
  const requestedBaseItemId = searchParams.get("baseItemId") ?? "";
  const isValidCreateKind = requestedKind === "SELLABLE" || requestedKind === "TESTER";
  const item = useMemo(
    () => (id && !isNew ? itemRepository.getById(id) : undefined),
    [id, isNew, imagesRevision, barcodesRevision],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getItemFormHealth({
        code: form.code,
        name: form.name,
        uom: form.uom,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
      }),
    [form.code, form.name, form.uom, form.purchasePrice, form.salePrice],
  );

  const brandOptions = useMemo(() => {
    const active = brandRepository.list().filter((b) => b.isActive);
    const currentId = form.brandId;
    if (!currentId) return active;
    const current = brandRepository.getById(currentId);
    if (current && !current.isActive && !active.some((b) => b.id === currentId)) {
      return [current, ...active];
    }
    return active;
  }, [form.brandId]);

  const categoryOptions = useMemo(() => {
    const active = categoryRepository.list().filter((c) => c.isActive);
    const currentId = form.categoryId;
    if (!currentId) return active;
    const current = categoryRepository.getById(currentId);
    if (current && !current.isActive && !active.some((c) => c.id === currentId)) {
      return [current, ...active];
    }
    return active;
  }, [form.categoryId]);

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name, form.uom, form.purchasePrice, form.salePrice]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  const barcodeMainSummary = useMemo(() => {
    if (isNew || !item) return null;
    const list = item.barcodes ?? [];
    const count = list.length;
    const primary = bridgeLegacyBarcodeValueFromCollection(list);
    return { count, primary };
  }, [isNew, item, barcodesRevision]);

  useEffect(() => {
    if (isNew) {
      if (requestedKind === "TESTER" && requestedBaseItemId) {
        const base = itemRepository.getById(requestedBaseItemId);
        if (base && base.itemKind === "SELLABLE") {
          const suggested = nextTesterCodeForBaseItem(base.id);
          setForm({
            code: suggested ?? "",
            name: base.name,
            uom: base.uom,
            isActive: true,
            description: base.description ?? "",
            brandId: base.brandId ?? "",
            categoryId: base.categoryId ?? "",
            purchasePrice: base.purchasePrice !== undefined ? String(base.purchasePrice) : "",
            salePrice: base.salePrice !== undefined ? String(base.salePrice) : "",
            baseItemId: base.id,
          });
          return;
        }
      }
      setForm(defaultForm());
      return;
    }
    if (item) {
      setForm({
        code: item.code,
        name: item.name,
        uom: item.uom,
        isActive: item.isActive,
        description: item.description ?? "",
        brandId: item.brandId ?? "",
        categoryId: item.categoryId ?? "",
        purchasePrice: item.purchasePrice !== undefined ? String(item.purchasePrice) : "",
        salePrice: item.salePrice !== undefined ? String(item.salePrice) : "",
        baseItemId: item.baseItemId ?? "",
      });
    }
  }, [
    id,
    isNew,
    item?.id,
    item?.code,
    item?.name,
    item?.uom,
    item?.isActive,
    item?.description,
    item?.brandId,
    item?.categoryId,
    item?.purchasePrice,
    item?.salePrice,
    requestedKind,
    requestedBaseItemId,
  ]);

  const parsePrice = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setActionIssues([]);
    void (async () => {
      const itemKindForSave: "SELLABLE" | "TESTER" = isNew
        ? requestedKind === "TESTER"
          ? "TESTER"
          : "SELLABLE"
        : item!.itemKind;
      const baseItemIdForSave =
        itemKindForSave === "TESTER"
          ? isNew
            ? form.baseItemId.trim() || undefined
            : item!.baseItemId?.trim() || undefined
          : undefined;
      const result = await saveItemAwaitPersist(
        {
          code: form.code,
          name: form.name,
          uom: form.uom,
          isActive: form.isActive,
          description: form.description || undefined,
          brandId: form.brandId || undefined,
          categoryId: form.categoryId || undefined,
          purchasePrice: parsePrice(form.purchasePrice),
          salePrice: parsePrice(form.salePrice),
          itemKind: itemKindForSave,
          baseItemId: baseItemIdForSave,
        },
        isNew ? undefined : id ?? undefined,
      );
      if (result.success) {
        navigate("/items");
      } else if (!issueListContainsMessage(health.issues, result.error)) {
        setActionIssues([actionIssueFromServiceMessage(result.error)]);
      }
    })();
  };

  const handleCancel = () => {
    navigate("/items");
  };

  const itemRecordId = !isNew && id ? id : null;

  const openStockBalancesForItem = useCallback(() => {
    if (!itemRecordId) return;
    navigate(`/stock-balances?itemId=${encodeURIComponent(itemRecordId)}`);
  }, [itemRecordId, navigate]);

  const openStockMovementsForItem = useCallback(() => {
    if (!itemRecordId) return;
    navigate(`/stock-movements?itemId=${encodeURIComponent(itemRecordId)}`);
  }, [itemRecordId, navigate]);

  const relatedTesters = useMemo(() => {
    if (!itemRecordId) return [];
    return itemRepository.list().filter((x) => x.itemKind === "TESTER" && x.baseItemId === itemRecordId);
  }, [itemRecordId, imagesRevision, barcodesRevision]);
  const markdownRevision = useAppReadModelRevision();
  const relatedMarkdown = useMemo(() => {
    if (!itemRecordId) return [];
    return markdownRepository.list().filter((x) => x.itemId === itemRecordId);
  }, [itemRecordId, markdownRevision]);

  const baseItemForTesterView = useMemo(() => {
    const bid = isNew ? form.baseItemId || requestedBaseItemId : item?.baseItemId;
    if (!bid) return undefined;
    return itemRepository.getById(bid);
  }, [isNew, form.baseItemId, requestedBaseItemId, item?.baseItemId, item?.id]);

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.item.notFound")}</p>
      </div>
    );
  }

  if (isNew && !isValidCreateKind) {
    return (
      <div className="doc-page">
        <div className="doc-page__breadcrumb">
          <BackButton to="/items" aria-label={t("master.item.backToListAria")} />
          <Breadcrumb
            items={[
              { label: t("master.breadcrumb.masterData"), to: "/items" },
              { label: t("master.item.listBreadcrumb"), to: "/items" },
              { label: t("master.common.newLabel") },
            ]}
          />
        </div>
        <div className="doc-page__header">
          <h2 className="doc-header__title">{t("master.item.createChoice.title")}</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("master.item.createChoice.subtitle")}</p>
        </div>
        <Card className="mt-4 max-w-md border-border/70">
          <CardContent className="flex flex-col gap-2 p-4">
            <Button type="button" onClick={() => navigate("/items/new?kind=SELLABLE")}>
              {t("master.item.createChoice.item")}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/items/new?kind=TESTER")}>
              {t("master.item.createChoice.tester")}
            </Button>
            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => navigate("/items")}>
              {t("common.cancel")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isNew && !item) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.item.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/items" },
    { label: t("master.item.listBreadcrumb"), to: "/items" },
    {
      label: isNew
        ? requestedKind === "TESTER"
          ? t("master.item.breadcrumbNewTester")
          : t("master.item.breadcrumbNewSellable")
        : item!.code,
    },
  ];

  const displayTitle = isNew
    ? requestedKind === "TESTER"
      ? t("master.item.titleNewTester")
      : t("master.item.titleNewSellable")
    : t("master.item.titleWithCode", { code: item!.code });

  const showTestersTab = isNew ? requestedKind !== "TESTER" : item!.itemKind === "SELLABLE";

  const inactiveSuffix = t("master.item.inactiveSuffix");
  const selectDash = t("master.common.selectEmpty");

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/items" aria-label={t("master.item.backToListAria")} />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div>
            <div className="doc-header__title-row">
              <h2 className="doc-header__title">{displayTitle}</h2>
            </div>
            {itemRecordId ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={openStockBalancesForItem}
                >
                  {t("master.item.openAllStockBalances")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={openStockMovementsForItem}
                >
                  {t("master.item.openAllStockMovements")}
                </Button>
              </div>
            ) : null}
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
      <Card className="mt-4 max-w-2xl w-full border-0 shadow-none">
        <Tabs.Root defaultValue="main">
          <CardHeader className="p-2 pb-0.5 space-y-2">
            <Tabs.List
              className="inline-flex h-9 w-full max-w-md flex-wrap items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5 text-[13px] sm:w-auto"
              aria-label={t("master.item.tabsAria")}
            >
              <Tabs.Trigger
                value="main"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.item.tabMain")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="images"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.item.tabImages")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="barcodes"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.item.tabBarcodes")}
              </Tabs.Trigger>
              {showTestersTab ? (
                <Tabs.Trigger
                  value="testers"
                  className={cn(
                    "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                    "text-muted-foreground hover:text-foreground",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {t("master.item.tabTesters")}
                </Tabs.Trigger>
              ) : null}
              <Tabs.Trigger
                value="markdown"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.item.tabMarkdown")}
              </Tabs.Trigger>
            </Tabs.List>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <Tabs.Content value="main" className="outline-none focus-visible:outline-none">
              <div className="space-y-2">
                <div>
                  <CardTitle className="text-[0.9rem] font-semibold">{t("master.common.detailsTitle")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("master.item.detailsDescription")}
                  </CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="item-code" className="text-sm">
                      {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-code"
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder={t("master.item.codePlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  {requestedKind === "TESTER" && (
                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                      <Label htmlFor="item-base" className="text-sm">
                        {t("master.item.baseItem")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                      </Label>
                      <select
                        id="item-base"
                        value={form.baseItemId}
                        onChange={(e) => {
                          const nextBaseId = e.target.value;
                          const base = itemRepository.getById(nextBaseId);
                          setForm((f) => ({
                            ...f,
                            baseItemId: nextBaseId,
                            code: base ? nextTesterCodeForBaseItem(base.id) ?? f.code : f.code,
                          }));
                        }}
                        className={cn(
                          "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        <option value="">{selectDash}</option>
                        {itemRepository
                          .list()
                          .filter((x) => x.itemKind === "SELLABLE" && x.id !== itemRecordId)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.code} - {x.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-name" className="text-sm">
                      {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("master.item.namePlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-uom" className="text-sm">
                      {t("doc.columns.uom")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-uom"
                      type="text"
                      value={form.uom}
                      onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                      placeholder={t("master.item.uomPlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-brand" className="text-sm">{t("doc.columns.brand")}</Label>
                    <select
                      id="item-brand"
                      value={form.brandId}
                      onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                      className={cn(
                        "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      <option value="">{selectDash}</option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name} {!b.isActive ? inactiveSuffix : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-category" className="text-sm">{t("doc.columns.category")}</Label>
                    <select
                      id="item-category"
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                      className={cn(
                        "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      <option value="">{selectDash}</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name} {!c.isActive ? inactiveSuffix : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-purchasePrice" className="text-sm">{t("doc.columns.purchasePrice")}</Label>
                    <Input
                      id="item-purchasePrice"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.purchasePrice}
                      onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                      placeholder="0.00"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-salePrice" className="text-sm">{t("doc.columns.salePrice")}</Label>
                    <Input
                      id="item-salePrice"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.salePrice}
                      onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                      placeholder="0.00"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-2 sm:col-span-2">
                    <Checkbox
                      id="item-active"
                      checked={form.isActive}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, isActive: checked === true }))
                      }
                    />
                    <Label
                      htmlFor="item-active"
                      className="cursor-pointer text-sm font-normal"
                    >
                      {t("ops.master.activeCell.active")}
                    </Label>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="item-description" className="text-sm">{t("common.description")}</Label>
                    <Textarea
                      id="item-description"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder={t("common.optional")}
                      rows={2}
                      className="resize-none h-auto min-h-[4.5rem] text-sm"
                    />
                  </div>
                  {barcodeMainSummary ? (
                    <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">{t("master.item.barcodes.summaryTitle")}</p>
                      <p className="mt-1 text-sm font-mono tabular-nums">
                        {barcodeMainSummary.primary ?? t("master.item.barcodes.summaryNoPrimary")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("master.item.barcodes.summaryCount", { count: barcodeMainSummary.count })}
                      </p>
                    </div>
                  ) : null}
                  {((isNew && requestedKind === "TESTER") || (!isNew && item!.itemKind === "TESTER")) && (
                    <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                      <div className="font-medium text-foreground/90">{t("master.item.baseItemSectionTitle")}</div>
                      {baseItemForTesterView ? (
                        <div className="mt-1 space-y-1 text-muted-foreground">
                          <div>
                            <span className="text-foreground/80">{t("doc.columns.code")}: </span>
                            {baseItemForTesterView.code}
                          </div>
                          <div>
                            <span className="text-foreground/80">{t("doc.columns.name")}: </span>
                            {baseItemForTesterView.name}
                          </div>
                          <Link className="list-table__link inline-block font-medium" to={`/items/${encodeURIComponent(baseItemForTesterView.id)}`}>
                            {t("master.item.openBaseItem")}
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-1 text-muted-foreground">—</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Content>
            <Tabs.Content value="images" className="outline-none focus-visible:outline-none">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("master.item.images.tabHint")}</p>
                <ItemImagesCard
                  isNew={isNew}
                  itemId={isNew ? undefined : id}
                  images={item?.images ?? []}
                  onImagesChanged={() => setImagesRevision((n) => n + 1)}
                />
              </div>
            </Tabs.Content>
            <Tabs.Content value="barcodes" className="outline-none focus-visible:outline-none">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("master.item.barcodes.tabHint")}</p>
                <ItemBarcodesCard
                  isNew={isNew}
                  itemId={isNew ? undefined : id}
                  barcodes={item?.barcodes ?? []}
                  onBarcodesChanged={() => setBarcodesRevision((n) => n + 1)}
                />
              </div>
            </Tabs.Content>
            {showTestersTab ? (
              <Tabs.Content value="testers" className="outline-none focus-visible:outline-none">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t("master.item.testers.tabHint")}</p>
                    {itemRecordId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/items/new?kind=TESTER&baseItemId=${encodeURIComponent(itemRecordId)}`)}
                      >
                        {t("master.item.testers.createTester")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border/70">
                    {relatedTesters.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">{t("master.item.testers.empty")}</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-1 text-left">{t("doc.columns.code")}</th>
                            <th className="px-2 py-1 text-left">{t("doc.columns.name")}</th>
                            <th className="px-2 py-1 text-left">{t("common.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedTesters.map((row) => (
                            <tr key={row.id} className="border-t border-border/60">
                              <td className="px-2 py-1">{row.code}</td>
                              <td className="px-2 py-1">{row.name}</td>
                              <td className="px-2 py-1">
                                <Link className="list-table__link" to={`/items/${encodeURIComponent(row.id)}`}>
                                  {t("common.open")}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </Tabs.Content>
            ) : null}
            <Tabs.Content value="markdown" className="outline-none focus-visible:outline-none">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t("master.item.markdown.tabHint")}</p>
                  {itemRecordId ? (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/markdown-journal/new?itemId=${encodeURIComponent(itemRecordId)}`)}>
                        {t("master.item.markdown.create")}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/markdown-journal?itemId=${encodeURIComponent(itemRecordId)}`)}>
                        {t("master.item.markdown.openAll")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-md border border-border/70">
                  {relatedMarkdown.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">—</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-2 py-1 text-left">{t("markdown.fields.markdownCode")}</th>
                          <th className="px-2 py-1 text-left">{t("common.status")}</th>
                          <th className="px-2 py-1 text-left">{t("markdown.fields.markdownPrice")}</th>
                          <th className="px-2 py-1 text-left">{t("markdown.fields.reason")}</th>
                          <th className="px-2 py-1 text-left">{t("common.warehouse")}</th>
                          <th className="px-2 py-1 text-left">{t("markdown.fields.location")}</th>
                          <th className="px-2 py-1 text-left">{t("markdown.fields.createdAt")}</th>
                          <th className="px-2 py-1 text-left">{t("common.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatedMarkdown.map((row) => {
                          const wh = warehouseRepository.getById(row.warehouseId);
                          return (
                          <tr key={row.id} className="border-t border-border/60">
                            <td className="px-2 py-1">{row.markdownCode}</td>
                            <td className="px-2 py-1">{t(`markdown.status.${row.status}`)}</td>
                            <td className="px-2 py-1">{row.markdownPrice.toFixed(2)}</td>
                            <td className="px-2 py-1">{t(`markdown.reason.${row.reasonCode}`)}</td>
                            <td className="px-2 py-1">{wh ? wh.code : row.warehouseId}</td>
                            <td className="px-2 py-1">{row.locationId ?? "—"}</td>
                            <td className="px-2 py-1">{row.createdAt}</td>
                            <td className="px-2 py-1">
                              <Link className="list-table__link" to={`/markdown-journal/${row.id}`}>{t("common.open")}</Link>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </Tabs.Content>
          </CardContent>
        </Tabs.Root>
      </Card>
    </div>
  );
}
