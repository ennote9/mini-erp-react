import { useParams, useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";
import { ensureItemsLoaded, isItemsRepositoryReady, itemRepository } from "../repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { nextTesterCodeForBaseItem, saveItemAwaitPersist } from "../service";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tabs } from "radix-ui";
import {
  Card,
  CardContent,
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
import { ItemPricesTab } from "../components/ItemPricesTab";
import { ItemResponsiblesTab } from "../components/ItemResponsiblesTab";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import { appendReturnTo, buildReturnToValue, readReturnToParam } from "@/shared/navigation/returnTo";
import { useUrlTabState } from "@/shared/navigation/useUrlTabState";

type FormState = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description: string;
  accountingProfile: string;
  brandId: string;
  categoryId: string;
  baseItemId: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    uom: "",
    isActive: true,
    description: "",
    accountingProfile: "",
    brandId: "",
    categoryId: "",
    baseItemId: "",
  };
}

export function ItemPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [itemsReady, setItemsReady] = useState(() => isItemsRepositoryReady());
  const isNew = id === "new";
  const [imagesRevision, setImagesRevision] = useState(0);
  const [barcodesRevision, setBarcodesRevision] = useState(0);
  const [pricesRevision, setPricesRevision] = useState(0);
  const [responsiblesRevision, setResponsiblesRevision] = useState(0);
  const [itemDetailRevision, setItemDetailRevision] = useState(0);
  const requestedKind = (searchParams.get("kind") ?? "").toUpperCase();
  const requestedBaseItemId = searchParams.get("baseItemId") ?? "";
  const createKind: "SELLABLE" | "TESTER" = requestedKind === "TESTER" ? "TESTER" : "SELLABLE";
  useEffect(() => {
    if (itemsReady) return;
    let cancelled = false;
    ensureItemsLoaded()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setItemsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itemsReady]);

  const item = useMemo(
    () => (itemsReady && id && !isNew ? itemRepository.getById(id) : undefined),
    [itemsReady, id, isNew, imagesRevision, barcodesRevision, pricesRevision, responsiblesRevision, itemDetailRevision],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getItemFormHealth({
        code: form.code,
        name: form.name,
        uom: form.uom,
      }),
    [form.code, form.name, form.uom],
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
  }, [form.code, form.name, form.uom]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  const returnTo = readReturnToParam(searchParams);
  const backHref = returnTo ?? "/items";
  const currentReturnTo = useMemo(
    () => buildReturnToValue(location.pathname, location.search),
    [location.pathname, location.search],
  );

  useEffect(() => {
    if (!itemsReady) return;
    if (isNew) {
      if (createKind === "TESTER" && requestedBaseItemId) {
        const base = itemRepository.getById(requestedBaseItemId);
        if (base && base.itemKind === "SELLABLE") {
          const suggested = nextTesterCodeForBaseItem(base.id);
          setForm({
            code: suggested ?? "",
            name: base.name,
            uom: base.uom,
            isActive: true,
            description: base.description ?? "",
            accountingProfile: base.accountingProfile ?? "",
            brandId: base.brandId ?? "",
            categoryId: base.categoryId ?? "",
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
        accountingProfile: item.accountingProfile ?? "",
        brandId: item.brandId ?? "",
        categoryId: item.categoryId ?? "",
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
    item?.accountingProfile,
    item?.brandId,
    item?.categoryId,
    createKind,
    requestedBaseItemId,
  ]);

  const handleSave = () => {
    setActionIssues([]);
    void (async () => {
      const itemKindForSave: "SELLABLE" | "TESTER" = isNew
        ? createKind === "TESTER"
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
          accountingProfile: form.accountingProfile || undefined,
          brandId: form.brandId || undefined,
          categoryId: form.categoryId || undefined,
          itemKind: itemKindForSave,
          baseItemId: baseItemIdForSave,
        },
        isNew ? undefined : id ?? undefined,
      );
      if (result.success) {
        if (isNew) {
          navigate(appendReturnTo(`/items/${encodeURIComponent(result.id)}`, currentReturnTo), { replace: true });
        } else {
          setItemDetailRevision((n) => n + 1);
        }
      } else if (!issueListContainsMessage(health.issues, result.error)) {
        setActionIssues([actionIssueFromServiceMessage(result.error)]);
      }
    })();
  };

  const handleCancel = () => {
    navigate(backHref);
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

  const openMarkdownForItem = useCallback(() => {
    if (!itemRecordId) return;
    navigate(`/markdown-journal?itemId=${encodeURIComponent(itemRecordId)}`);
  }, [itemRecordId, navigate]);

  const relatedTesters = useMemo(() => {
    if (!itemRecordId) return [];
    return itemRepository.list().filter((x) => x.itemKind === "TESTER" && x.baseItemId === itemRecordId);
  }, [itemRecordId, imagesRevision, barcodesRevision]);

  const baseItemForTesterView = useMemo(() => {
    const bid = isNew ? form.baseItemId || requestedBaseItemId : item?.baseItemId;
    if (!bid) return undefined;
    return itemRepository.getById(bid);
  }, [isNew, form.baseItemId, requestedBaseItemId, item?.baseItemId, item?.id]);

  const displayTitle = useMemo(() => {
    if (isNew) {
      return createKind === "TESTER"
        ? t("master.item.titleNewTester")
        : t("master.item.titleNewSellable");
    }
    if (!item) return "";
    return t("master.item.titleWithCode", { code: item.code });
  }, [isNew, createKind, item, t]);

  const showTestersTab = useMemo(
    () => (isNew ? createKind !== "TESTER" : item?.itemKind === "SELLABLE"),
    [isNew, createKind, item?.itemKind],
  );

  const tabItems = useMemo(
    () => [
      { value: "main", label: t("master.item.tabMain") },
      { value: "prices", label: t("master.item.tabPrices") },
      { value: "responsibles", label: t("master.item.tabResponsibles") },
      { value: "images", label: t("master.item.tabImages") },
      { value: "barcodes", label: t("master.item.tabBarcodes") },
      ...(showTestersTab ? [{ value: "testers" as const, label: t("master.item.tabTesters") }] : []),
    ],
    [showTestersTab, t],
  );

  const availableTabValues = useMemo(() => tabItems.map((tab) => tab.value), [tabItems]);

  const [activeTab, setActiveTab] = useUrlTabState({
    allowedValues: availableTabValues as readonly string[],
    defaultValue: "main",
  });

  const inactiveSuffix = t("master.item.inactiveSuffix");
  const selectDash = t("master.common.selectEmpty");

  if (!itemsReady) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.item.notFound")}</p>
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

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton
          to={returnTo ?? undefined}
          fallbackTo="/items"
          preferHistory={!returnTo}
          aria-label={t("master.item.backToListAria")}
        />
        {itemRecordId ? (
          <div className="ml-1 flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={openStockBalancesForItem}
            >
              {t("master.item.openAllStockBalances")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={openStockMovementsForItem}
            >
              {t("master.item.openAllStockMovements")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={openMarkdownForItem}
            >
              {t("master.item.openAllMarkdown")}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="doc-page__header">
        <div className="doc-header gap-3">
          <div>
            <div className="doc-header__title-row">
              <h2 className="doc-header__title !text-base">{displayTitle}</h2>
            </div>
          </div>
          <div className="doc-header__right">
            {(hasErrors(combinedIssues) || hasWarnings(combinedIssues)) && (
              <DocumentIssueStrip issues={combinedIssues} />
            )}
            <div className="doc-header__actions gap-1.5">
              <Button type="button" size="sm" className="h-7 gap-1 px-3 text-xs" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" aria-hidden />
                {t("common.save")}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-3 text-xs" onClick={handleCancel}>
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Card className="mt-3 w-full max-w-6xl border-0 shadow-none">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="space-y-1 p-1.5 pb-0">
            <Tabs.List
              className="inline-flex min-h-7 w-full max-w-full flex-wrap items-stretch overflow-hidden rounded-md border border-input bg-background sm:w-fit"
              aria-label={t("master.item.tabsAria")}
            >
              <ButtonGroup className="w-full flex-wrap rounded-none border-0 bg-transparent sm:w-auto" aria-label={t("master.item.tabsAria")}>
                {tabItems.map((tab, index) => (
                  <div key={tab.value} className="contents">
                    {index > 0 ? <ButtonGroupSeparator /> : null}
                    <Tabs.Trigger
                      value={tab.value}
                      data-testid={`item-tab-${tab.value}`}
                      className={cn(
                        "inline-flex h-7 flex-1 items-center justify-center rounded-none border-0 bg-background px-2.5 text-xs font-medium transition-colors sm:flex-initial",
                        "text-foreground hover:bg-accent hover:text-accent-foreground",
                        "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    >
                      {tab.label}
                    </Tabs.Trigger>
                  </div>
                ))}
              </ButtonGroup>
            </Tabs.List>
          </CardHeader>
          <CardContent className="px-1.5 pb-1.5 pt-[7mm]">
            <Tabs.Content value="main" className="outline-none focus-visible:outline-none">
              <div className="w-full max-w-[33.75rem]">
              <div className="space-y-1.5">
                <div>
                  <CardTitle className="text-sm font-semibold leading-tight">{t("master.common.detailsTitle")}</CardTitle>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="item-name" className="text-xs">
                      {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("master.item.namePlaceholder")}
                      className="h-7 text-xs"
                    />
                  </div>
                  {createKind === "TESTER" && (
                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                      <Label htmlFor="item-base" className="text-xs">
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
                          "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground",
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
                    <Label htmlFor="item-code" className="text-xs">
                      {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-code"
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder={t("master.item.codePlaceholder")}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-uom" className="text-xs">
                      {t("doc.columns.uom")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="item-uom"
                      type="text"
                      value={form.uom}
                      onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                      placeholder={t("master.item.uomPlaceholder")}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-accounting-profile" className="text-xs">
                      {t("master.item.accountingProfile")}
                    </Label>
                    <Input
                      id="item-accounting-profile"
                      type="text"
                      value={form.accountingProfile}
                      onChange={(e) => setForm((f) => ({ ...f, accountingProfile: e.target.value }))}
                      placeholder={t("master.common.optionalPlaceholder")}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="item-brand" className="text-xs">{t("doc.columns.brand")}</Label>
                    <select
                      id="item-brand"
                      value={form.brandId}
                      onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                      className={cn(
                        "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground",
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
                    <Label htmlFor="item-category" className="text-xs">{t("doc.columns.category")}</Label>
                    <select
                      id="item-category"
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                      className={cn(
                        "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground",
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
                      className="cursor-pointer text-xs font-normal"
                    >
                      {t("ops.master.activeCell.active")}
                    </Label>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="item-description" className="text-xs">{t("common.description")}</Label>
                    <Textarea
                      id="item-description"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder={t("common.optional")}
                      rows={2}
                      className="resize-none h-auto min-h-[3.75rem] text-xs leading-snug"
                    />
                  </div>
                  {((isNew && createKind === "TESTER") || (!isNew && item!.itemKind === "TESTER")) && (
                    <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/20 p-1.5 text-[11px] leading-snug">
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
              </div>
            </Tabs.Content>
            <Tabs.Content value="prices" className="outline-none focus-visible:outline-none">
              <ItemPricesTab
                isNew={isNew}
                itemId={isNew ? undefined : id}
                revision={pricesRevision}
                onPricesChanged={() => {
                  setPricesRevision((n) => n + 1);
                  setItemDetailRevision((n) => n + 1);
                }}
              />
            </Tabs.Content>
            <Tabs.Content value="responsibles" className="outline-none focus-visible:outline-none">
              <ItemResponsiblesTab
                isNew={isNew}
                itemId={isNew ? undefined : id}
                revision={responsiblesRevision}
                onResponsiblesChanged={() => {
                  setResponsiblesRevision((n) => n + 1);
                  setItemDetailRevision((n) => n + 1);
                }}
              />
            </Tabs.Content>
            <Tabs.Content value="images" className="outline-none focus-visible:outline-none">
              <ItemImagesCard
                isNew={isNew}
                itemId={isNew ? undefined : id}
                images={item?.images ?? []}
                onImagesChanged={() => setImagesRevision((n) => n + 1)}
              />
            </Tabs.Content>
            <Tabs.Content value="barcodes" className="outline-none focus-visible:outline-none">
              <ItemBarcodesCard
                isNew={isNew}
                itemId={isNew ? undefined : id}
                barcodes={item?.barcodes ?? []}
                onBarcodesChanged={() => setBarcodesRevision((n) => n + 1)}
              />
            </Tabs.Content>
            {showTestersTab ? (
              <Tabs.Content value="testers" className="outline-none focus-visible:outline-none">
                <div className="space-y-1.5">
                  {itemRecordId ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() =>
                          navigate(
                            appendReturnTo(
                              `/items/new?kind=TESTER&baseItemId=${encodeURIComponent(itemRecordId)}`,
                              currentReturnTo,
                            ),
                          )
                        }
                      >
                        {t("master.item.testers.createTester")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-border/70">
                    {relatedTesters.length === 0 ? (
                      <div className="p-2 text-[11px] text-muted-foreground">{t("master.item.testers.empty")}</div>
                    ) : (
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-0.5 text-left font-medium">{t("doc.columns.code")}</th>
                            <th className="px-2 py-0.5 text-left font-medium">{t("doc.columns.name")}</th>
                            <th className="px-2 py-0.5 text-left font-medium">{t("common.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedTesters.map((row) => (
                            <tr key={row.id} className="border-t border-border/60">
                              <td className="px-2 py-0.5">{row.code}</td>
                              <td className="px-2 py-0.5">{row.name}</td>
                              <td className="px-2 py-0.5">
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
          </CardContent>
        </Tabs.Root>
      </Card>
    </div>
  );
}
