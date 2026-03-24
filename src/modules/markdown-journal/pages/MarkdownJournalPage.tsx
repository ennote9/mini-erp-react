import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { markdownRepository } from "../repository";
import type { MarkdownReasonCode, MarkdownRecord, MarkdownStatus } from "../model";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import { BackButton } from "@/shared/ui/list/BackButton";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
  hasMeaningfulTextSelection,
} from "@/shared/ui/ag-grid";
import {
  MARKDOWN_REASONS,
  MARKDOWN_STATUS_FILTERS,
  inCreatedRange,
} from "../pageConfig";

export function MarkdownJournalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<MarkdownStatus | "all">("all");
  const [filterReason, setFilterReason] = useState<MarkdownReasonCode | "all">("all");
  const [filterWarehouseId, setFilterWarehouseId] = useState<string | "all">("all");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const warehouses = useMemo(
    () => warehouseRepository.list().filter((w) => w.isActive),
    [appRevision],
  );
  const allRows = useMemo(() => markdownRepository.list(), [appRevision]);

  const rows = useMemo(() => {
    let base = allRows;
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((x) => x.markdownCode.toLowerCase().includes(q));
    }
    if (prefillItemId) {
      base = base.filter((x) => x.itemId === prefillItemId);
    }
    if (filterStatus !== "all") {
      base = base.filter((x) => x.status === filterStatus);
    }
    if (filterReason !== "all") {
      base = base.filter((x) => x.reasonCode === filterReason);
    }
    if (filterWarehouseId !== "all") {
      base = base.filter((x) => x.warehouseId === filterWarehouseId);
    }
    const locQ = filterLocation.trim().toLowerCase();
    if (locQ) {
      base = base.filter((x) => (x.locationId ?? "").toLowerCase().includes(locQ));
    }
    const itemQ = filterItem.trim().toLowerCase();
    if (itemQ) {
      base = base.filter((x) => {
        const it = itemRepository.getById(x.itemId);
        if (!it) return x.itemId.toLowerCase().includes(itemQ);
        return (
          it.code.toLowerCase().includes(itemQ) ||
          it.name.toLowerCase().includes(itemQ) ||
          x.itemId.toLowerCase().includes(itemQ)
        );
      });
    }
    if (createdFrom || createdTo) {
      base = base.filter((x) => inCreatedRange(x.createdAt, createdFrom, createdTo));
    }
    return base
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [
    allRows,
    createdFrom,
    createdTo,
    filterItem,
    filterLocation,
    filterReason,
    filterStatus,
    filterWarehouseId,
    prefillItemId,
    search,
  ]);

  const isEmpty = rows.length === 0;
  const hasFilter =
    search.trim() !== "" ||
    filterStatus !== "all" ||
    filterReason !== "all" ||
    filterWarehouseId !== "all" ||
    filterLocation.trim() !== "" ||
    filterItem.trim() !== "" ||
    createdFrom !== "" ||
    createdTo !== "" ||
    prefillItemId !== "";

  const emptyTitle = hasFilter
    ? t("ops.list.master.emptyFiltered")
    : t("ops.list.master.emptyDefault");
  const emptyHint = hasFilter
    ? t("ops.list.master.hintClearFilters")
    : t("ops.list.master.hintCreateFirst");

  const prefillItemLabel = useMemo(() => {
    if (!prefillItemId) return "";
    const item = itemRepository.getById(prefillItemId);
    if (!item) return prefillItemId;
    return `${item.code} — ${item.name}`;
  }, [prefillItemId, appRevision]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setFilterStatus("all");
    setFilterReason("all");
    setFilterWarehouseId("all");
    setFilterLocation("");
    setFilterItem("");
    setCreatedFrom("");
    setCreatedTo("");
  }, []);

  const createTarget = useMemo(() => {
    if (!prefillItemId) return "/markdown-journal/new";
    return `/markdown-journal/new?itemId=${encodeURIComponent(prefillItemId)}`;
  }, [prefillItemId]);

  const columnDefs = useMemo<ColDef<MarkdownRecord>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "markdownCode",
        headerName: t("markdown.fields.markdownCode"),
        minWidth: 150,
        width: 170,
      },
      {
        colId: "item",
        headerName: t("common.item"),
        minWidth: 240,
        flex: 1,
        valueGetter: (params) => {
          const row = params.data;
          if (!row) return "";
          const it = itemRepository.getById(row.itemId);
          return it ? `${it.code} — ${it.name}` : row.itemId;
        },
      },
      {
        field: "status",
        headerName: t("common.status"),
        minWidth: 130,
        width: 140,
        valueFormatter: (params) =>
          typeof params.value === "string" ? t(`markdown.status.${params.value}`) : "",
      },
      {
        field: "markdownPrice",
        headerName: t("markdown.fields.markdownPrice"),
        minWidth: 130,
        width: 140,
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(2) : "",
      },
      {
        field: "reasonCode",
        headerName: t("markdown.fields.reason"),
        minWidth: 180,
        width: 220,
        valueFormatter: (params) =>
          typeof params.value === "string" ? t(`markdown.reason.${params.value}`) : "",
      },
      {
        colId: "warehouse",
        headerName: t("common.warehouse"),
        minWidth: 120,
        width: 150,
        valueGetter: (params) => {
          const row = params.data;
          if (!row) return "";
          const wh = warehouseRepository.getById(row.warehouseId);
          return wh ? wh.code : row.warehouseId;
        },
      },
      {
        field: "locationId",
        headerName: t("markdown.fields.location"),
        minWidth: 120,
        width: 140,
        valueGetter: (params) => params.data?.locationId ?? "—",
      },
      {
        field: "createdAt",
        headerName: t("markdown.fields.createdAt"),
        minWidth: 200,
        width: 220,
      },
    ],
    [t],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
            <ButtonGroup className="list-page__filter-group" aria-label={t("ops.list.filterStatusAria")}>
              {MARKDOWN_STATUS_FILTERS.map((value, index) => (
                <div key={value} className="contents">
                  {index > 0 && <ButtonGroupSeparator />}
                  <Button
                    type="button"
                    variant={filterStatus === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(value)}
                  >
                    {value === "all" ? t("markdown.filters.allStatuses") : t(`markdown.status.${value}`)}
                  </Button>
                </div>
              ))}
            </ButtonGroup>
            <ListPageSearch
              inputRef={listSearchInputRef}
              placeholder={t("markdown.filters.searchCode")}
              value={search}
              onChange={setSearch}
              aria-label={t("markdown.filters.searchCode")}
              resultCount={rows.length}
            />
            <div className="ml-auto shrink-0">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="list-page__create-btn rounded-md bg-white text-black hover:bg-gray-200"
                onClick={() => navigate(createTarget)}
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
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              placeholder={t("markdown.filters.item")}
              className="w-[12rem]"
            />
            <select
              className="h-8 rounded border border-input bg-background px-2 text-sm"
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value as MarkdownReasonCode | "all")}
              aria-label={t("markdown.filters.allReasons")}
            >
              <option value="all">{t("markdown.filters.allReasons")}</option>
              {MARKDOWN_REASONS.map((x) => (
                <option key={x} value={x}>
                  {t(`markdown.reason.${x}`)}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded border border-input bg-background px-2 text-sm"
              value={filterWarehouseId}
              onChange={(e) => setFilterWarehouseId(e.target.value as string | "all")}
              aria-label={t("markdown.filters.allWarehouses")}
            >
              <option value="all">{t("markdown.filters.allWarehouses")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
            <Input
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              placeholder={t("markdown.filters.location")}
              className="w-[10rem]"
            />
            <Input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              aria-label={t("markdown.filters.createdFrom")}
              className="w-[9.5rem]"
            />
            <Input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              aria-label={t("markdown.filters.createdTo")}
              className="w-[9.5rem]"
            />
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              {t("doc.list.clear")}
            </Button>
            {prefillItemId ? (
              <div
                className="flex h-8 max-w-[min(100%,20rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("common.item")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("common.item")}</span>
                <span className="truncate font-medium text-foreground/90 min-w-0" title={prefillItemLabel}>
                  {prefillItemLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/markdown-journal")}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="markdown-journal-grid">
          <AgGridReact<MarkdownRecord>
            {...agGridDefaultGridOptions}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(event) => {
              if (hasMeaningfulTextSelection()) return;
              if (event.data) {
                navigate(`/markdown-journal/${event.data.id}`);
              }
            }}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
