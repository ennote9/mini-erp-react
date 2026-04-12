import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, File, FileSpreadsheet, FolderOpen, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { markdownRepository } from "../repository";
import { markdownJournalRepository } from "../journalRepository";
import { markdownJournalLineRepository } from "../journalLineRepository";
import type { MarkdownJournalStatus } from "../model";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import {
  AgGridColumnSettingsModal,
  AgGridContainer,
  applyAgGridColumnFilters,
  applyDeepSortModel,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridSelectionColumnDef,
  buildAgGridNoRowsOverlayTemplate,
  buildExportMatrixFromRowNodes,
  collectFilteredSortedRowNodes,
  decorateAgGridColumnDefsWithFilters,
  getAgGridNoRowsOverlayContent,
  getAgGridRowNumberColDef,
  getVisibleAgGridExportColumns,
  hasMeaningfulTextSelection,
  type AgGridColumnFilterConfig,
  useAgGridColumnFilterBridge,
  useAgGridColumnSettings,
  useAgGridNoRowsOverlayLifecycle,
} from "@/shared/ui/ag-grid";
import {
  MARKDOWN_JOURNAL_STATUS_FILTERS,
} from "../pageConfig";
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
  withUrlAgGridColumnFilters,
} from "@/shared/navigation/agGridColumnFilters";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";

type MarkdownRegisterView = "journals" | "codes";

type JournalRow = {
  id: string;
  number: string;
  status: MarkdownJournalStatus;
  sourceWarehouseLabel: string;
  targetWarehouseLabel: string;
  lineCount: number;
  totalQty: number;
  createdAt: string;
  postedAt: string;
  comment: string;
};

type MarkdownCodeRow = {
  id: string;
  journalId: string;
  journalNumber: string;
  itemId: string;
  markdownCode: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  warehouseLabel: string;
  statusLabel: string;
  reasonLabel: string;
  postedAt: string;
};

type ActiveRow = JournalRow | MarkdownCodeRow;

function journalStatusLabel(
  status: MarkdownJournalStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case "draft":
      return t("status.factual.draft");
    case "posted":
      return t("status.factual.posted");
    case "cancelled":
      return t("status.factual.cancelled");
    default:
      return status;
  }
}

function warehouseLabelFor(id: string): string {
  const warehouse = warehouseRepository.getById(id);
  return warehouse ? `${warehouse.code} — ${warehouse.name}` : id;
}

export function MarkdownJournalPage() {
  const { t } = useTranslation();
  const { formatMoney } = useAppDisplayFormatters();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";
  const viewFromQuery = searchParams.get("view");

  const search = searchParams.get("q") ?? "";
  const [view, setView] = useState<MarkdownRegisterView>(
    viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals",
  );
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact<ActiveRow> | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
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
  const initialSortModel = useMemo(
    () => readUrlGridSort(new URLSearchParams(location.search)),
    [location.search],
  );
  const columnFilterModel = useMemo(
    () => readUrlAgGridColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );

  useEffect(() => {
    setRuntimeSortSerialized(serializeUrlGridSort(initialSortModel));
  }, [initialSortModel]);

  useEffect(() => {
    const nextView = viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals";
    setView(nextView);
  }, [viewFromQuery]);

  const createTarget = useMemo(() => {
    if (!prefillItemId) return "/markdown-journal/new";
    return `/markdown-journal/new?itemId=${encodeURIComponent(prefillItemId)}`;
  }, [prefillItemId]);

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
    setRuntimeSortSerialized(serialized);
    replaceQueryParam(searchParams, setSearchParams, "sort", serialized);
  }, [searchParams, setSearchParams]);

  const journalRows = useMemo<JournalRow[]>(() => {
    return markdownJournalRepository
      .list()
      .map((journal) => {
        const lines = markdownJournalLineRepository.listByJournalId(journal.id);
        return {
          id: journal.id,
          number: journal.number,
          status: journal.status,
          sourceWarehouseLabel: warehouseLabelFor(journal.sourceWarehouseId),
          targetWarehouseLabel: warehouseLabelFor(journal.targetWarehouseId),
          lineCount: lines.length,
          totalQty: lines.reduce((sum, line) => sum + line.quantity, 0),
          createdAt: journal.createdAt,
          postedAt: journal.postedAt ?? t("domain.audit.summary.emDash"),
          comment: journal.comment ?? "",
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [appRevision, t]);

  const filteredJournalRows = useMemo(() => {
    let base = journalRows;
    if (prefillItemId) {
      const allowed = new Set(
        markdownJournalLineRepository
          .list()
          .filter((line) => line.itemId === prefillItemId)
          .map((line) => line.journalId),
      );
      base = base.filter((row) => allowed.has(row.id));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((row) => {
        if (row.number.toLowerCase().includes(q)) return true;
        if (row.sourceWarehouseLabel.toLowerCase().includes(q)) return true;
        if (row.targetWarehouseLabel.toLowerCase().includes(q)) return true;
        if (row.comment.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return base;
  }, [journalRows, prefillItemId, search, appRevision]);

  const journalColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<JournalRow>>>(
    () => ({
      number: { kind: "text" },
      status: {
        kind: "enum",
        options: MARKDOWN_JOURNAL_STATUS_FILTERS
          .filter((value): value is MarkdownJournalStatus => value !== "all")
          .map((value) => ({ value, label: journalStatusLabel(value, t) })),
      },
      sourceWarehouseLabel: {
        kind: "enum",
        options: Array.from(new Set(journalRows.map((row) => row.sourceWarehouseLabel)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      targetWarehouseLabel: {
        kind: "enum",
        options: Array.from(new Set(journalRows.map((row) => row.targetWarehouseLabel)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      lineCount: { kind: "number" },
      totalQty: { kind: "number" },
      createdAt: { kind: "datetime" },
      postedAt: { kind: "datetime" },
    }),
    [journalRows, t],
  );

  const displayJournalRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredJournalRows, columnFilterModel, journalColumnFilterConfigs),
    [filteredJournalRows, columnFilterModel, journalColumnFilterConfigs],
  );

  const codeRows = useMemo<MarkdownCodeRow[]>(() => {
    return markdownJournalRepository
      .list()
      .filter((journal) => journal.status === "posted")
      .flatMap((journal) => {
        return markdownRepository.list()
          .filter((record) => {
            if (record.journalId === journal.id) return true;
            if (!journal.legacySourceIds || journal.legacySourceIds.length === 0) return false;
            const batchId = record.batchId?.trim();
            return journal.legacySourceIds.includes(record.id) || (!!batchId && journal.legacySourceIds.includes(batchId));
          })
          .map((record) => {
            const item = itemRepository.getById(record.itemId);
            return {
              id: record.id,
              journalId: journal.id,
              journalNumber: record.journalNumber ?? journal.number,
              itemId: record.itemId,
              markdownCode: record.markdownCode,
              itemCode: item?.code ?? record.itemId,
              itemName: item?.name ?? record.itemId,
              quantity: 1,
              markdownPrice: record.markdownPrice,
              warehouseLabel: warehouseLabelFor(record.warehouseId),
              statusLabel: t(`markdown.status.${record.status}`),
              reasonLabel: t(`markdown.reason.${record.reasonCode}`),
              postedAt: journal.postedAt ?? record.createdAt,
            };
          });
      })
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt) || b.journalNumber.localeCompare(a.journalNumber));
  }, [appRevision, t]);

  const filteredCodeRows = useMemo(() => {
    let base = codeRows;
    if (prefillItemId) {
      base = base.filter((row) => row.itemId === prefillItemId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((row) => {
        if (row.journalNumber.toLowerCase().includes(q)) return true;
        if (row.markdownCode.toLowerCase().includes(q)) return true;
        if (row.itemCode.toLowerCase().includes(q)) return true;
        if (row.itemName.toLowerCase().includes(q)) return true;
        if (row.warehouseLabel.toLowerCase().includes(q)) return true;
        if (row.statusLabel.toLowerCase().includes(q)) return true;
        if (row.reasonLabel.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return base;
  }, [codeRows, prefillItemId, search]);

  const codeColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<MarkdownCodeRow>>>(
    () => ({
      markdownCode: { kind: "text" },
      journalNumber: { kind: "text" },
      itemCode: { kind: "text" },
      itemName: { kind: "text" },
      quantity: { kind: "number" },
      markdownPrice: { kind: "number" },
      warehouseLabel: {
        kind: "enum",
        options: Array.from(new Set(codeRows.map((row) => row.warehouseLabel)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      statusLabel: {
        kind: "enum",
        options: Array.from(new Set(codeRows.map((row) => row.statusLabel)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      reasonLabel: {
        kind: "enum",
        options: Array.from(new Set(codeRows.map((row) => row.reasonLabel)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      postedAt: { kind: "datetime" },
    }),
    [codeRows],
  );

  const displayCodeRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredCodeRows, columnFilterModel, codeColumnFilterConfigs),
    [filteredCodeRows, columnFilterModel, codeColumnFilterConfigs],
  );

  const baseJournalColumnDefs = useMemo<ColDef<JournalRow>[]>(
    () => [
      getAgGridRowNumberColDef(t),
      {
        field: "number",
        headerName: t("doc.columns.number"),
        minWidth: 150,
        width: 170,
      },
      {
        field: "status",
        headerName: t("common.status"),
        minWidth: 120,
        width: 130,
        valueFormatter: (params) => (params.value ? journalStatusLabel(params.value, t) : ""),
      },
      {
        field: "sourceWarehouseLabel",
        headerName: t("markdown.fields.sourceWarehouse"),
        minWidth: 180,
        width: 190,
      },
      {
        field: "targetWarehouseLabel",
        headerName: t("markdown.fields.targetWarehouse"),
        minWidth: 180,
        flex: 1,
      },
      {
        field: "lineCount",
        headerName: t("markdown.fields.lineCount"),
        width: 100,
        minWidth: 90,
      },
      {
        field: "totalQty",
        headerName: t("markdown.fields.totalQty"),
        width: 120,
        minWidth: 110,
      },
      {
        field: "createdAt",
        headerName: t("markdown.fields.createdAt"),
        minWidth: 180,
        width: 200,
      },
      {
        field: "postedAt",
        headerName: t("markdown.fields.postedAt"),
        minWidth: 180,
        width: 200,
      },
    ],
    [t],
  );

  const baseCodeColumnDefs = useMemo<ColDef<MarkdownCodeRow>[]>(
    () => [
      getAgGridRowNumberColDef(t),
      {
        field: "markdownCode",
        headerName: t("markdown.fields.markdownCode"),
        width: 150,
        minWidth: 140,
      },
      {
        field: "journalNumber",
        headerName: t("markdown.fields.journalNumber"),
        width: 150,
        minWidth: 140,
      },
      {
        field: "itemCode",
        headerName: t("doc.columns.itemCode"),
        width: 120,
        minWidth: 110,
      },
      {
        field: "itemName",
        headerName: t("doc.columns.itemName"),
        minWidth: 220,
        flex: 1,
      },
      {
        field: "quantity",
        headerName: t("doc.columns.qty"),
        width: 90,
        minWidth: 80,
      },
      {
        field: "markdownPrice",
        headerName: t("markdown.fields.markdownPrice"),
        width: 140,
        minWidth: 130,
        valueFormatter: (params) =>
          typeof params.value === "number" ? formatMoney(params.value, 2, "") : "",
      },
      {
        field: "warehouseLabel",
        headerName: t("markdown.fields.targetWarehouse"),
        minWidth: 160,
        width: 180,
      },
      {
        field: "statusLabel",
        headerName: t("common.status"),
        minWidth: 120,
        width: 130,
      },
      {
        field: "reasonLabel",
        headerName: t("markdown.fields.reason"),
        minWidth: 180,
        width: 220,
      },
      {
        field: "postedAt",
        headerName: t("markdown.fields.postedAt"),
        minWidth: 180,
        width: 200,
      },
    ],
    [t, formatMoney],
  );

  const journalSettings = useAgGridColumnSettings<JournalRow>({
    pageKey: "markdown-journal:journals",
    entityType: "markdown-journal-journals",
    baseColumnDefs: baseJournalColumnDefs,
  });
  const codeSettings = useAgGridColumnSettings<MarkdownCodeRow>({
    pageKey: "markdown-journal:codes",
    entityType: "markdown-journal-codes",
    baseColumnDefs: baseCodeColumnDefs,
  });

  const journalEffectiveSortModel = useMemo(() => {
    const params = new URLSearchParams();
    if (runtimeSortSerialized !== "") params.set("sort", runtimeSortSerialized);
    const runtime = readUrlGridSort(params);
    return runtime.length > 0 ? runtime : journalSettings.deepSortModel;
  }, [runtimeSortSerialized, journalSettings.deepSortModel]);

  const codeEffectiveSortModel = useMemo(() => {
    const params = new URLSearchParams();
    if (runtimeSortSerialized !== "") params.set("sort", runtimeSortSerialized);
    const runtime = readUrlGridSort(params);
    return runtime.length > 0 ? runtime : codeSettings.deepSortModel;
  }, [runtimeSortSerialized, codeSettings.deepSortModel]);

  const resolveJournalSortValue = useCallback(
    (row: JournalRow, fieldKey: string): unknown => {
      const config = journalColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [journalColumnFilterConfigs],
  );
  const resolveCodeSortValue = useCallback(
    (row: MarkdownCodeRow, fieldKey: string): unknown => {
      const config = codeColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [codeColumnFilterConfigs],
  );

  const displayJournalRows = useMemo(
    () =>
      applyDeepSortModel({
        rows: applyAgGridColumnFilters(
          displayJournalRowsWithQueryFilters,
          journalSettings.deepFilterModel,
          journalColumnFilterConfigs,
        ),
        sortModel: journalEffectiveSortModel,
        getFieldValue: resolveJournalSortValue,
      }),
    [
      displayJournalRowsWithQueryFilters,
      journalSettings.deepFilterModel,
      journalColumnFilterConfigs,
      journalEffectiveSortModel,
      resolveJournalSortValue,
    ],
  );

  const displayCodeRows = useMemo(
    () =>
      applyDeepSortModel({
        rows: applyAgGridColumnFilters(
          displayCodeRowsWithQueryFilters,
          codeSettings.deepFilterModel,
          codeColumnFilterConfigs,
        ),
        sortModel: codeEffectiveSortModel,
        getFieldValue: resolveCodeSortValue,
      }),
    [
      displayCodeRowsWithQueryFilters,
      codeSettings.deepFilterModel,
      codeColumnFilterConfigs,
      codeEffectiveSortModel,
      resolveCodeSortValue,
    ],
  );

  const isJournalView = view === "journals";
  const activeRows = isJournalView ? displayJournalRows : displayCodeRows;
  const activeSettings = isJournalView ? journalSettings : codeSettings;
  const activeFilterConfigs = isJournalView ? journalColumnFilterConfigs : codeColumnFilterConfigs;
  const activeEntityType = isJournalView ? "markdown-journal-journals" : "markdown-journal-codes";
  const activeSortModel = isJournalView ? journalEffectiveSortModel : codeEffectiveSortModel;

  const searchActive = search.trim() !== "";
  const filtersActive =
    prefillItemId !== "" ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const baseRowsCount = isJournalView ? journalRows.length : codeRows.length;
  const noRowsOverlayTemplate = useMemo(
    () =>
      buildAgGridNoRowsOverlayTemplate(
        getAgGridNoRowsOverlayContent(
          {
            baseRowCount: baseRowsCount,
            visibleRowCount: activeRows.length,
            searchActive,
            filtersActive,
          },
          t,
        ),
      ),
    [baseRowsCount, activeRows.length, searchActive, filtersActive, t],
  );

  useAgGridNoRowsOverlayLifecycle(gridRef, noRowsOverlayTemplate, activeRows.length);

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
  const columnFilterBridge = useAgGridColumnFilterBridge(
    columnFilterModel,
    handleApplyColumnFilter,
    handleResetColumnFilter,
  );

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        (activeSettings.columnDefs as ColDef<ActiveRow>[]),
        activeFilterConfigs as Record<string, AgGridColumnFilterConfig<ActiveRow>>,
        columnFilterBridge,
      ),
    [activeSettings.columnDefs, activeFilterConfigs, columnFilterBridge],
  );

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    applyUrlGridSort(api, activeSortModel);
  }, [columnDefs, activeSortModel]);

  const buildExportPayload = useCallback(
    (mode: "current" | "selected"): { headers: string[]; rows: Array<Array<string | number>> } => {
      const api = gridRef.current?.api;
      if (!api) return { headers: [], rows: [] };
      const columns = getVisibleAgGridExportColumns(api, { entityType: activeEntityType });
      const rowNodes =
        mode === "selected"
          ? api.getSelectedNodes()
          : collectFilteredSortedRowNodes(api);
      return {
        headers: columns.map((x) => x.headerName),
        rows: buildExportMatrixFromRowNodes(api, columns, rowNodes),
      };
    },
    [activeEntityType],
  );

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
        void err;
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

  const handleExportCurrentView = useCallback(() => {
    const payload = buildExportPayload("current");
    const sheetName = isJournalView ? t("markdown.journal.journalsTab") : t("markdown.journal.markdownCodesTab");
    const tableNameBase = isJournalView ? "MarkdownJournalsListView" : "MarkdownCodesListView";
    runExportWithSaveAs(
      isJournalView ? "markdown-journals.xlsx" : "markdown-codes.xlsx",
      () =>
        buildListViewXlsxBuffer({
          sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase,
        }),
    );
  }, [buildExportPayload, isJournalView, runExportWithSaveAs, t]);

  const handleExportSelected = useCallback(() => {
    const payload = buildExportPayload("selected");
    if (payload.rows.length === 0) return;
    const sheetName = isJournalView ? t("markdown.journal.journalsTab") : t("markdown.journal.markdownCodesTab");
    const tableNameBase = isJournalView ? "MarkdownJournalsListViewSelected" : "MarkdownCodesListViewSelected";
    runExportWithSaveAs(
      isJournalView ? "markdown-journals-selected.xlsx" : "markdown-codes-selected.xlsx",
      () =>
        buildListViewXlsxBuffer({
          sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase,
        }),
    );
  }, [buildExportPayload, isJournalView, runExportWithSaveAs, t]);

  const handleApplyJournalColumnSettings = useCallback(() => {
    const api = gridRef.current?.api;
    const { hiddenIds, nextItems } = journalSettings.applyDraft();
    if (api) {
      api.applyColumnState({
        state: nextItems.map((item) => ({ colId: item.id, hide: item.visible ? false : true })),
        applyOrder: true,
      });
    }
    if (hiddenIds.length === 0) return;

    const nextColumnFilterModel = { ...columnFilterModel };
    for (const colId of hiddenIds) delete nextColumnFilterModel[colId];
    const nextSortModel = journalEffectiveSortModel.filter((entry) => !hiddenIds.includes(entry.colId));
    const nextParams = withUrlAgGridColumnFilters(searchParams, nextColumnFilterModel);
    const nextSortSerialized = serializeUrlGridSort(nextSortModel);
    if (nextSortSerialized === "") nextParams.delete("sort");
    else nextParams.set("sort", nextSortSerialized);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSortSerialized);
    if (api) applyUrlGridSort(api, nextSortModel);
  }, [
    journalSettings,
    columnFilterModel,
    journalEffectiveSortModel,
    searchParams,
    setSearchParams,
  ]);

  const handleApplyCodeColumnSettings = useCallback(() => {
    const api = gridRef.current?.api;
    const { hiddenIds, nextItems } = codeSettings.applyDraft();
    if (api) {
      api.applyColumnState({
        state: nextItems.map((item) => ({ colId: item.id, hide: item.visible ? false : true })),
        applyOrder: true,
      });
    }
    if (hiddenIds.length === 0) return;

    const nextColumnFilterModel = { ...columnFilterModel };
    for (const colId of hiddenIds) delete nextColumnFilterModel[colId];
    const nextSortModel = codeEffectiveSortModel.filter((entry) => !hiddenIds.includes(entry.colId));
    const nextParams = withUrlAgGridColumnFilters(searchParams, nextColumnFilterModel);
    const nextSortSerialized = serializeUrlGridSort(nextSortModel);
    if (nextSortSerialized === "") nextParams.delete("sort");
    else nextParams.set("sort", nextSortSerialized);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSortSerialized);
    if (api) applyUrlGridSort(api, nextSortModel);
  }, [
    codeSettings,
    columnFilterModel,
    codeEffectiveSortModel,
    searchParams,
    setSearchParams,
  ]);

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ButtonGroup className="list-page__filter-group" aria-label={t("markdown.journal.title")}>
              {(["journals", "codes"] as const).map((value, index) => (
                <div key={value} className="contents">
                  {index > 0 && <ButtonGroupSeparator />}
                  <Button
                    type="button"
                    variant={view === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      if (value === "journals") next.delete("view");
                      else next.set("view", value);
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    {value === "journals"
                      ? t("markdown.journal.journalsTab")
                      : t("markdown.journal.markdownCodesTab")}
                  </Button>
                </div>
              ))}
            </ButtonGroup>
            <ListPageSearch
              inputRef={listSearchInputRef}
              placeholder={
                view === "journals"
                  ? t("markdown.journal.searchJournals")
                  : t("markdown.journal.searchMarkdownCodes")
              }
              value={search}
              onChange={(value) => setQueryValue("q", value)}
              debounceMs={220}
              aria-label={
                view === "journals"
                  ? t("markdown.journal.searchJournals")
                  : t("markdown.journal.searchMarkdownCodes")
              }
              resultCount={activeRows.length}
            />
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
            <div className="ml-auto flex items-center gap-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[1.625rem] shrink-0"
                onClick={() => {
                  if (isJournalView) journalSettings.openSettings();
                  else codeSettings.openSettings();
                }}
              >
                {t("doc.list.viewSettings")}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="list-page__create-btn rounded-md bg-white text-black hover:bg-gray-200"
                onClick={() => navigate(appendReturnTo(createTarget, currentReturnTo))}
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>{" "}
                {t("markdown.actions.create")}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <AgGridContainer ref={gridContainerRef} themeClass="markdown-journal-grid" gridRef={gridRef}>
        <AgGridReact<ActiveRow>
          {...agGridDefaultGridOptions}
          ref={gridRef}
          rowData={activeRows}
          columnDefs={columnDefs}
          defaultColDef={agGridDefaultColDef}
          overlayNoRowsTemplate={noRowsOverlayTemplate}
          onGridReady={(event) => {
            applyUrlGridSort(event.api, activeSortModel);
          }}
          onSortChanged={handleSortChanged}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
          selectionColumnDef={agGridSelectionColumnDef}
          getRowId={(params) => params.data.id}
          onSelectionChanged={(event) => setSelectedCount(event.api.getSelectedRows().length)}
          onRowClicked={(event) => {
            if (hasMeaningfulTextSelection()) return;
            if (event.data) {
              if (isJournalView) {
                navigate(appendReturnTo(`/markdown-journal/journals/${event.data.id}`, currentReturnTo));
              } else {
                const row = event.data as MarkdownCodeRow;
                navigate(appendReturnTo(`/markdown-journal/journals/${row.journalId}`, currentReturnTo));
              }
            }
          }}
        />
      </AgGridContainer>
      {isJournalView ? (
        <AgGridColumnSettingsModal
          open={journalSettings.settingsOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              journalSettings.openSettings();
              return;
            }
            journalSettings.cancelDraft();
          }}
          items={journalSettings.draftItems}
          onItemsChange={(nextItems) => journalSettings.setDraftItems(() => nextItems)}
          filterRules={journalSettings.draftDeepFilters}
          onFilterRulesChange={(nextRules) => journalSettings.setDraftDeepFilters(() => nextRules)}
          sortRules={journalSettings.draftDeepSorts}
          onSortRulesChange={(nextRules) => journalSettings.setDraftDeepSorts(() => nextRules)}
          registry={journalSettings.registry}
          filterConfigs={journalColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
          personalViews={journalSettings.personalViews}
          activeViewId={journalSettings.activeViewId}
          activeViewName={journalSettings.activeViewName}
          hasUnsavedChanges={journalSettings.hasUnsavedChanges}
          onActivateView={journalSettings.activatePersonalView}
          onCreateView={journalSettings.createPersonalViewFromCurrent}
          onSaveChangesToActiveView={journalSettings.saveActivePersonalViewFromCurrent}
          onRenameActiveView={journalSettings.renameActivePersonalView}
          onDeleteActiveView={journalSettings.deleteActivePersonalView}
          onSetActiveAsDefault={journalSettings.setActivePersonalViewAsDefault}
          onApply={handleApplyJournalColumnSettings}
          onCancel={journalSettings.cancelDraft}
          onReset={journalSettings.resetDraftToDefaults}
        />
      ) : (
        <AgGridColumnSettingsModal
          open={codeSettings.settingsOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              codeSettings.openSettings();
              return;
            }
            codeSettings.cancelDraft();
          }}
          items={codeSettings.draftItems}
          onItemsChange={(nextItems) => codeSettings.setDraftItems(() => nextItems)}
          filterRules={codeSettings.draftDeepFilters}
          onFilterRulesChange={(nextRules) => codeSettings.setDraftDeepFilters(() => nextRules)}
          sortRules={codeSettings.draftDeepSorts}
          onSortRulesChange={(nextRules) => codeSettings.setDraftDeepSorts(() => nextRules)}
          registry={codeSettings.registry}
          filterConfigs={codeColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
          personalViews={codeSettings.personalViews}
          activeViewId={codeSettings.activeViewId}
          activeViewName={codeSettings.activeViewName}
          hasUnsavedChanges={codeSettings.hasUnsavedChanges}
          onActivateView={codeSettings.activatePersonalView}
          onCreateView={codeSettings.createPersonalViewFromCurrent}
          onSaveChangesToActiveView={codeSettings.saveActivePersonalViewFromCurrent}
          onRenameActiveView={codeSettings.renameActivePersonalView}
          onDeleteActiveView={codeSettings.deleteActivePersonalView}
          onSetActiveAsDefault={codeSettings.setActivePersonalViewAsDefault}
          onApply={handleApplyCodeColumnSettings}
          onCancel={codeSettings.cancelDraft}
          onReset={codeSettings.resetDraftToDefaults}
        />
      )}
    </ListPageLayout>
  );
}
