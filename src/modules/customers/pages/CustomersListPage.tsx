import { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { customerRepository } from "../repository";
import type { Customer } from "../model";
import { carrierRepository } from "../../carriers/repository";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  AgGridActiveBooleanCellRenderer,
  applyAgGridColumnFilters,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
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
import { buildCustomersListXlsxBuffer, type CustomersExportRow } from "../customersListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { customersListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
} from "@/shared/navigation/agGridColumnFilters";

function parseQueryId(searchParams: URLSearchParams, key: string): string | null {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function filterByPreferredCarrierId(list: Customer[], carrierId: string | null): Customer[] {
  if (carrierId == null) return list;
  return list.filter((c) => (c.preferredCarrierId?.trim() ?? "") === carrierId);
}

function filterCustomersBySearch(list: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (x) => x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
  );
}

function buildExportRowsFromCustomers(
  customers: Customer[],
  activeYes: string,
  activeNo: string,
): CustomersExportRow[] {
  return customers.map((c, idx) => ({
    no: idx + 1,
    code: c.code ?? "",
    name: c.name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    active: c.isActive ? activeYes : activeNo,
  }));
}

export function CustomersListPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preferredCarrierFilterId = useMemo(
    () => parseQueryId(searchParams, "preferredCarrierId"),
    [searchParams],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<Customer> | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<Customer>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const filteredRows = useMemo(() => {
    let next = customerRepository.list();
    next = filterByPreferredCarrierId(next, preferredCarrierFilterId);
    next = filterCustomersBySearch(next, searchQuery);
    return next;
  }, [searchQuery, preferredCarrierFilterId]);
  const columnFilterModel = useMemo(() => readUrlAgGridColumnFilters(searchParams), [searchParams]);
  const customerColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<Customer>>>(
    () => ({
      code: { kind: "text" },
      name: { kind: "text" },
      contactPerson: { kind: "text" },
      phone: { kind: "text" },
      email: { kind: "text" },
      city: { kind: "text" },
      paymentTermsDays: { kind: "number" },
      isActive: { kind: "boolean" },
    }),
    [],
  );
  const displayRows = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, customerColumnFilterConfigs),
    [filteredRows, columnFilterModel, customerColumnFilterConfigs],
  );

  const isEmpty = displayRows.length === 0;
  const hasFilter =
    searchQuery.trim() !== "" ||
    preferredCarrierFilterId != null ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const preferredCarrierFilterLabel = useMemo((): string => {
    if (preferredCarrierFilterId == null) return "";
    const c = carrierRepository.getById(preferredCarrierFilterId);
    if (c) return c.name || c.code || preferredCarrierFilterId;
    return preferredCarrierFilterId;
  }, [preferredCarrierFilterId]);

  const clearPreferredCarrierFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("preferredCarrierId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getExportRowsCurrentView = useCallback((): CustomersExportRow[] => {
    const api = gridRef.current?.api;
    const y = t("ops.master.exportActiveYes");
    const n = t("ops.master.exportActiveNo");
    if (!api) return buildExportRowsFromCustomers(filteredRows, y, n);
    const rows: Customer[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromCustomers(rows, y, n);
  }, [filteredRows, t]);

  const getExportRowsSelected = useCallback((): CustomersExportRow[] => {
    const api = gridRef.current?.api;
    const rows: Customer[] = api ? (api.getSelectedRows() as Customer[]) : [];
    return buildExportRowsFromCustomers(rows, t("ops.master.exportActiveYes"), t("ops.master.exportActiveNo"));
  }, [t]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension });
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("ops.importModal.excelFileFilterName"), extensions: ["xlsx"] }],
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

  const listExcelLabels = useMemo(() => customersListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("customers.xlsx", () => buildCustomersListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsCurrentView, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("customers-selected.xlsx", () => buildCustomersListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsSelected, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter ? t("ops.list.customers.emptyFiltered") : t("ops.list.customers.emptyDefault");
  const emptyHint = useMemo(() => {
    if (!hasFilter) return t("ops.list.customers.hintCreate");
    if (
      preferredCarrierFilterId != null &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.customers.hintPreferredCarrierOnly");
    }
    return t("ops.list.customers.hintFilter");
  }, [hasFilter, preferredCarrierFilterId, searchQuery, t]);

  const emDash = t("domain.audit.summary.emDash");

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

  const baseColumnDefs = useMemo<ColDef<Customer>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "code",
        headerName: t("doc.columns.code"),
        width: 140,
      },
      {
        field: "name",
        headerName: t("doc.columns.name"),
        minWidth: 180,
        flex: 1,
      },
      {
        field: "contactPerson",
        headerName: t("doc.columns.contactPerson"),
        width: 140,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "phone",
        headerName: t("doc.columns.phone"),
        width: 150,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "email",
        headerName: t("doc.columns.email"),
        minWidth: 180,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "city",
        headerName: t("doc.columns.city"),
        width: 120,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "paymentTermsDays",
        headerName: t("doc.columns.paymentTerms"),
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? t("doc.summary.paymentTermsDays", { days: params.value })
            : emDash,
      },
      {
        field: "isActive",
        headerName: t("doc.columns.active"),
        width: 110,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
    ],
    [t, locale, emDash],
  );

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        baseColumnDefs,
        customerColumnFilterConfigs,
        columnFilterModel,
        handleApplyColumnFilter,
        handleResetColumnFilter,
      ),
    [
      baseColumnDefs,
      customerColumnFilterConfigs,
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
            placeholder={t("ops.list.customers.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.list.customers.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="flex flex-row flex-wrap items-center gap-2 shrink-0 ml-auto justify-end">
            {preferredCarrierFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.customers.filterPreferredCarrierAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.list.customers.preferredCarrierChipLabel")}
                </span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={preferredCarrierFilterLabel}
                >
                  {preferredCarrierFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearPreferredCarrierFilter}
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
            onClick={() => navigate("/customers/new")}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg> {t("doc.list.create")}
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="customers-grid">
          <AgGridReact<Customer>
            {...agGridDefaultGridOptions}
            ref={gridRef}
            rowData={displayRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => {
              if (hasMeaningfulTextSelection()) return;
              if (e.data) navigate(`/customers/${e.data.id}`);
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
