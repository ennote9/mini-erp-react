import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ColumnSizingState } from "@tanstack/react-table";
import { ClipboardList, File, List, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SalesOrderItemAutocomplete } from "@/modules/sales-orders/components/SalesOrderItemAutocomplete";
import { BackButton } from "@/shared/ui/list/BackButton";
import { DocumentPageLayout } from "@/shared/ui/object/DocumentPageLayout";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { MarkdownCreateLinesTanstackTable } from "../components/MarkdownCreateLinesTanstackTable";
import {
  buildMarkdownCreateCodeGridColumns,
  buildMarkdownCreateLineGridColumns,
  type MarkdownCreateCodeGridRow,
  type MarkdownCreateLineGridRow,
} from "../markdownCreateLinesTanstackColumns";
import type { Item } from "@/modules/items/model";
import type { MarkdownJournal, MarkdownReasonCode } from "../model";
import { markdownJournalRepository } from "../journalRepository";
import {
  cancelMarkdownJournalDraft,
  createMarkdownJournalDraft,
  listMarkdownLinesForJournal,
  listMarkdownUnitsForJournal,
  postMarkdownJournal,
  updateMarkdownJournalDraft,
  type MarkdownJournalDraftLineInput,
} from "../service";
import { MARKDOWN_REASONS } from "../pageConfig";
import { cn } from "@/lib/utils";
import { appendReturnTo, readReturnToParam } from "@/shared/navigation/returnTo";
import { useUrlTabState } from "@/shared/navigation/useUrlTabState";

const DEFAULT_WAREHOUSE_ID = "1";
const LOCAL_ACTOR = "local-operator";

const MARKDOWN_CREATE_LINES_COL_SIZING_KEY = "mini-erp:markdown-create:lines:tanstack:columnSizing:v1";
const MARKDOWN_CREATE_CODES_COL_SIZING_KEY = "mini-erp:markdown-create:codes:tanstack:columnSizing:v1";

function readPersistedColumnSizing(key: string): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ColumnSizingState;
  } catch {
    return {};
  }
}

function writePersistedColumnSizing(key: string, value: ColumnSizingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

type LineFormRow = {
  _lineId: string;
  itemId: string;
  markdownPrice: number;
  quantity: number;
  reasonCode: MarkdownReasonCode;
};

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
): MarkdownCreateLineGridRow[] {
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
): MarkdownCreateCodeGridRow[] {
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
  const { formatMoney } = useAppDisplayFormatters();
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
  const [markdownLineGridColumnSizing, setMarkdownLineGridColumnSizing] = useState<ColumnSizingState>(() =>
    readPersistedColumnSizing(MARKDOWN_CREATE_LINES_COL_SIZING_KEY),
  );
  const [markdownCodeGridColumnSizing, setMarkdownCodeGridColumnSizing] = useState<ColumnSizingState>(() =>
    readPersistedColumnSizing(MARKDOWN_CREATE_CODES_COL_SIZING_KEY),
  );
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

  const lineGridTanstackColumns = useMemo(
    () => buildMarkdownCreateLineGridColumns(t, formatMoney),
    [t, formatMoney],
  );

  const codeGridTanstackColumns = useMemo(
    () => buildMarkdownCreateCodeGridColumns(t, formatMoney),
    [t, formatMoney],
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

  useEffect(() => {
    writePersistedColumnSizing(MARKDOWN_CREATE_LINES_COL_SIZING_KEY, markdownLineGridColumnSizing);
  }, [markdownLineGridColumnSizing]);

  useEffect(() => {
    writePersistedColumnSizing(MARKDOWN_CREATE_CODES_COL_SIZING_KEY, markdownCodeGridColumnSizing);
  }, [markdownCodeGridColumnSizing]);

  const getMarkdownLineGridRowClassName = useCallback(
    (row: MarkdownCreateLineGridRow) =>
      !isReadOnly && editingLineId === row.id ? "doc-lines__row--editing" : undefined,
    [isReadOnly, editingLineId],
  );

  const unitsCount = useMemo(
    () => (journal ? listMarkdownUnitsForJournal(journal.id).length : 0),
    [journal, appRevision],
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
                  <MarkdownCreateLinesTanstackTable<MarkdownCreateLineGridRow>
                    className="doc-lines-grid doc-lines-grid--markdown-create"
                    rows={gridRows}
                    dataColumns={lineGridTanstackColumns}
                    getRowId={(row) => row.id}
                    columnSizing={markdownLineGridColumnSizing}
                    onColumnSizingChange={setMarkdownLineGridColumnSizing}
                    onDataRowClick={isReadOnly ? undefined : (row) => handleEditLine(row.id)}
                    getRowClassName={getMarkdownLineGridRowClassName}
                    t={t}
                  />
                </div>
              )
            ) : codeRows.length === 0 ? (
              <p className="doc-lines__empty">{t("doc.page.noLines")}</p>
            ) : (
              <div className="doc-lines__grid doc-lines__grid--fixed-h h-[18rem] min-h-[18rem]">
                <MarkdownCreateLinesTanstackTable<MarkdownCreateCodeGridRow>
                  className="doc-lines-grid doc-lines-grid--markdown-create"
                  rows={codeRows}
                  dataColumns={codeGridTanstackColumns}
                  getRowId={(row) => row.id}
                  columnSizing={markdownCodeGridColumnSizing}
                  onColumnSizingChange={setMarkdownCodeGridColumnSizing}
                  t={t}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </DocumentPageLayout>
  );
}
