/**
 * Items list — AG Grid migration. Uses shared AgGridContainer and defaultColDef.
 * Preserves search, All/Active/Inactive filters, New button, row navigation, empty state.
 */
import React, { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { itemRepository } from "../repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { Item } from "../model";
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
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildItemsListXlsxBuffer, type ItemsExportRow } from "../itemsListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  items: Item[],
  activeFilter: ActiveFilter,
): Item[] {
  if (activeFilter === "active") return items.filter((x) => x.isActive);
  if (activeFilter === "inactive") return items.filter((x) => !x.isActive);
  return items;
}

function applyBrandIdFilter(items: Item[], brandId: string | null): Item[] {
  if (brandId == null || brandId === "") return items;
  return items.filter((x) => x.brandId === brandId);
}

function applyCategoryIdFilter(items: Item[], categoryId: string | null): Item[] {
  if (categoryId == null || categoryId === "") return items;
  return items.filter((x) => x.categoryId === categoryId);
}

function ActiveStatusCellRenderer(params: ICellRendererParams<Item>) {
  const isActive = params.value as boolean;
  const label = isActive ? "Active" : "Inactive";
  return (
    <span className={isActive ? "status-plain-text status-plain-text--active" : "status-plain-text status-plain-text--inactive"}>
      {label}
    </span>
  );
}

/** Image count only — no thumbnails (Items list). */
function ImagesCountCellRenderer(params: ICellRendererParams<Item, number>) {
  const n = typeof params.value === "number" ? params.value : 0;
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }
  return <span className="tabular-nums text-foreground/90">{n}</span>;
}

function buildExportRowsFromItems(items: Item[]): ItemsExportRow[] {
  return items.map((item, idx) => {
    const brand = item.brandId ? brandRepository.getById(item.brandId)?.name ?? "" : "";
    const category = item.categoryId ? categoryRepository.getById(item.categoryId)?.name ?? "" : "";
    const purchasePrice =
      item.purchasePrice != null && typeof item.purchasePrice === "number" && !Number.isNaN(item.purchasePrice)
        ? item.purchasePrice
        : "";
    const salePrice =
      item.salePrice != null && typeof item.salePrice === "number" && !Number.isNaN(item.salePrice)
        ? item.salePrice
        : "";
    return {
      no: idx + 1,
      code: item.code ?? "",
      name: item.name ?? "",
      brand,
      category,
      uom: item.uom ?? "",
      purchasePrice,
      salePrice,
      active: item.isActive ? "Active" : "Inactive",
    };
  });
}

export function ItemsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const brandFilterId = useMemo(() => {
    const raw = searchParams.get("brandId");
    if (raw == null || raw === "") return null;
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const categoryFilterId = useMemo(() => {
    const raw = searchParams.get("categoryId");
    if (raw == null || raw === "") return null;
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<Item> | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<Item>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const filteredItems = useMemo(() => {
    const searched = itemRepository.search(searchQuery);
    const statusFiltered = applyActiveFilter(searched, activeFilter);
    const brandFiltered = applyBrandIdFilter(statusFiltered, brandFilterId);
    return applyCategoryIdFilter(brandFiltered, categoryFilterId);
  }, [searchQuery, activeFilter, brandFilterId, categoryFilterId]);

  const isEmpty = filteredItems.length === 0;
  const hasActiveFilter =
    activeFilter !== "all" ||
    searchQuery.trim() !== "" ||
    brandFilterId != null ||
    categoryFilterId != null;

  const brandFilterLabel = useMemo((): string => {
    if (brandFilterId == null) return "";
    const b = brandRepository.getById(brandFilterId);
    if (b) return b.name || b.code || brandFilterId;
    return brandFilterId;
  }, [brandFilterId]);

  const clearBrandFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("brandId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const categoryFilterLabel = useMemo((): string => {
    if (categoryFilterId == null) return "";
    const c = categoryRepository.getById(categoryFilterId);
    if (c) return c.name || c.code || categoryFilterId;
    return categoryFilterId;
  }, [categoryFilterId]);

  const clearCategoryFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoryId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getExportRowsCurrentView = useCallback((): ItemsExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromItems(filteredItems);
    const rows: Item[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromItems(rows);
  }, [filteredItems]);

  const getExportRowsSelected = useCallback((): ItemsExportRow[] => {
    const api = gridRef.current?.api;
    const rows: Item[] = api ? (api.getSelectedRows() as Item[]) : [];
    return buildExportRowsFromItems(rows);
  }, []);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
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
    [],
  );

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("items.xlsx", () => buildItemsListXlsxBuffer(rows));
  }, [getExportRowsCurrentView, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("items-selected.xlsx", () => buildItemsListXlsxBuffer(rows));
  }, [getExportRowsSelected, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasActiveFilter
    ? "No items match current search or filters"
    : "No items yet";
  const emptyHint = useMemo(() => {
    if (!hasActiveFilter) {
      return "Create your first item to start working with inventory.";
    }
    if (brandFilterId != null && categoryFilterId != null) {
      return "Try clearing the brand or category filter or adjusting search.";
    }
    if (brandFilterId != null) {
      return "Try clearing the brand filter or adjusting search.";
    }
    if (categoryFilterId != null) {
      return "Try clearing the category filter or adjusting search.";
    }
    return "Try changing the search or filter.";
  }, [hasActiveFilter, brandFilterId, categoryFilterId]);

  const columnDefs = useMemo<ColDef<Item>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "code",
        headerName: "Code",
        width: 130,
      },
      {
        field: "name",
        headerName: "Name",
        minWidth: 160,
        flex: 1,
      },
      {
        colId: "imageCount",
        headerName: "Images",
        width: 76,
        maxWidth: 88,
        valueGetter: (params) =>
          Array.isArray(params.data?.images) ? params.data!.images.length : 0,
        cellRenderer: ImagesCountCellRenderer,
      },
      {
        headerName: "Brand",
        width: 110,
        valueGetter: (params) => {
          const id = params.data?.brandId;
          if (!id) return "";
          const b = brandRepository.getById(id);
          return b?.name ?? "";
        },
      },
      {
        headerName: "Category",
        width: 120,
        valueGetter: (params) => {
          const id = params.data?.categoryId;
          if (!id) return "";
          const c = categoryRepository.getById(id);
          return c?.name ?? "";
        },
      },
      {
        field: "uom",
        headerName: "UOM",
        width: 90,
      },
      {
        field: "purchasePrice",
        headerName: "Purchase price",
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? params.value.toFixed(2)
            : "",
      },
      {
        field: "salePrice",
        headerName: "Sale price",
        width: 100,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? params.value.toFixed(2)
            : "",
      },
      {
        field: "isActive",
        headerName: "Active",
        width: 100,
        cellRenderer: ActiveStatusCellRenderer,
      },
    ],
    [],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label="Back to Dashboard" />
          <ButtonGroup className="list-page__filter-group" aria-label="Filter by status">
            {(["all", "active", "inactive"] as const).map((value, index) => (
              <React.Fragment key={value}>
                {index > 0 && <ButtonGroupSeparator />}
                <Button
                  type="button"
                  variant={activeFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(value)}
                >
                  {value === "all"
                    ? "All"
                    : value === "active"
                      ? "Active"
                      : "Inactive"}
                </Button>
              </React.Fragment>
            ))}
          </ButtonGroup>
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label="Search items"
            resultCount={filteredItems.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
            {brandFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label="Brand filter active"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">Brand</span>
                <span className="truncate font-medium text-foreground/90 min-w-0" title={brandFilterLabel}>
                  {brandFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearBrandFilter}
                >
                  Clear
                </Button>
              </div>
            )}
            {categoryFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label="Category filter active"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">Category</span>
                <span className="truncate font-medium text-foreground/90 min-w-0" title={categoryFilterLabel}>
                  {categoryFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCategoryFilter}
                >
                  Clear
                </Button>
              </div>
            )}
            {exportSuccess && (
              <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">Export completed:</span>
                <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Open file"
                  aria-label="Open file"
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
                  title="Open folder"
                  aria-label="Open folder"
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
                  title="Dismiss"
                  aria-label="Dismiss"
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
                Export
              </Button>
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
                    aria-label="Export options"
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
                      title={exportSelectedDisabled ? "Select one or more rows in the grid first." : undefined}
                      onClick={() => {
                        setExportOpen(false);
                        if (!exportSelectedDisabled) handleExportSelected();
                      }}
                    >
                      Export selected rows
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
            className="rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate("/items/new")}
          >
            <span className="create-btn__plus">+</span> Create
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="items-grid">
          <AgGridReact<Item>
            {...agGridDefaultGridOptions}
            ref={gridRef}
            rowData={filteredItems}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => {
              if (hasMeaningfulTextSelection()) return;
              if (e.data) navigate(`/items/${e.data.id}`);
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
