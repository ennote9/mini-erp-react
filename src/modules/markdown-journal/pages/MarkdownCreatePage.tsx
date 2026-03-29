import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { Dialog } from "radix-ui";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { CheckSquare, ClipboardList, File, List, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SalesOrderItemAutocomplete } from "@/modules/sales-orders/components/SalesOrderItemAutocomplete";
import { BackButton } from "@/shared/ui/list/BackButton";
import { DocumentPageLayout } from "@/shared/ui/object/DocumentPageLayout";
import { useTranslation } from "@/shared/i18n/context";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridSelectionColumnDef,
} from "@/shared/ui/ag-grid";
import type { Item } from "@/modules/items/model";
import type { MarkdownJournal, MarkdownReasonCode } from "../model";
import { markdownJournalRepository } from "../journalRepository";
import {
  cancelMarkdownJournalDraft,
  createMarkdownJournalDraft,
  listMarkdownLinesForJournal,
  listMarkdownUnitsForJournal,
  postMarkdownJournal,
  recordMarkdownPrintAudit,
  resolveMarkdownJournalPrintRecords,
  updateMarkdownJournalDraft,
  type MarkdownJournalDraftLineInput,
} from "../service";
import { MARKDOWN_REASONS } from "../pageConfig";
import { cn } from "@/lib/utils";
import { appendReturnTo, readReturnToParam } from "@/shared/navigation/returnTo";
import { useUrlTabState } from "@/shared/navigation/useUrlTabState";

const DEFAULT_WAREHOUSE_ID = "1";
const LOCAL_ACTOR = "local-operator";

type LineFormRow = {
  _lineId: string;
  itemId: string;
  markdownPrice: number;
  quantity: number;
  reasonCode: MarkdownReasonCode;
};

type GridRow = {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  reason: string;
};

type MarkdownCodeRow = {
  id: string;
  markdownCode: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  reason: string;
  warehouse: string;
  status: string;
  postedAt: string;
  printCount: number;
  printedAt: string;
};

type PrintMode = "all" | "selected";

function buildCancelTarget(itemId: string): string {
  if (!itemId) return "/markdown-journal";
  return `/markdown-journal?itemId=${encodeURIComponent(itemId)}`;
}

function linesToDraftInput(lines: LineFormRow[]): MarkdownJournalDraftLineInput[] {
  return lines.map((line) => ({
    itemId: line.itemId,
    markdownPrice: line.markdownPrice,
    quantity: line.quantity,
    reasonCode: line.reasonCode,
  }));
}

function journalLinesToForm(lines: ReturnType<typeof listMarkdownLinesForJournal>): LineFormRow[] {
  return lines.map((line) => ({
    _lineId: line.id,
    itemId: line.itemId,
    markdownPrice: line.markdownPrice,
    quantity: line.quantity,
    reasonCode: line.reasonCode,
  }));
}

function journalToGridRows(
  lines: LineFormRow[],
  t: (key: string) => string,
  appRevision: number,
): GridRow[] {
  void appRevision;
  return lines.map((line) => {
    const item = itemRepository.getById(line.itemId);
    return {
      id: line._lineId,
      itemCode: item?.code ?? line.itemId,
      itemName: item?.name ?? line.itemId,
      quantity: line.quantity,
      markdownPrice: line.markdownPrice,
      reason: t(`markdown.reason.${line.reasonCode}`),
    };
  });
}

function journalUnitsToCodeRows(
  journalId: string,
  t: (key: string) => string,
  appRevision: number,
): MarkdownCodeRow[] {
  void appRevision;
  return listMarkdownUnitsForJournal(journalId).map((record) => {
    const item = itemRepository.getById(record.itemId);
    return {
      id: record.id,
      markdownCode: record.markdownCode,
      itemCode: item?.code ?? record.itemId,
      itemName: item?.name ?? record.itemId,
      quantity: 1,
      markdownPrice: record.markdownPrice,
      reason: t(`markdown.reason.${record.reasonCode}`),
      warehouse: warehouseLabelFor(record.warehouseId),
      status: t(`markdown.status.${record.status}`),
      postedAt: record.createdAt,
      printCount: record.printCount,
      printedAt: record.printedAt ?? t("domain.audit.summary.emDash"),
    };
  });
}

function warehouseLabelFor(id: string): string {
  const warehouse = warehouseRepository.getById(id);
  return warehouse ? `${warehouse.code} — ${warehouse.name}` : id;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

function buildCode39BarcodeSvg(value: string): string {
  const encoded = value.trim().toUpperCase();
  if (!encoded) return "";
  if ([...encoded].some((char) => !CODE39_PATTERNS[char] || char === "*")) {
    return "";
  }

  const narrow = 2;
  const wide = 6;
  const interCharacterGap = 2;
  const quietZone = 12;
  const height = 56;
  let x = quietZone;
  const rects: string[] = [];
  const fullValue = ["*", ...encoded.split(""), "*"];

  for (const char of fullValue) {
    const pattern = CODE39_PATTERNS[char];
    for (let i = 0; i < pattern.length; i += 1) {
      const width = pattern[i] === "w" ? wide : narrow;
      if (i % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#111111" />`);
      }
      x += width;
    }
    x += interCharacterGap;
  }

  const width = x + quietZone - interCharacterGap;
  return `<svg class="sticker__barcode-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`Barcode ${value}`)}" shape-rendering="crispEdges">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${rects.join("")}
  </svg>`;
}

function buildMarkdownPrintSheetHtml(params: {
  journalNumber: string;
  rows: MarkdownCodeRow[];
  t: (key: string) => string;
}): string {
  const { journalNumber, rows, t } = params;
  const html = rows
    .map((row) => {
      const barcodeSvg = buildCode39BarcodeSvg(row.markdownCode);
      return `
        <article class="sticker">
          <div class="sticker__barcode">${barcodeSvg}</div>
          <div class="sticker__code">${escapeHtml(row.markdownCode)}</div>
          <div class="sticker__item">${escapeHtml(`${row.itemCode} — ${row.itemName}`)}</div>
          <div class="sticker__meta">${escapeHtml(`${t("markdown.fields.markdownPrice")}: ${row.markdownPrice.toFixed(2)}`)}</div>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(journalNumber)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 16px; color: #111; }
          .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .sticker { border: 1px solid #111; padding: 12px; page-break-inside: avoid; }
          .sticker__barcode { margin-bottom: 10px; }
          .sticker__barcode-svg { display: block; width: 100%; height: 56px; }
          .sticker__code { font-size: 20px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.04em; }
          .sticker__item { font-size: 14px; margin-bottom: 6px; }
          .sticker__meta { font-size: 12px; margin-bottom: 2px; }
        </style>
        <script>
          window.addEventListener("load", () => {
            window.setTimeout(() => {
              window.focus();
              window.print();
            }, 50);
          });
        </script>
      </head>
      <body>
        <div class="sheet">${html}</div>
      </body>
    </html>`;
}

function openMarkdownPrintPopupShell(title: string, loadingText: string): Window | null {
  const popup = window.open("", "_blank", "width=960,height=720");
  if (!popup) return null;
  popup.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #111;
          }
          .print-loading {
            border: 1px solid #d4d4d8;
            border-radius: 8px;
            padding: 16px;
            max-width: 32rem;
          }
          .print-loading__title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .print-loading__body {
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <section class="print-loading">
          <div class="print-loading__title">${escapeHtml(title)}</div>
          <div class="print-loading__body">${escapeHtml(loadingText)}</div>
        </section>
      </body>
    </html>`);
  popup.document.close();
  return popup;
}

function journalStatusLabel(
  status: MarkdownJournal["status"],
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

export function MarkdownCreatePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();
  const prefillItemId = searchParams.get("itemId") ?? "";
  const isNew = !id;

  const journal = useMemo<MarkdownJournal | undefined>(
    () => (id ? markdownJournalRepository.getById(id) : undefined),
    [id, appRevision],
  );

  const [lines, setLines] = useState<LineFormRow[]>([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState(DEFAULT_WAREHOUSE_ID);
  const [targetWarehouseId, setTargetWarehouseId] = useState(DEFAULT_WAREHOUSE_ID);
  const [comment, setComment] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [itemEntryId, setItemEntryId] = useState(prefillItemId);
  const [lineEntryQty, setLineEntryQty] = useState(1);
  const [lineEntryPrice, setLineEntryPrice] = useState(0);
  const [lineEntryReason, setLineEntryReason] = useState<MarkdownReasonCode>("OTHER");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useUrlTabState({
    allowedValues: ["lines", "codes"] as const,
    defaultValue: "lines",
  });
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const lineEntryItemPickerRef = useRef<{ focus: () => void } | null>(null);
  const lineEntryDropdownRightEdgeRef = useRef<HTMLDivElement | null>(null);

  const warehouses = useMemo(
    () => warehouseRepository.list().filter((warehouse) => warehouse.isActive),
    [appRevision],
  );
  const selectableItems = useMemo(
    () => itemRepository.list().filter((item) => item.itemKind === "SELLABLE"),
    [appRevision],
  );

  useEffect(() => {
    if (!isNew || warehouses.length === 0) return;
    setSourceWarehouseId((prev) =>
      warehouses.some((warehouse) => warehouse.id === prev) ? prev : warehouses[0].id,
    );
    setTargetWarehouseId((prev) =>
      warehouses.some((warehouse) => warehouse.id === prev) ? prev : warehouses[0].id,
    );
  }, [isNew, warehouses]);

  useEffect(() => {
    if (isNew) {
      if (prefillItemId) setItemEntryId(prefillItemId);
      return;
    }
    if (!journal) return;
    setSourceWarehouseId(journal.sourceWarehouseId);
    setTargetWarehouseId(journal.targetWarehouseId);
    setComment(journal.comment ?? "");
    setLines(journalLinesToForm(listMarkdownLinesForJournal(journal.id)));
  }, [isNew, journal, prefillItemId, appRevision]);

  useEffect(() => {
    if (journal?.status !== "posted" && detailTab === "codes") {
      setDetailTab("lines");
    }
  }, [detailTab, journal?.status]);

  const isDraft = isNew || journal?.status === "draft";
  const isPosted = journal?.status === "posted";
  const isCancelled = journal?.status === "cancelled";
  const isReadOnly = !isNew && !isDraft;

  const returnTo = readReturnToParam(searchParams);
  const cancelTarget = useMemo(() => buildCancelTarget(prefillItemId), [prefillItemId]);
  const resolvedBackTarget = returnTo ?? cancelTarget;

  const resetLineEntry = useCallback(() => {
    setItemEntryId(prefillItemId);
    setLineEntryQty(1);
    setLineEntryPrice(0);
    setLineEntryReason("OTHER");
    setEditingLineId(null);
    lineEntryItemPickerRef.current?.focus();
  }, [prefillItemId]);

  const handleCancel = useCallback(() => {
    navigate(resolvedBackTarget);
  }, [resolvedBackTarget, navigate]);

  const handleAddOrUpdateLine = useCallback(() => {
    setCreateError(null);
    const item = itemRepository.getById(itemEntryId);
    if (!item) {
      setCreateError("Item not found.");
      return;
    }
    if (item.itemKind === "TESTER") {
      setCreateError("Markdown journal expects sellable items only.");
      return;
    }
    if (!item.isActive) {
      setCreateError("Inactive items cannot be added.");
      return;
    }
    if (!(lineEntryQty > 0)) {
      setCreateError("Quantity must be greater than zero.");
      return;
    }
    if (!(lineEntryPrice > 0)) {
      setCreateError("Markdown price must be greater than zero.");
      return;
    }

    const row: LineFormRow = {
      _lineId: editingLineId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemId: item.id,
      markdownPrice: lineEntryPrice,
      quantity: Math.max(1, Math.floor(lineEntryQty)),
      reasonCode: lineEntryReason,
    };

    setLines((prev) =>
      editingLineId
        ? prev.map((line) => (line._lineId === editingLineId ? row : line))
        : [...prev, row],
    );
    resetLineEntry();
  }, [
    editingLineId,
    itemEntryId,
    lineEntryPrice,
    lineEntryQty,
    lineEntryReason,
    resetLineEntry,
  ]);

  const handleEditLine = useCallback(
    (lineId: string) => {
      const line = lines.find((entry) => entry._lineId === lineId);
      if (!line) return;
      setEditingLineId(line._lineId);
      setItemEntryId(line.itemId);
      setLineEntryQty(line.quantity);
      setLineEntryPrice(line.markdownPrice);
      setLineEntryReason(line.reasonCode);
    },
    [lines],
  );

  const handleRemoveLine = useCallback(() => {
    if (!editingLineId) return;
    setLines((prev) => prev.filter((line) => line._lineId !== editingLineId));
    resetLineEntry();
  }, [editingLineId, resetLineEntry]);

  const handleSave = useCallback(() => {
    setCreateError(null);
    const payload = {
      sourceWarehouseId:
        sourceWarehouseId.trim() || (warehouses[0]?.id ?? DEFAULT_WAREHOUSE_ID),
      targetWarehouseId:
        targetWarehouseId.trim() || (warehouses[0]?.id ?? DEFAULT_WAREHOUSE_ID),
      comment: comment.trim() || undefined,
      lines: linesToDraftInput(lines),
      actorId: LOCAL_ACTOR,
    };
    const result = isNew
      ? createMarkdownJournalDraft(payload)
      : id
        ? updateMarkdownJournalDraft(id, payload)
        : { success: false as const, error: "Markdown journal not found." };

    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    navigate(appendReturnTo(`/markdown-journal/journals/${result.journal.id}`, returnTo), { replace: true });
  }, [
    comment,
    id,
    isNew,
    lines,
    navigate,
    sourceWarehouseId,
    targetWarehouseId,
    warehouses,
  ]);

  const handlePost = useCallback(() => {
    if (!id) return;
    setCreateError(null);
    const result = postMarkdownJournal(id, LOCAL_ACTOR);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    navigate(appendReturnTo(`/markdown-journal/journals/${result.journal.id}`, returnTo), { replace: true });
  }, [id, navigate, returnTo]);

  const handleCancelJournal = useCallback(() => {
    if (!id) return;
    setCreateError(null);
    const result = cancelMarkdownJournalDraft(id, LOCAL_ACTOR);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    navigate(appendReturnTo(`/markdown-journal/journals/${result.journal.id}`, returnTo), { replace: true });
  }, [id, navigate, returnTo]);

  const handlePrint = useCallback(() => {
    setCreateError(null);
    setPrintDialogOpen(true);
  }, []);

  const handleCodeSelectionChanged = useCallback((event: SelectionChangedEvent<MarkdownCodeRow>) => {
    setSelectedCodeIds(event.api.getSelectedRows().map((row) => row.id));
  }, []);

  const lineColumnDefs = useMemo<ColDef<GridRow>[]>(
    () => [
      {
        headerName: t("doc.columns.lineNo"),
        valueGetter: (params) =>
          params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        sortable: false,
      },
      {
        field: "itemCode",
        headerName: t("doc.columns.itemCode"),
        width: 130,
        minWidth: 120,
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
        field: "reason",
        headerName: t("markdown.fields.reason"),
        minWidth: 180,
        width: 220,
      },
    ],
    [t],
  );

  const codeColumnDefs = useMemo<ColDef<MarkdownCodeRow>[]>(
    () => [
      {
        headerName: t("doc.columns.lineNo"),
        valueGetter: (params) =>
          params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        sortable: false,
      },
      {
        field: "markdownCode",
        headerName: t("markdown.fields.markdownCode"),
        width: 150,
        minWidth: 140,
      },
      {
        field: "itemCode",
        headerName: t("doc.columns.itemCode"),
        width: 130,
        minWidth: 120,
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
        field: "reason",
        headerName: t("markdown.fields.reason"),
        minWidth: 180,
        width: 220,
      },
      {
        field: "warehouse",
        headerName: t("markdown.fields.targetWarehouse"),
        minWidth: 150,
        width: 170,
      },
      {
        field: "status",
        headerName: t("common.status"),
        minWidth: 120,
        width: 130,
      },
      {
        field: "postedAt",
        headerName: t("markdown.fields.postedAt"),
        minWidth: 180,
        width: 200,
      },
      {
        field: "printCount",
        headerName: t("markdown.fields.printCount"),
        width: 100,
        minWidth: 90,
      },
      {
        field: "printedAt",
        headerName: t("markdown.fields.printedAt"),
        minWidth: 180,
        width: 200,
      },
    ],
    [t],
  );

  const effectiveLines =
    journal?.status === "posted" && journal ? journalLinesToForm(listMarkdownLinesForJournal(journal.id)) : lines;
  const gridRows = useMemo(
    () => journalToGridRows(effectiveLines, t, appRevision),
    [effectiveLines, t, appRevision],
  );
  const codeRows = useMemo(
    () => (journal ? journalUnitsToCodeRows(journal.id, t, appRevision) : []),
    [journal, t, appRevision],
  );
  const unitsCount = useMemo(
    () => (journal ? listMarkdownUnitsForJournal(journal.id).length : 0),
    [journal, appRevision],
  );
  const selectedPrintableCount = useMemo(() => {
    if (selectedCodeIds.length === 0) return 0;
    const selectedSet = new Set(selectedCodeIds);
    return codeRows.filter((row) => selectedSet.has(row.id)).length;
  }, [codeRows, selectedCodeIds]);

  const handlePrintMode = useCallback(
    (mode: PrintMode) => {
      if (!id || !journal) return;
      setCreateError(null);
      const popup = openMarkdownPrintPopupShell(
        t("markdown.journal.printDialogTitle"),
        t("markdown.journal.printPopupPreparing"),
      );
      if (!popup) {
        setCreateError("Could not open print window.");
        return;
      }
      const printResult = resolveMarkdownJournalPrintRecords(
        id,
        mode === "selected" ? { recordIds: selectedCodeIds } : undefined,
      );
      if (!printResult.success) {
        popup.close();
        setCreateError(printResult.error);
        return;
      }

      const printableRows = printResult.records.map((record) => {
        const item = itemRepository.getById(record.itemId);
        return {
          id: record.id,
          markdownCode: record.markdownCode,
          itemCode: item?.code ?? record.itemId,
          itemName: item?.name ?? record.itemId,
          quantity: 1,
          markdownPrice: record.markdownPrice,
          reason: t(`markdown.reason.${record.reasonCode}`),
          warehouse: warehouseLabelFor(record.warehouseId),
          status: t(`markdown.status.${record.status}`),
          postedAt: record.createdAt,
          printCount: record.printCount,
          printedAt: record.printedAt ?? t("domain.audit.summary.emDash"),
        } satisfies MarkdownCodeRow;
      });

      popup.document.open();
      popup.document.write(
        buildMarkdownPrintSheetHtml({
          journalNumber: printResult.journal.number,
          rows: printableRows,
          t,
        }),
      );
      popup.document.close();
      popup.focus();
      popup.print();

      const auditResult = recordMarkdownPrintAudit(printResult.records.map((record) => record.id));
      if (!auditResult.success) {
        popup.close();
        setCreateError(auditResult.error);
        return;
      }
      setPrintDialogOpen(false);
    },
    [id, journal, selectedCodeIds, t],
  );

  const breadcrumbItems = useMemo(
    () => [
      { label: t("shell.inventory"), to: "/markdown-journal" },
      { label: t("shell.nav.markdownJournal"), to: "/markdown-journal" },
      {
        label: isNew ? t("markdown.journal.createTitle") : journal?.number ?? t("markdown.journal.documentTitle"),
      },
    ],
    [isNew, journal?.number, t],
  );

  if (!isNew && !journal) {
    return <div className="doc-page">{t("markdown.journal.notFound")}</div>;
  }

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={
        <BackButton
          to={returnTo ?? undefined}
          fallbackTo={cancelTarget}
          preferHistory={!returnTo}
          aria-label={t("markdown.journal.backToListAria")}
        />
      }
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">
              {isNew
                ? t("markdown.journal.createTitle")
                : `${t("markdown.journal.documentTitle")} ${journal?.number ?? ""}`.trim()}
            </h2>
          </div>
          <div className="doc-header__right">
            <div className="doc-header__actions">
              {(isNew || journal?.status === "draft") && (
                <Button type="button" onClick={handleSave}>
                  <Save aria-hidden />
                  {t("common.save")}
                </Button>
              )}
              {!isNew && journal?.status === "draft" ? (
                <>
                  <Button type="button" onClick={handlePost}>
                    <Save aria-hidden />
                    {t("doc.factual.post")}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelJournal}>
                    <X aria-hidden />
                    {t("markdown.actions.cancelJournal")}
                  </Button>
                </>
              ) : null}
              {!isNew && journal?.status === "posted" && (
                <Button type="button" onClick={handlePrint}>
                  <Printer aria-hidden />
                  {t("markdown.actions.printLabels")}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X aria-hidden />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      <div className="doc-markdown-create-page flex w-full min-w-0 flex-col gap-2">
        <Card className="w-full border-0 bg-transparent shadow-none">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="text-[0.9rem] font-semibold">{t("doc.page.details")}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {createError ? (
              <div
                className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {t("markdown.messages.actionFailed", { message: createError })}
              </div>
            ) : null}

            <div className="flex w-full min-w-0 flex-col gap-y-2 overflow-x-auto lg:flex-row lg:flex-nowrap lg:items-start lg:justify-start lg:gap-x-[1.5cm] lg:gap-y-0">
              <div className="flex w-fit min-w-0 max-w-full shrink-0 flex-col gap-2.5 p-3">
                <section className="min-w-0" aria-labelledby="markdown-details-operation-heading">
                  <h3
                    id="markdown-details-operation-heading"
                    className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <File className="h-3.5 w-3.5" aria-hidden />
                    {t("doc.page.details")}
                  </h3>
                  <div className="grid grid-cols-1 gap-x-2.5 gap-y-1 sm:grid-cols-2 sm:justify-items-start">
                    {!isNew && journal ? (
                      <div className="flex w-full max-w-[160px] min-w-0 flex-col gap-0.5">
                        <Label className="text-xs leading-none">{t("doc.columns.number")}</Label>
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {journal.number}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex w-full max-w-[220px] min-w-0 flex-col gap-0.5">
                      <Label htmlFor="markdown-source-warehouse" className="text-xs leading-none">
                        {t("markdown.fields.sourceWarehouse")}
                      </Label>
                      {isReadOnly ? (
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {warehouseLabelFor(sourceWarehouseId)}
                        </div>
                      ) : warehouses.length > 0 ? (
                        <select
                          id="markdown-source-warehouse"
                          className={cn(
                            "flex h-8 w-full rounded border border-input bg-background px-1.5 py-0 text-sm leading-tight text-foreground",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                          value={sourceWarehouseId}
                          onChange={(e) => setSourceWarehouseId(e.target.value)}
                          aria-label={t("markdown.fields.sourceWarehouse")}
                        >
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code} — {warehouse.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={sourceWarehouseId}
                          onChange={(e) => setSourceWarehouseId(e.target.value)}
                          placeholder={t("markdown.fields.sourceWarehouse")}
                          className="h-8 px-1.5 py-0 text-sm leading-tight"
                        />
                      )}
                    </div>
                    <div className="flex w-full max-w-[220px] min-w-0 flex-col gap-0.5">
                      <Label htmlFor="markdown-target-warehouse" className="text-xs leading-none">
                        {t("markdown.fields.targetWarehouse")}
                      </Label>
                      {isReadOnly ? (
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {warehouseLabelFor(targetWarehouseId)}
                        </div>
                      ) : warehouses.length > 0 ? (
                        <select
                          id="markdown-target-warehouse"
                          className={cn(
                            "flex h-8 w-full rounded border border-input bg-background px-1.5 py-0 text-sm leading-tight text-foreground",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                          value={targetWarehouseId}
                          onChange={(e) => setTargetWarehouseId(e.target.value)}
                          aria-label={t("markdown.fields.targetWarehouse")}
                        >
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code} — {warehouse.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={targetWarehouseId}
                          onChange={(e) => setTargetWarehouseId(e.target.value)}
                          placeholder={t("markdown.fields.targetWarehouse")}
                          className="h-8 px-1.5 py-0 text-sm leading-tight"
                        />
                      )}
                    </div>
                    {!isNew && journal ? (
                      <div className="flex w-full max-w-[180px] min-w-0 flex-col gap-0.5">
                        <Label className="text-xs leading-none">{t("common.status")}</Label>
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {journalStatusLabel(journal.status, t)}
                        </div>
                      </div>
                    ) : null}
                    {!isNew && journal?.postedAt ? (
                      <div className="flex w-full max-w-[220px] min-w-0 flex-col gap-0.5">
                        <Label className="text-xs leading-none">{t("markdown.fields.postedAt")}</Label>
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {journal.postedAt}
                        </div>
                      </div>
                    ) : null}
                    {!isNew && journal?.cancelledAt ? (
                      <div className="flex w-full max-w-[220px] min-w-0 flex-col gap-0.5">
                        <Label className="text-xs leading-none">{t("markdown.fields.cancelledAt")}</Label>
                        <div className="flex h-8 items-center rounded border border-input bg-background px-1.5 text-sm leading-tight text-foreground">
                          {journal.cancelledAt}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
              <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                <section className="min-w-0" aria-labelledby="markdown-details-notes-heading">
                  <h3
                    id="markdown-details-notes-heading"
                    className="mb-1 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                    {t("doc.so.sectionNotes")}
                  </h3>
                  <Label htmlFor="markdown-comment" className="sr-only">
                    {t("common.description")}
                  </Label>
                  <Textarea
                    id="markdown-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("common.optional")}
                    rows={3}
                    className="min-h-[4rem] w-[min(28rem,100%)] min-w-[16rem] resize-y text-sm"
                    disabled={isReadOnly}
                  />
                </section>
              </div>
              {!isNew && isPosted ? (
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="min-w-0" aria-labelledby="markdown-details-result-heading">
                    <h3
                      id="markdown-details-result-heading"
                      className="mb-1 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <List className="h-3.5 w-3.5" aria-hidden />
                      {t("markdown.journal.markdownCodesTab")}
                    </h3>
                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-0.5 sm:grid-cols-2">
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <span className="text-xs leading-tight text-muted-foreground">{t("markdown.fields.lineCount")}</span>
                        <span className="text-sm leading-tight text-foreground">{effectiveLines.length}</span>
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <span className="text-xs leading-tight text-muted-foreground">{t("markdown.fields.totalQty")}</span>
                        <span className="text-sm leading-tight text-foreground">{unitsCount}</span>
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <span className="text-xs leading-tight text-muted-foreground">{t("markdown.journal.selectedCodesCount")}</span>
                        <span className="text-sm leading-tight text-foreground">{selectedPrintableCount}</span>
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="doc-so-working-area mt-0 max-w-full border-t border-border/60 pt-2">
          <div className="mb-2 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label={t("doc.so.tabPanelsAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "lines"}
              className={cn(
                "-mb-px px-3 py-2 text-sm font-medium",
                detailTab === "lines"
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setDetailTab("lines")}
            >
              <span className="inline-flex items-center gap-1.5">
                <List className="h-3.5 w-3.5" aria-hidden />
                {t("markdown.journal.linesTab")}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "codes"}
              aria-disabled={!isPosted}
              disabled={!isPosted}
              title={!isPosted ? t("markdown.journal.markdownCodesAvailableAfterPosting") : undefined}
              className={cn(
                "-mb-px px-3 py-2 text-sm font-medium",
                detailTab === "codes"
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                !isPosted && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
              )}
              onClick={() => {
                if (isPosted) setDetailTab("codes");
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                {t("markdown.journal.markdownCodesTab")}
              </span>
            </button>
          </div>

          {!isPosted && !isCancelled ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {t("markdown.journal.markdownCodesAvailableAfterPosting")}
            </p>
          ) : null}

          {isCancelled ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {t("markdown.journal.cancelledClosedHint")}
            </p>
          ) : null}

          <div className="doc-lines mt-0">
            {detailTab === "lines" && isDraft ? (
              <div className="mb-1.5 flex w-full items-end gap-2">
                <Card className="flex-1 min-w-0 border-0 shadow-none">
                  <CardContent className="p-2 pb-0">
                    <div className="grid w-max max-w-full grid-cols-1 items-end gap-x-2 gap-y-1 md:grid-cols-[minmax(240px,320px)_96px_110px_200px_auto]">
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="markdown-line-item" className="text-sm">
                          {t("doc.page.itemLabel")}
                        </Label>
                        <SalesOrderItemAutocomplete
                          ref={lineEntryItemPickerRef}
                          id="markdown-line-item"
                          value={itemEntryId}
                          onChange={setItemEntryId}
                          items={selectableItems as Item[]}
                          placeholder={t("doc.page.searchItemPlaceholder")}
                          className="w-[320px]"
                          dropdownRightEdgeRef={lineEntryDropdownRightEdgeRef}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="markdown-line-qty" className="text-sm">
                          {t("doc.columns.qty")}
                        </Label>
                        <Input
                          id="markdown-line-qty"
                          type="number"
                          min={1}
                          step="1"
                          value={lineEntryQty}
                          onChange={(e) => setLineEntryQty(Number(e.target.value) || 1)}
                          className="h-8 w-[96px] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="markdown-line-price" className="text-sm">
                          {t("markdown.fields.markdownPrice")}
                        </Label>
                        <Input
                          id="markdown-line-price"
                          type="number"
                          min={0}
                          step="0.01"
                          value={lineEntryPrice}
                          onChange={(e) => setLineEntryPrice(Number(e.target.value) || 0)}
                          className="h-8 w-[110px] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="markdown-line-reason" className="text-sm">
                          {t("markdown.fields.reason")}
                        </Label>
                        <select
                          id="markdown-line-reason"
                          className={cn(
                            "flex h-8 w-[200px] rounded border border-input bg-background px-1.5 py-0 text-sm leading-tight text-foreground",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                          value={lineEntryReason}
                          onChange={(e) => setLineEntryReason(e.target.value as MarkdownReasonCode)}
                          disabled={isReadOnly}
                        >
                          {MARKDOWN_REASONS.map((reasonCode) => (
                            <option key={reasonCode} value={reasonCode}>
                              {t(`markdown.reason.${reasonCode}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div ref={lineEntryDropdownRightEdgeRef} className="flex flex-shrink-0 items-center gap-1.5">
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleAddOrUpdateLine} disabled={isReadOnly}>
                          <Save className="h-4 w-4 shrink-0" aria-hidden />
                          {editingLineId ? t("doc.page.updateLine") : t("doc.page.addLine")}
                        </Button>
                        {editingLineId ? (
                          <>
                            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRemoveLine} disabled={isReadOnly}>
                              <X className="h-4 w-4 shrink-0" aria-hidden />
                              {t("doc.page.remove")}
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={resetLineEntry} disabled={isReadOnly}>
                              <X className="h-4 w-4 shrink-0" aria-hidden />
                              {t("doc.page.cancelEdit")}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {detailTab === "lines" ? (
              gridRows.length === 0 ? (
                <p className="doc-lines__empty">{t("doc.page.noLines")}</p>
              ) : (
                <div className="doc-lines__grid doc-lines__grid--fixed-h h-[18rem] min-h-[18rem]">
                  <AgGridContainer themeClass="doc-lines-grid">
                    <AgGridReact<GridRow>
                      {...agGridDefaultGridOptions}
                      rowData={gridRows}
                      columnDefs={lineColumnDefs}
                      defaultColDef={agGridDefaultColDef}
                      getRowId={(params) => params.data.id}
                      onRowClicked={
                        isReadOnly
                          ? undefined
                          : (event) => {
                              if (event.data) handleEditLine(event.data.id);
                            }
                      }
                    />
                  </AgGridContainer>
                </div>
              )
            ) : codeRows.length === 0 ? (
              <p className="doc-lines__empty">{t("doc.page.noLines")}</p>
            ) : (
              <div className="doc-lines__grid doc-lines__grid--fixed-h h-[18rem] min-h-[18rem]">
                <AgGridContainer themeClass="doc-lines-grid">
                  <AgGridReact<MarkdownCodeRow>
                    {...agGridDefaultGridOptions}
                    rowData={codeRows}
                    columnDefs={codeColumnDefs}
                    defaultColDef={agGridDefaultColDef}
                    rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
                    selectionColumnDef={agGridSelectionColumnDef}
                    getRowId={(params) => params.data.id}
                    onSelectionChanged={handleCodeSelectionChanged}
                  />
                </AgGridContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog.Root open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-5 shadow-lg focus:outline-none">
            <Dialog.Title className="text-base font-semibold text-foreground">
              {t("markdown.journal.printDialogTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {t("markdown.journal.printDialogDescription")}
            </Dialog.Description>

            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                {t("markdown.journal.printAllSummary", { count: unitsCount })}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                {t("markdown.journal.printSelectedSummary", { count: selectedPrintableCount })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPrintDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintMode("selected")}
                disabled={selectedPrintableCount === 0}
              >
                <CheckSquare aria-hidden />
                {t("markdown.actions.printSelected")}
              </Button>
              <Button type="button" onClick={() => handlePrintMode("all")}>
                <Printer aria-hidden />
                {t("markdown.actions.printAll")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DocumentPageLayout>
  );
}
