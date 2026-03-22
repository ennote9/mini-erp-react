/**
 * Stock Balances list — AG Grid migration (same pattern as Stock Movements).
 * Repository-backed data, search, empty states, dark theme. Plain text columns only.
 */
import { Fragment, useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { RowClassParams, RowClickedEvent } from "ag-grid-community";
import { useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { stockBalanceRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { StockBalance } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
  agGridSelectionColumnDef,
  hasMeaningfulTextSelection,
} from "../../../shared/ui/ag-grid";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildStockBalancesListXlsxBuffer, type StockBalancesExportRow } from "../stockBalancesListExport";
import {
  buildOutgoingRemainingByWarehouseItem,
  buildIncomingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
  type StockBalanceCoverageStatus,
} from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
import { stockBalancesListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { StockBalanceRowDrillDown } from "../components/StockBalanceRowDrillDown";
import { useSettings } from "../../../shared/settings/SettingsContext";
import { getEffectiveWorkspaceFeatureEnabled } from "../../../shared/workspace";
import { normalizeTrim } from "../../../shared/validation";

type RowData = StockBalance & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
  deficitQty: number;
  netShortageQty: number;
  coverageStatus: StockBalanceCoverageStatus;
};

type StockBalanceQuickFilter =
  | "all"
  | "shortage"
  | "outgoing"
  | "incoming"
  | "avail_lte_zero"
  | "needs_replenishment"
  | "coverage_at_risk";

function filterBySearch(
  rows: RowData[],
  query: string,
  coverageLabel: (s: StockBalanceCoverageStatus) => string,
): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q) ||
      coverageLabel(r.coverageStatus).toLowerCase().includes(q),
  );
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByItemId(rows: RowData[], itemId: string | null): RowData[] {
  if (itemId == null) return rows;
  return rows.filter((r) => r.itemId === itemId);
}

function filterByBrandId(rows: RowData[], brandId: string | null): RowData[] {
  if (brandId == null) return rows;
  const want = normalizeTrim(brandId);
  return rows.filter((r) => {
    const it = itemRepository.getById(r.itemId);
    return normalizeTrim(it?.brandId ?? "") === want;
  });
}

function filterByCategoryId(rows: RowData[], categoryId: string | null): RowData[] {
  if (categoryId == null) return rows;
  const want = normalizeTrim(categoryId);
  return rows.filter((r) => {
    const it = itemRepository.getById(r.itemId);
    return normalizeTrim(it?.categoryId ?? "") === want;
  });
}

function filterByQuickFilter(rows: RowData[], f: StockBalanceQuickFilter): RowData[] {
  if (f === "all") return rows;
  if (f === "shortage") return rows.filter((r) => r.deficitQty > 0);
  if (f === "outgoing") return rows.filter((r) => r.outgoingQty > 0);
  if (f === "incoming") return rows.filter((r) => r.incomingQty > 0);
  if (f === "avail_lte_zero") return rows.filter((r) => r.availableQty <= 0);
  if (f === "needs_replenishment") return rows.filter((r) => r.netShortageQty > 0);
  if (f === "coverage_at_risk")
    return rows.filter(
      (r) =>
        r.outgoingQty > r.availableQty && r.incomingQty > 0 && r.netShortageQty === 0,
    );
  return rows;
}

function buildExportRowsFromBalances(
  rows: RowData[],
  coverageLabel: (s: StockBalanceCoverageStatus) => string,
): StockBalancesExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    itemCode: r.itemCode,
    itemName: r.itemName,
    warehouse: r.warehouseName,
    totalQty: r.qtyOnHand,
    reservedQty: r.reservedQty,
    availableQty: r.availableQty,
    outgoingQty: r.outgoingQty,
    incomingQty: r.incomingQty,
    deficitQty: r.deficitQty,
    netShortageQty: r.netShortageQty,
    coverage: coverageLabel(r.coverageStatus),
  }));
}

export function StockBalancesListPage() {
  const { t, locale } = useTranslation();
  const { settings } = useSettings();

  const coverageLabel = useCallback(
    (s: StockBalanceCoverageStatus) => t(`ops.stock.coverage.${s}`),
    [t],
  );

  const quickFilterOptions = useMemo(
    (): Array<{ value: StockBalanceQuickFilter; label: string; aria: string }> => [
      { value: "all", label: t("ops.stockBalances.quick.all.label"), aria: t("ops.stockBalances.quick.all.aria") },
      {
        value: "shortage",
        label: t("ops.stockBalances.quick.shortage.label"),
        aria: t("ops.stockBalances.quick.shortage.aria"),
      },
      {
        value: "outgoing",
        label: t("ops.stockBalances.quick.outgoing.label"),
        aria: t("ops.stockBalances.quick.outgoing.aria"),
      },
      {
        value: "incoming",
        label: t("ops.stockBalances.quick.incoming.label"),
        aria: t("ops.stockBalances.quick.incoming.aria"),
      },
      {
        value: "avail_lte_zero",
        label: t("ops.stockBalances.quick.avail_lte_zero.label"),
        aria: t("ops.stockBalances.quick.avail_lte_zero.aria"),
      },
      {
        value: "needs_replenishment",
        label: t("ops.stockBalances.quick.needs_replenishment.label"),
        aria: t("ops.stockBalances.quick.needs_replenishment.aria"),
      },
      {
        value: "coverage_at_risk",
        label: t("ops.stockBalances.quick.coverage_at_risk.label"),
        aria: t("ops.stockBalances.quick.coverage_at_risk.aria"),
      },
    ],
    [t, locale],
  );
  const workspaceMode = settings.general.workspaceMode;
  const profileOverrides = settings.general.profileOverrides;
  const showOperationalGrid = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    profileOverrides,
    "stockBalancesOperationalGrid",
  );
  const showQuickFilters = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    profileOverrides,
    "stockBalancesQuickFilters",
  );
  const showDrillDownModal = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    profileOverrides,
    "stockBalancesDrillDownModal",
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const itemFilterId = useMemo(() => {
    const raw = searchParams.get("itemId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
  const brandFilterId = useMemo(() => {
    const raw = searchParams.get("brandId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
  const categoryFilterId = useMemo(() => {
    const raw = searchParams.get("categoryId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
  const warehouseFilterId = useMemo(() => {
    const raw = searchParams.get("warehouseId");
    if (raw == null || raw === "") return null;
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<StockBalanceQuickFilter>("all");
  const [detailRow, setDetailRow] = useState<RowData | null>(null);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const rowsWithNames = useMemo(() => {
    const outgoing = buildOutgoingRemainingByWarehouseItem();
    const incoming = buildIncomingRemainingByWarehouseItem();
    const list = stockBalanceRepository.list();
    return list.map((b) => {
      const item = itemRepository.getById(b.itemId);
      const warehouse = warehouseRepository.getById(b.warehouseId);
      const op = computeOperationalFieldsForBalance(b, outgoing, incoming);
      return {
        ...b,
        itemCode: item?.code ?? b.itemId,
        itemName: item?.name ?? b.itemId,
        warehouseName: warehouse?.name ?? b.warehouseId,
        reservedQty: op.reservedQty,
        availableQty: op.availableQty,
        outgoingQty: op.outgoingQty,
        incomingQty: op.incomingQty,
        deficitQty: op.deficitQty,
        netShortageQty: op.netShortageQty,
        coverageStatus: op.coverageStatus,
      };
    });
  }, []);

  const getRowClass = useCallback((params: RowClassParams<RowData>) => {
    const d = params.data;
    if (!d) return "";
    if (d.netShortageQty > 0) return "stock-balances-row--tight-availability";
    if (d.coverageStatus === "at_risk") return "stock-balances-row--at-risk";
    return "";
  }, []);

  /**
   * Base slice (counts + search + quick filters):
   * brandId → categoryId → itemId → warehouseId
   */
  const rowsAfterBrand = useMemo(
    () => filterByBrandId(rowsWithNames, brandFilterId),
    [rowsWithNames, brandFilterId],
  );
  const rowsAfterCategory = useMemo(
    () => filterByCategoryId(rowsAfterBrand, categoryFilterId),
    [rowsAfterBrand, categoryFilterId],
  );
  const rowsAfterItem = useMemo(
    () => filterByItemId(rowsAfterCategory, itemFilterId),
    [rowsAfterCategory, itemFilterId],
  );
  const rowsAfterWarehouse = useMemo(
    () => filterByWarehouseId(rowsAfterItem, warehouseFilterId),
    [rowsAfterItem, warehouseFilterId],
  );

  const quickFilterCounts = useMemo((): Record<StockBalanceQuickFilter, number> => {
    let shortage = 0;
    let outgoing = 0;
    let incoming = 0;
    let availLteZero = 0;
    let needsRepl = 0;
    let atRisk = 0;
    for (const r of rowsAfterWarehouse) {
      if (r.deficitQty > 0) shortage++;
      if (r.outgoingQty > 0) outgoing++;
      if (r.incomingQty > 0) incoming++;
      if (r.availableQty <= 0) availLteZero++;
      if (r.netShortageQty > 0) needsRepl++;
      if (
        r.outgoingQty > r.availableQty &&
        r.incomingQty > 0 &&
        r.netShortageQty === 0
      )
        atRisk++;
    }
    return {
      all: rowsAfterWarehouse.length,
      shortage,
      outgoing,
      incoming,
      avail_lte_zero: availLteZero,
      needs_replenishment: needsRepl,
      coverage_at_risk: atRisk,
    };
  }, [rowsAfterWarehouse]);

  const filteredRows = useMemo(() => {
    const bySearch = filterBySearch(rowsAfterWarehouse, searchQuery, coverageLabel);
    return filterByQuickFilter(bySearch, quickFilter);
  }, [rowsAfterWarehouse, searchQuery, quickFilter, coverageLabel]);

  const isEmpty = filteredRows.length === 0;

  useEffect(() => {
    if (isEmpty) setDetailRow(null);
  }, [isEmpty]);

  useEffect(() => {
    if (!showQuickFilters) setQuickFilter("all");
  }, [showQuickFilters]);

  useEffect(() => {
    if (!showDrillDownModal) setDetailRow(null);
  }, [showDrillDownModal]);

  const onRowClicked = useCallback(
    (e: RowClickedEvent<RowData>) => {
      if (!showDrillDownModal) return;
      if (hasMeaningfulTextSelection()) return;
      if (e.data) setDetailRow(e.data);
    },
    [showDrillDownModal],
  );

  const onDrillDownOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailRow(null);
  }, []);
  const hasFilter =
    searchQuery.trim() !== "" ||
    warehouseFilterId != null ||
    itemFilterId != null ||
    brandFilterId != null ||
    categoryFilterId != null ||
    quickFilter !== "all";

  const brandFilterLabel = useMemo((): string => {
    if (brandFilterId == null) return "";
    const b = brandRepository.getById(brandFilterId);
    if (b) {
      const name = b.name?.trim() ? b.name : "";
      return name ? `${b.code} — ${b.name}` : b.code;
    }
    return brandFilterId;
  }, [brandFilterId]);

  const categoryFilterLabel = useMemo((): string => {
    if (categoryFilterId == null) return "";
    const c = categoryRepository.getById(categoryFilterId);
    if (c) {
      const name = c.name?.trim() ? c.name : "";
      return name ? `${c.code} — ${c.name}` : c.code;
    }
    return categoryFilterId;
  }, [categoryFilterId]);

  const itemFilterLabel = useMemo((): string => {
    if (itemFilterId == null) return "";
    const it = itemRepository.getById(itemFilterId);
    if (it) {
      const name = it.name?.trim() ? it.name : "";
      return name ? `${it.code} — ${it.name}` : it.code;
    }
    return itemFilterId;
  }, [itemFilterId]);

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const clearWarehouseFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("warehouseId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearItemFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearBrandFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("brandId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearCategoryFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoryId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getExportRowsCurrentView = useCallback((): StockBalancesExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromBalances(filteredRows, coverageLabel);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromBalances(rows, coverageLabel);
  }, [filteredRows, coverageLabel]);

  const getExportRowsSelected = useCallback((): StockBalancesExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromBalances(rows, coverageLabel);
  }, [coverageLabel]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: t("ops.importModal.excelFileFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) return;

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path, contentsBase64 });
        const filename = path.replace(/^.*[/\\]/, "") || defaultFilename;
        setExportSuccess({ path, filename });
      } catch (err) {
        console.error("Export failed", err);
        const buffer = await buildBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [t],
  );

  const listExcelLabels = useMemo(() => stockBalancesListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("stock-balances.xlsx", () => buildStockBalancesListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsCurrentView, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("stock-balances-selected.xlsx", () => buildStockBalancesListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsSelected, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? t("ops.stockBalances.empty.titleFiltered")
    : t("ops.stockBalances.empty.titleDefault");
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return t("ops.stockBalances.empty.hintPosted");
    }
    const noSearch = searchQuery.trim() === "";
    const noUrlExcept = (
      brand: boolean,
      category: boolean,
      item: boolean,
      warehouse: boolean,
    ) =>
      (brand ? brandFilterId != null : brandFilterId == null) &&
      (category ? categoryFilterId != null : categoryFilterId == null) &&
      (item ? itemFilterId != null : itemFilterId == null) &&
      (warehouse ? warehouseFilterId != null : warehouseFilterId == null) &&
      quickFilter === "all" &&
      noSearch;

    if (noUrlExcept(true, false, false, false)) {
      return t("ops.stockBalances.empty.hintBrandOnly");
    }
    if (noUrlExcept(false, true, false, false)) {
      return t("ops.stockBalances.empty.hintCategoryOnly");
    }
    if (noUrlExcept(false, false, true, false)) {
      return t("ops.stockBalances.empty.hintItemOnly");
    }
    if (
      quickFilter !== "all" &&
      noSearch &&
      brandFilterId == null &&
      categoryFilterId == null &&
      itemFilterId == null &&
      warehouseFilterId == null
    ) {
      return t("ops.stockBalances.empty.hintQuickOnly");
    }
    if (noUrlExcept(false, false, false, true)) {
      return t("ops.stockBalances.empty.hintWarehouseOnly");
    }
    return t("ops.stockBalances.empty.hintGeneral");
  }, [
    hasFilter,
    brandFilterId,
    categoryFilterId,
    itemFilterId,
    warehouseFilterId,
    searchQuery,
    quickFilter,
    t,
  ]);

  const qtyCol = (
    field: keyof RowData,
    headerName: string,
    width: number,
  ): ColDef<RowData> => ({
    field,
    headerName,
    width,
    minWidth: width - 8,
    maxWidth: width + 24,
    sortable: true,
    type: "numericColumn",
    cellClass: "tabular-nums",
    valueFormatter: (p) =>
      typeof p.value === "number" && !Number.isNaN(p.value) ? String(p.value) : "—",
  });

  const columnDefs = useMemo<ColDef<RowData>[]>(() => {
    const base: ColDef<RowData>[] = [
      agGridRowNumberColDef,
      {
        field: "itemCode",
        headerName: t("doc.columns.itemCode"),
        width: 118,
        minWidth: 100,
      },
      {
        field: "itemName",
        headerName: t("doc.columns.itemName"),
        flex: 1,
        minWidth: 140,
      },
      {
        field: "warehouseName",
        headerName: t("doc.columns.warehouse"),
        minWidth: 120,
        width: 140,
      },
      qtyCol("qtyOnHand", t("doc.columns.totalQuantity"), 112),
    ];
    if (!showOperationalGrid) return base;
    return [
      ...base,
      qtyCol("reservedQty", t("doc.columns.reserved"), 96),
      qtyCol("availableQty", t("doc.columns.available"), 100),
      qtyCol("deficitQty", t("doc.columns.deficit"), 88),
      qtyCol("outgoingQty", t("doc.columns.outgoing"), 96),
      qtyCol("incomingQty", t("doc.columns.incoming"), 96),
      qtyCol("netShortageQty", t("doc.columns.netShortage"), 104),
      {
        field: "coverageStatus",
        headerName: t("doc.columns.coverage"),
        width: 102,
        minWidth: 92,
        maxWidth: 120,
        sortable: true,
        valueFormatter: (p) =>
          p.value != null
            ? coverageLabel(p.value as StockBalanceCoverageStatus)
            : "—",
        cellClass: (p) =>
          p.data?.coverageStatus === "short"
            ? "font-medium"
            : p.data?.coverageStatus === "at_risk"
              ? "text-muted-foreground"
              : "text-muted-foreground/90",
      },
    ];
  }, [showOperationalGrid, t, locale, coverageLabel]);

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
          {showQuickFilters ? (
            <ButtonGroup className="list-page__filter-group shrink-0" aria-label={t("ops.stockBalances.quickFiltersAria")}>
              {quickFilterOptions.map((opt, index) => (
                <Fragment key={opt.value}>
                  {index > 0 && <ButtonGroupSeparator />}
                  <Button
                    type="button"
                    variant={quickFilter === opt.value ? "default" : "outline"}
                    size="sm"
                    className="px-2 text-xs gap-1"
                    title={opt.aria}
                    aria-pressed={quickFilter === opt.value}
                    onClick={() => setQuickFilter(opt.value)}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={
                        quickFilter === opt.value
                          ? "tabular-nums font-normal opacity-90"
                          : "tabular-nums text-muted-foreground font-normal"
                      }
                    >
                      ({quickFilterCounts[opt.value]})
                    </span>
                  </Button>
                </Fragment>
              ))}
            </ButtonGroup>
          ) : null}
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.stockBalances.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.stockBalances.searchAria")}
            resultCount={filteredRows.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
            {brandFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.stockBalances.brandFilterAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.stockBalances.brandFilterPrefix")}
                </span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={brandFilterLabel}
                >
                  {brandFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearBrandFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {categoryFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.stockBalances.categoryFilterAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.stockBalances.categoryFilterPrefix")}
                </span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={categoryFilterLabel}
                >
                  {categoryFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCategoryFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {itemFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.stockBalances.itemFilterAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.stockBalances.itemFilterPrefix")}
                </span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={itemFilterLabel}
                >
                  {itemFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearItemFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.stockBalances.warehouseFilterAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("doc.columns.warehouse")}
                </span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={warehouseFilterLabel}
                >
                  {warehouseFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearWarehouseFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {exportSuccess && (
              <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
                <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title={t("doc.list.openFile")}
                  aria-label={t("doc.list.openFile")}
                  onClick={async () => {
                    try {
                      await invoke("open_export_file", { path: exportSuccess.path });
                      setExportSuccess(null);
                    } catch (err) {
                      console.error("Export failed", err);
                      setExportSuccess(null);
                    }
                  }}
                >
                  <File className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title={t("doc.list.openFolder")}
                  aria-label={t("doc.list.openFolder")}
                  onClick={() => {
                    revealItemInDir(exportSuccess.path);
                    setExportSuccess(null);
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                  title={t("doc.list.dismiss")}
                  aria-label={t("doc.list.dismiss")}
                  onClick={() => setExportSuccess(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-stretch rounded-md border border-input shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-r-none border-0 border-r border-input gap-1.5"
                onClick={handleExportCurrentView}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                {t("doc.list.export")}
              </Button>
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
                    aria-label={t("doc.list.exportOptionsAria")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="!w-max min-w-0 p-1.5" align="end" side="top">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={exportSelectedDisabled}
                      className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      title={exportSelectedDisabled ? t("doc.list.selectRowsForExport") : undefined}
                      onClick={() => {
                        setExportOpen(false);
                        if (!exportSelectedDisabled) handleExportSelected();
                      }}
                    >
                      {t("doc.list.exportSelectedRows")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <>
          <AgGridContainer themeClass="stock-balances-grid">
            <AgGridReact<RowData>
              {...agGridDefaultGridOptions}
              ref={gridRef}
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={agGridDefaultColDef}
              rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
              selectionColumnDef={agGridSelectionColumnDef}
              getRowId={(params) => params.data.id}
              getRowClass={getRowClass}
              onSelectionChanged={onSelectionChanged}
              onRowClicked={onRowClicked}
            />
          </AgGridContainer>
          {showDrillDownModal && detailRow ? (
            <StockBalanceRowDrillDown
              key={detailRow.id}
              row={{
                itemId: detailRow.itemId,
                warehouseId: detailRow.warehouseId,
                itemCode: detailRow.itemCode,
                itemName: detailRow.itemName,
                warehouseName: detailRow.warehouseName,
                qtyOnHand: detailRow.qtyOnHand,
                reservedQty: detailRow.reservedQty,
                availableQty: detailRow.availableQty,
                outgoingQty: detailRow.outgoingQty,
                incomingQty: detailRow.incomingQty,
                deficitQty: detailRow.deficitQty,
                netShortageQty: detailRow.netShortageQty,
                coverageStatus: detailRow.coverageStatus,
              }}
              onOpenChange={onDrillDownOpenChange}
            />
          ) : null}
        </>
      )}
    </ListPageLayout>
  );
}
