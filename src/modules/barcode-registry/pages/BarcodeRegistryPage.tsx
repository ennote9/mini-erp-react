import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClickedEvent, SelectionChangedEvent } from "ag-grid-community";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, File, FileSpreadsheet, FolderOpen, ScanBarcode, TicketPercent, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { itemRepository, type ItemBarcodeSymbology } from "@/modules/items";
import { useTranslation } from "@/shared/i18n/context";
import { barcodeRegistryListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  AgGridActiveBooleanCellRenderer,
  AgGridContainer,
  GridOutlinePillBadge,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
  agGridSelectionColumnDef,
  hasMeaningfulTextSelection,
} from "@/shared/ui/ag-grid";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { BackButton } from "@/shared/ui/list/BackButton";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import {
  buildBarcodeRegistryListXlsxBuffer,
  type BarcodeRegistryExportRow,
} from "../barcodeRegistryListExport";
import {
  listBarcodeRegistryRows,
  type BarcodeRegistryEntryType,
  type BarcodeRegistryRow,
  type BarcodeRegistrySource,
} from "../barcodeRegistryReadModel";

type EntryTypeFilter = "all" | BarcodeRegistryEntryType;
type ActiveFilter = "all" | "active" | "inactive";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function EntryTypeCellRenderer(params: ICellRendererParams<BarcodeRegistryRow, BarcodeRegistryEntryType>) {
  if (params.value === "MARKDOWN_CODE") {
    return (
      <GridOutlinePillBadge tone="warning">
        <TicketPercent className="mr-1 h-3 w-3" />
        {params.context.entryTypeLabel(params.value)}
      </GridOutlinePillBadge>
    );
  }
  return (
    <GridOutlinePillBadge tone="muted">
      <ScanBarcode className="mr-1 h-3 w-3" />
      {params.context.entryTypeLabel(params.value ?? "ITEM_BARCODE")}
    </GridOutlinePillBadge>
  );
}

function filterRows(
  rows: BarcodeRegistryRow[],
  searchQuery: string,
  entryType: EntryTypeFilter,
  active: ActiveFilter,
  itemId: string,
  source: string,
): BarcodeRegistryRow[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (q !== "" && !row.code.toLowerCase().includes(q)) return false;
    if (entryType !== "all" && row.entryType !== entryType) return false;
    if (active === "active" && !row.isActive) return false;
    if (active === "inactive" && row.isActive) return false;
    if (itemId !== "all" && row.itemId !== itemId) return false;
    if (source !== "all" && row.source !== source) return false;
    return true;
  });
}

export function BarcodeRegistryPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const appRevision = useAppReadModelRevision();
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact<BarcodeRegistryRow> | null>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const [searchQuery, setSearchQuery] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryTypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [itemFilterId, setItemFilterId] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedCount, setSelectedCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);

  const entryTypeLabel = useCallback(
    (value: BarcodeRegistryEntryType) =>
      value === "ITEM_BARCODE"
        ? t("ops.list.barcodeRegistry.entryTypeItemBarcode")
        : t("ops.list.barcodeRegistry.entryTypeMarkdownCode"),
    [t],
  );

  const sourceLabel = useCallback(
    (value: BarcodeRegistrySource) => {
      if (value === "MARKDOWN_JOURNAL") return t("ops.list.barcodeRegistry.sourceMarkdownJournal");
      return t(`master.item.barcodes.sources.${value}`);
    },
    [t],
  );

  const symbologyLabel = useCallback(
    (value?: ItemBarcodeSymbology) =>
      value ? t(`master.item.barcodes.types.${value}`) : t("domain.audit.summary.emDash"),
    [t],
  );

  const markdownStatusLabel = useCallback(
    (value?: string) => (value ? t(`markdown.status.${value}`) : t("domain.audit.summary.emDash")),
    [t],
  );

  const rows = useMemo(() => listBarcodeRegistryRows(), [appRevision]);

  const itemOptions = useMemo(() => {
    const uniqueIds = new Set(rows.map((row) => row.itemId));
    return itemRepository
      .list()
      .filter((item) => uniqueIds.has(item.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => ({
        value: item.id,
        label: `${item.code} — ${item.name}`,
      }));
  }, [rows, appRevision]);

  const sourceOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.source))];
    return values
      .sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b), locale))
      .map((value) => ({
        value,
        label: sourceLabel(value),
      }));
  }, [rows, sourceLabel, locale]);

  const filteredRows = useMemo(
    () => filterRows(rows, searchQuery, entryTypeFilter, activeFilter, itemFilterId, sourceFilter),
    [rows, searchQuery, entryTypeFilter, activeFilter, itemFilterId, sourceFilter],
  );

  const hasFilter =
    searchQuery.trim() !== "" ||
    entryTypeFilter !== "all" ||
    activeFilter !== "all" ||
    itemFilterId !== "all" ||
    sourceFilter !== "all";

  const buildExportRows = useCallback(
    (inputRows: BarcodeRegistryRow[]): BarcodeRegistryExportRow[] =>
      inputRows.map((row, idx) => ({
        no: idx + 1,
        code: row.code,
        entryType: entryTypeLabel(row.entryType),
        itemCode: row.itemCode,
        itemName: row.itemName,
        active: row.isActive ? t("ops.master.exportActiveYes") : t("ops.master.exportActiveNo"),
        source: sourceLabel(row.source),
        created: row.createdAt ?? "",
        symbology: row.symbology ? symbologyLabel(row.symbology) : "",
        markdownJournal: row.markdownJournalNumber ?? "",
        status: row.markdownStatus ? markdownStatusLabel(row.markdownStatus) : "",
      })),
    [entryTypeLabel, markdownStatusLabel, sourceLabel, symbologyLabel, t],
  );

  const getExportRowsCurrentView = useCallback((): BarcodeRegistryExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRows(filteredRows);
    const exportRows: BarcodeRegistryRow[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) exportRows.push(rowNode.data);
    });
    return buildExportRows(exportRows);
  }, [buildExportRows, filteredRows]);

  const getExportRowsSelected = useCallback((): BarcodeRegistryExportRow[] => {
    const api = gridRef.current?.api;
    const selectedRows = api ? (api.getSelectedRows() as BarcodeRegistryRow[]) : [];
    return buildExportRows(selectedRows);
  }, [buildExportRows]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension: "xlsx" });
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

  const listExcelLabels = useMemo(() => barcodeRegistryListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const exportRows = getExportRowsCurrentView();
    runExportWithSaveAs("barcode-registry.xlsx", () =>
      buildBarcodeRegistryListXlsxBuffer(exportRows, listExcelLabels),
    );
  }, [getExportRowsCurrentView, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const exportRows = getExportRowsSelected();
    if (exportRows.length === 0) return;
    runExportWithSaveAs("barcode-registry-selected.xlsx", () =>
      buildBarcodeRegistryListXlsxBuffer(exportRows, listExcelLabels),
    );
  }, [getExportRowsSelected, listExcelLabels, runExportWithSaveAs]);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<BarcodeRegistryRow>) => {
    setSelectedCount(event.api.getSelectedRows().length);
  }, []);

  const onRowClicked = useCallback(
    (event: RowClickedEvent<BarcodeRegistryRow>) => {
      if (hasMeaningfulTextSelection()) return;
      if (!event.data) return;
      navigate(event.data.nativePath);
    },
    [navigate],
  );

  const columnDefs = useMemo<ColDef<BarcodeRegistryRow>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "code",
        headerName: t("exportExcel.list.colCode"),
        minWidth: 170,
        width: 190,
      },
      {
        field: "entryType",
        headerName: t("exportExcel.list.colEntryType"),
        minWidth: 140,
        width: 160,
        cellRenderer: EntryTypeCellRenderer,
      },
      {
        field: "itemCode",
        headerName: t("exportExcel.list.colItemCode"),
        minWidth: 120,
        width: 140,
      },
      {
        field: "itemName",
        headerName: t("exportExcel.list.colItemName"),
        minWidth: 220,
        flex: 1,
      },
      {
        field: "isActive",
        headerName: t("exportExcel.list.colActive"),
        minWidth: 110,
        width: 120,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
      {
        field: "source",
        headerName: t("exportExcel.list.colSource"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => sourceLabel(params.value as BarcodeRegistrySource),
      },
      {
        field: "createdAt",
        headerName: t("exportExcel.list.colCreated"),
        minWidth: 160,
        width: 180,
        valueFormatter: (params) => params.value || t("domain.audit.summary.emDash"),
      },
      {
        field: "symbology",
        headerName: t("exportExcel.list.colSymbology"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => symbologyLabel(params.value as ItemBarcodeSymbology | undefined),
      },
      {
        field: "markdownJournalNumber",
        headerName: t("exportExcel.list.colMarkdownJournal"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => params.value || t("domain.audit.summary.emDash"),
      },
      {
        field: "markdownStatus",
        headerName: t("exportExcel.list.colRecordStatus"),
        minWidth: 120,
        width: 140,
        valueFormatter: (params) => markdownStatusLabel(params.value as string | undefined),
      },
    ],
    [markdownStatusLabel, sourceLabel, symbologyLabel, t],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
            <ListPageSearch
              inputRef={listSearchInputRef}
              placeholder={t("ops.list.barcodeRegistry.searchPlaceholder")}
              value={searchQuery}
              onChange={setSearchQuery}
              aria-label={t("ops.list.barcodeRegistry.searchAria")}
              resultCount={filteredRows.length}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {exportSuccess && (
                <div className="flex h-8 max-w-[min(100%,24rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                  <span className="text-xs text-muted-foreground">{t("doc.list.exportCompleted")}</span>
                  <span className="max-w-[12rem] truncate text-xs font-medium" title={exportSuccess.filename}>
                    {exportSuccess.filename}
                  </span>
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
                        disabled={selectedCount === 0}
                        className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        title={selectedCount === 0 ? t("doc.list.selectRowsForExport") : undefined}
                        onClick={() => {
                          setExportOpen(false);
                          if (selectedCount > 0) handleExportSelected();
                        }}
                      >
                        {t("doc.list.exportSelectedRows")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={selectClassName}
              aria-label={t("ops.list.barcodeRegistry.entryTypeFilterAria")}
              value={entryTypeFilter}
              onChange={(event) => setEntryTypeFilter(event.target.value as EntryTypeFilter)}
            >
              <option value="all">{t("ops.list.barcodeRegistry.filterAllEntryTypes")}</option>
              <option value="ITEM_BARCODE">{t("ops.list.barcodeRegistry.entryTypeItemBarcode")}</option>
              <option value="MARKDOWN_CODE">{t("ops.list.barcodeRegistry.entryTypeMarkdownCode")}</option>
            </select>
            <select
              className={selectClassName}
              aria-label={t("ops.list.barcodeRegistry.activeFilterAria")}
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
            >
              <option value="all">{t("ops.list.barcodeRegistry.filterAllActiveStates")}</option>
              <option value="active">{t("ops.list.barcodeRegistry.filterActiveOnly")}</option>
              <option value="inactive">{t("ops.list.barcodeRegistry.filterInactiveOnly")}</option>
            </select>
            <select
              className={selectClassName}
              aria-label={t("ops.list.barcodeRegistry.itemFilterAria")}
              value={itemFilterId}
              onChange={(event) => setItemFilterId(event.target.value)}
            >
              <option value="all">{t("ops.list.barcodeRegistry.filterAllItems")}</option>
              {itemOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className={selectClassName}
              aria-label={t("ops.list.barcodeRegistry.sourceFilterAria")}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="all">{t("ops.list.barcodeRegistry.filterAllSources")}</option>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      {filteredRows.length === 0 ? (
        <EmptyState
          title={
            hasFilter
              ? t("ops.list.barcodeRegistry.emptyFiltered")
              : t("ops.list.barcodeRegistry.emptyDefault")
          }
          hint={
            hasFilter
              ? t("ops.list.master.hintClearFilters")
              : t("ops.list.barcodeRegistry.hintReadOnly")
          }
        />
      ) : (
        <AgGridContainer themeClass="barcode-registry-grid">
          <AgGridReact<BarcodeRegistryRow>
            {...agGridDefaultGridOptions}
            context={{ entryTypeLabel }}
            ref={gridRef}
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onSelectionChanged={onSelectionChanged}
            onRowClicked={onRowClicked}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
