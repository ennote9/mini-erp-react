import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { markdownRepository } from "../repository";
import { markdownJournalRepository } from "../journalRepository";
import { markdownJournalLineRepository } from "../journalLineRepository";
import type { MarkdownJournalStatus } from "../model";
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
  MARKDOWN_JOURNAL_STATUS_FILTERS,
} from "../pageConfig";

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";
  const viewFromQuery = searchParams.get("view");

  const [search, setSearch] = useState("");
  const [view, setView] = useState<MarkdownRegisterView>(
    viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals",
  );
  const [filterStatus, setFilterStatus] = useState<MarkdownJournalStatus | "all">("all");
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  useEffect(() => {
    const nextView = viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals";
    setView(nextView);
  }, [viewFromQuery]);

  const createTarget = useMemo(() => {
    if (!prefillItemId) return "/markdown-journal/new";
    return `/markdown-journal/new?itemId=${encodeURIComponent(prefillItemId)}`;
  }, [prefillItemId]);

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
    if (filterStatus !== "all") {
      base = base.filter((row) => row.status === filterStatus);
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
  }, [filterStatus, journalRows, prefillItemId, search, appRevision]);

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

  const activeRows = view === "journals" ? filteredJournalRows : filteredCodeRows;
  const isEmpty = activeRows.length === 0;
  const hasFilter = search.trim() !== "" || filterStatus !== "all" || prefillItemId !== "";

  const emptyTitle = hasFilter
    ? t("ops.list.master.emptyFiltered")
    : t("ops.list.master.emptyDefault");
  const emptyHint = hasFilter
    ? t("ops.list.master.hintClearFilters")
    : t("ops.list.master.hintCreateFirst");

  const journalColumnDefs = useMemo<ColDef<JournalRow>[]>(
    () => [
      agGridRowNumberColDef,
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

  const codeColumnDefs = useMemo<ColDef<MarkdownCodeRow>[]>(
    () => [
      agGridRowNumberColDef,
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
          typeof params.value === "number" ? params.value.toFixed(2) : "",
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
    [t],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
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
            <ButtonGroup className="list-page__filter-group" aria-label={t("ops.list.filterStatusAria")}>
              {MARKDOWN_JOURNAL_STATUS_FILTERS.map((value, index) => (
                <div key={value} className="contents">
                  {index > 0 && <ButtonGroupSeparator />}
                  <Button
                    type="button"
                    variant={filterStatus === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(value)}
                    disabled={view !== "journals"}
                  >
                    {value === "all"
                      ? t("markdown.filters.allStatuses")
                      : journalStatusLabel(value, t)}
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
              onChange={setSearch}
              aria-label={
                view === "journals"
                  ? t("markdown.journal.searchJournals")
                  : t("markdown.journal.searchMarkdownCodes")
              }
              resultCount={activeRows.length}
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
        </div>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="markdown-journal-grid">
          <AgGridReact<JournalRow | MarkdownCodeRow>
            {...agGridDefaultGridOptions}
            rowData={activeRows}
            columnDefs={(view === "journals" ? journalColumnDefs : codeColumnDefs) as ColDef<JournalRow | MarkdownCodeRow>[]}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(event) => {
              if (hasMeaningfulTextSelection()) return;
              if (event.data) {
                if (view === "journals") {
                  navigate(`/markdown-journal/journals/${event.data.id}`);
                } else {
                  const row = event.data as MarkdownCodeRow;
                  navigate(`/markdown-journal/journals/${row.journalId}`);
                }
              }
            }}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
