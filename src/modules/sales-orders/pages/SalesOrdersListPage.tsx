import { useMemo, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { salesOrderRepository } from "../repository";
import { customerRepository } from "../../customers/repository";
import { carrierRepository } from "../../carriers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { normalizeDateForSO } from "../dateUtils";
import type { SalesOrder } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  AgGridPlanningStatusCellRenderer,
  applyAgGridColumnFilters,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  getAgGridRowNumberColDef,
  agGridSelectionColumnDef,
  decorateAgGridColumnDefsWithFilters,
  hasMeaningfulTextSelection,
  type AgGridColumnFilterConfig,
} from "../../../shared/ui/ag-grid";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildSalesOrdersListXlsxBuffer, type SalesOrdersExportRow } from "../salesOrdersListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { salesOrdersListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { toGeneratedCodeSearchTokens } from "@/shared/generatedVisibleCodes";
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
} from "@/shared/navigation/agGridColumnFilters";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";

type RowData = SalesOrder & {
  customerName: string;
  warehouseName: string;
  carrierLabel: string;
  carrierExport: string;
  carrierSearchBlob: string;
  recipientLabel: string;
  recipientPhoneLabel: string;
  recipientExport: string;
  recipientPhoneExport: string;
  recipientSearchBlob: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const codeTokens = toGeneratedCodeSearchTokens(q);
  return rows.filter((r) => {
    const n = r.number.toLowerCase();
    const nCompact = n.replace(/[^a-z0-9]/g, "");
    if (n.includes(q) || codeTokens.some((t) => n.includes(t) || nCompact.includes(t))) return true;
    if (r.customerName.toLowerCase().includes(q)) return true;
    if (r.warehouseName.toLowerCase().includes(q)) return true;
    if (r.carrierSearchBlob.includes(q)) return true;
    if (r.recipientSearchBlob.includes(q)) return true;
    return false;
  });
}

function filterByCustomerId(rows: RowData[], customerId: string | null): RowData[] {
  if (customerId == null) return rows;
  return rows.filter((r) => r.customerId === customerId);
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByCarrierId(rows: RowData[], carrierId: string | null): RowData[] {
  if (carrierId == null) return rows;
  return rows.filter((r) => (r.carrierId?.trim() ?? "") === carrierId);
}

/** When `allowIds` is null, no item filter is applied. */
function filterByDocumentIdSet(rows: RowData[], allowIds: Set<string> | null): RowData[] {
  if (allowIds == null) return rows;
  return rows.filter((r) => allowIds.has(r.id));
}

function parseQueryId(searchParams: URLSearchParams, key: string): string | null {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

function buildExportRowsFromSO(rows: RowData[]): SalesOrdersExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    number: r.number ?? "",
    date: normalizeDateForSO(r.date),
    customer: r.customerName ?? "",
    warehouse: r.warehouseName ?? "",
    carrier: r.carrierExport ?? "",
    recipient: r.recipientExport ?? "",
    recipientPhone: r.recipientPhoneExport ?? "",
    status: r.status ?? "",
  }));
}

export function SalesOrdersListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerFilterId = useMemo(() => parseQueryId(searchParams, "customerId"), [searchParams]);
  const warehouseFilterId = useMemo(() => parseQueryId(searchParams, "warehouseId"), [searchParams]);
  const carrierFilterId = useMemo(() => parseQueryId(searchParams, "carrierId"), [searchParams]);
  const itemFilterId = useMemo(() => parseQueryId(searchParams, "itemId"), [searchParams]);

  const salesOrderIdsContainingItem = useMemo(() => {
    if (itemFilterId == null) return null;
    const ids = new Set<string>();
    for (const so of salesOrderRepository.list()) {
      const lines = salesOrderRepository.listLines(so.id);
      for (const line of lines) {
        if (line.itemId === itemFilterId) {
          ids.add(so.id);
          break;
        }
      }
    }
    return ids;
  }, [itemFilterId]);

  const searchQuery = searchParams.get("q") ?? "";
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);
  const listStateKey = useMemo(
    () => buildNavigationStateKey(location.pathname, searchParams),
    [location.pathname, searchParams],
  );
  useSessionScrollRestore(listStateKey, gridContainerRef);
  const currentReturnTo = useMemo(
    () => buildReturnToValue(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const initialSortModel = useMemo(() => readUrlGridSort(searchParams), [searchParams]);
  const columnFilterModel = useMemo(() => readUrlAgGridColumnFilters(searchParams), [searchParams]);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const setQueryValue = useCallback(
    (key: string, value: string, defaultValue = "") => {
      replaceQueryParam(searchParams, setSearchParams, key, value, defaultValue);
    },
    [searchParams, setSearchParams],
  );

  const handleSortChanged = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const serialized = serializeUrlGridSort(getCurrentGridSort(api, ["selection", "lineNo"]));
    replaceQueryParam(searchParams, setSearchParams, "sort", serialized);
  }, [searchParams, setSearchParams]);

  const rowsWithNames = useMemo(() => {
    const list = salesOrderRepository.list();
    const emDash = t("domain.audit.summary.emDash");
    const unknownCarrier = t("doc.shipment.unknownCarrier");
    return list.map((so) => {
      const customer = customerRepository.getById(so.customerId);
      const warehouse = warehouseRepository.getById(so.warehouseId);
      const cid = so.carrierId?.trim() ?? "";
      let carrierLabel: string;
      let carrierExport: string;
      let carrierSearchBlob: string;
      if (cid === "") {
        carrierLabel = emDash;
        carrierExport = "";
        carrierSearchBlob = "";
      } else {
        const car = carrierRepository.getById(cid);
        if (!car) {
          carrierLabel = unknownCarrier;
          carrierExport = unknownCarrier;
          carrierSearchBlob = `${unknownCarrier} ${cid}`.toLowerCase();
        } else {
          carrierLabel = car.name;
          carrierExport = car.name;
          carrierSearchBlob = [car.name, car.code, cid].filter(Boolean).join(" ").toLowerCase();
        }
      }
      const recName = so.recipientName?.trim() ?? "";
      const recPhone = so.recipientPhone?.trim() ?? "";
      const recipientLabel = recName === "" ? emDash : recName;
      const recipientPhoneLabel = recPhone === "" ? emDash : recPhone;
      const recipientSearchBlob = [recName, recPhone].filter(Boolean).join(" ").toLowerCase();
      return {
        ...so,
        customerName: customer?.name ?? so.customerId,
        warehouseName: warehouse?.name ?? so.warehouseId,
        carrierLabel,
        carrierExport,
        carrierSearchBlob,
        recipientLabel,
        recipientPhoneLabel,
        recipientExport: recName,
        recipientPhoneExport: recPhone,
        recipientSearchBlob,
      };
    });
  }, [t, locale]);

  const filteredRows = useMemo(() => {
    let next = filterBySearch(rowsWithNames, searchQuery);
    next = filterByCustomerId(next, customerFilterId);
    next = filterByWarehouseId(next, warehouseFilterId);
    next = filterByCarrierId(next, carrierFilterId);
    next = filterByDocumentIdSet(next, salesOrderIdsContainingItem);
    return next;
  }, [
    rowsWithNames,
    searchQuery,
    customerFilterId,
    warehouseFilterId,
    carrierFilterId,
    salesOrderIdsContainingItem,
  ]);

  const hasFilter =
    searchQuery.trim() !== "" ||
    customerFilterId != null ||
    warehouseFilterId != null ||
    carrierFilterId != null ||
    itemFilterId != null ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const customerFilterLabel = useMemo((): string => {
    if (customerFilterId == null) return "";
    const c = customerRepository.getById(customerFilterId);
    if (c) return c.name || c.code || customerFilterId;
    return customerFilterId;
  }, [customerFilterId]);

  const clearCustomerFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("customerId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const carrierFilterLabel = useMemo((): string => {
    if (carrierFilterId == null) return "";
    const c = carrierRepository.getById(carrierFilterId);
    if (c) return c.name || c.code || carrierFilterId;
    return carrierFilterId;
  }, [carrierFilterId]);

  const clearCarrierFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("carrierId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const emDash = t("domain.audit.summary.emDash");
  const planningStatusOptions = useMemo(
    () => [
      { value: "draft", label: t("status.planning.draft") },
      { value: "confirmed", label: t("status.planning.confirmed") },
      { value: "closed", label: t("status.planning.closed") },
      { value: "cancelled", label: t("status.planning.cancelled") },
    ],
    [t, locale],
  );

  const itemFilterLabel = useMemo((): string => {
    if (itemFilterId == null) return "";
    const it = itemRepository.getById(itemFilterId);
    if (it) {
      const code = it.code?.trim() ?? "";
      const name = it.name?.trim() ?? "";
      if (code && name) return `${code} ${emDash} ${name}`;
      return code || name || itemFilterId;
    }
    return itemFilterId;
  }, [itemFilterId, emDash]);

  const getExportRowsSelected = useCallback((): SalesOrdersExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromSO(rows);
  }, []);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension });
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) return;
        const safePath = await ensureUniqueExportPath(path);

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
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

  const listExcelLabels = useMemo(() => salesOrdersListExcelLabels(t), [t, locale]);

  const emptyTitle = hasFilter
    ? t("ops.list.salesOrders.emptyFiltered")
    : t("ops.list.salesOrders.emptyDefault");
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return t("ops.list.salesOrders.hintCreate");
    }
    if (
      customerFilterId != null &&
      warehouseFilterId == null &&
      itemFilterId == null &&
      carrierFilterId == null &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.salesOrders.hintCustomerOnly");
    }
    if (
      warehouseFilterId != null &&
      itemFilterId == null &&
      customerFilterId == null &&
      carrierFilterId == null &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.salesOrders.hintWarehouseOnly");
    }
    if (
      itemFilterId != null &&
      warehouseFilterId == null &&
      customerFilterId == null &&
      carrierFilterId == null &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.salesOrders.hintItemOnly");
    }
    if (
      carrierFilterId != null &&
      customerFilterId == null &&
      warehouseFilterId == null &&
      itemFilterId == null &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.salesOrders.hintCarrierOnly");
    }
    return t("ops.list.salesOrders.hintUrlFilters");
  }, [
    hasFilter,
    customerFilterId,
    warehouseFilterId,
    carrierFilterId,
    itemFilterId,
    searchQuery,
    t,
    locale,
  ]);

  const salesOrderColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<RowData>>>(
    () => ({
      number: { kind: "text" },
      date: { kind: "date" },
      customerName: {
        kind: "enum",
        options: Array.from(new Set(rowsWithNames.map((row) => row.customerName)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      warehouseName: {
        kind: "enum",
        options: Array.from(new Set(rowsWithNames.map((row) => row.warehouseName)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      carrierLabel: { kind: "text" },
      recipientLabel: { kind: "text" },
      recipientPhoneLabel: { kind: "text" },
      status: {
        kind: "enum",
        options: planningStatusOptions,
      },
    }),
    [rowsWithNames, planningStatusOptions],
  );

  const displayRows = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, salesOrderColumnFilterConfigs),
    [filteredRows, columnFilterModel, salesOrderColumnFilterConfigs],
  );

  const isEmpty = displayRows.length === 0;

  const getExportRowsCurrentView = useCallback((): SalesOrdersExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromSO(displayRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromSO(rows);
  }, [displayRows]);

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("sales-orders.xlsx", () => buildSalesOrdersListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsCurrentView, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("sales-orders-selected.xlsx", () => buildSalesOrdersListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsSelected, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const handleApplyColumnFilter = useCallback(
    (colId: string, clause: AgGridColumnFilterClause) => {
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, {
        ...columnFilterModel,
        [colId]: clause,
      });
    },
    [columnFilterModel, searchParams, setSearchParams],
  );

  const handleResetColumnFilter = useCallback(
    (colId: string) => {
      const nextModel = { ...columnFilterModel };
      delete nextModel[colId];
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, nextModel);
    },
    [columnFilterModel, searchParams, setSearchParams],
  );

  const baseColumnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      getAgGridRowNumberColDef(t),
      {
        field: "number",
        headerName: t("doc.columns.number"),
        width: 150,
      },
      {
        field: "date",
        headerName: t("doc.columns.date"),
        width: 140,
        valueFormatter: (params) => normalizeDateForSO(params.value),
      },
      {
        field: "customerName",
        headerName: t("doc.columns.customer"),
        minWidth: 180,
      },
      {
        field: "warehouseName",
        headerName: t("doc.columns.warehouse"),
        minWidth: 160,
      },
      {
        field: "carrierLabel",
        headerName: t("doc.so.carrier"),
        minWidth: 140,
        maxWidth: 220,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "recipientLabel",
        headerName: t("doc.shipment.recipientName"),
        minWidth: 130,
        maxWidth: 200,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "recipientPhoneLabel",
        headerName: t("doc.shipment.recipientPhone"),
        minWidth: 120,
        maxWidth: 160,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "status",
        headerName: t("doc.columns.status"),
        width: 130,
        cellRenderer: AgGridPlanningStatusCellRenderer,
      },
    ],
    [t, locale],
  );

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        baseColumnDefs,
        salesOrderColumnFilterConfigs,
        columnFilterModel,
        handleApplyColumnFilter,
        handleResetColumnFilter,
      ),
    [
      baseColumnDefs,
      salesOrderColumnFilterConfigs,
      columnFilterModel,
      handleApplyColumnFilter,
      handleResetColumnFilter,
    ],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.list.salesOrders.searchPlaceholder")}
            value={searchQuery}
            onChange={(value) => setQueryValue("q", value)}
            aria-label={t("ops.list.salesOrders.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="flex flex-row flex-wrap items-center gap-2 shrink-0 ml-auto justify-end">
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.salesOrders.filterWarehouseAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.columns.warehouse")}</span>
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
            {carrierFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.salesOrders.filterCarrierAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.so.carrier")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={carrierFilterLabel}
                >
                  {carrierFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCarrierFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {itemFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,20rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.salesOrders.filterItemAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.page.itemLabel")}</span>
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
            {customerFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.salesOrders.filterCustomerAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.columns.customer")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={customerFilterLabel}
                >
                  {customerFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCustomerFilter}
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
                className="h-[1.625rem] rounded-r-none border-0 border-r border-input !px-1 !py-0 !gap-0.5"
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
                    className="h-[1.625rem] w-[1.625rem] shrink-0 rounded-l-none border-0 shadow-none"
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
          <Button
            type="button"
            variant="default"
            size="sm"
            className="list-page__create-btn rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate(appendReturnTo("/sales-orders/new", currentReturnTo))}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg> {t("doc.list.create")}
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer ref={gridContainerRef} themeClass="sales-orders-grid">
            <AgGridReact<RowData>
              {...agGridDefaultGridOptions}
              ref={gridRef}
              rowData={displayRows}
              columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            onGridReady={(event) => applyUrlGridSort(event.api, initialSortModel)}
            onSortChanged={handleSortChanged}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => {
              if (hasMeaningfulTextSelection()) return;
              if (e.data) navigate(appendReturnTo(`/sales-orders/${e.data.id}`, currentReturnTo));
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
