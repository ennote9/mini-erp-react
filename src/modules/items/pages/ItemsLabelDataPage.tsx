import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "radix-ui";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository, flushPendingItemsPersist } from "../repository";
import type { Item } from "../model";
import {
  applyLabelDataFilter,
  diffLabelDraftPatch,
  emptyLabelDataDraft,
  itemToLabelDataDraft,
  LABEL_DATA_FIELD_KEYS,
  type ItemLabelDataDraft,
  type LabelDataFilter,
  primaryBarcodeValue,
} from "../lib/itemLabelDataBulk";
import {
  analyzeLabelDataImport,
  buildImportReviewRows,
  buildLabelDataExportTsv,
  buildLabelDataTemplateFileContent,
  delimiterHintFromFilename,
  mergeImportIntoDraft,
  parseLabelDataText,
  type AnalyzeLabelDataImportOptions,
  type ImportReviewRow,
  type LabelDataImportAnalysis,
  type ParseLabelDataImportResult,
} from "../lib/parseLabelDataImport";
import {
  buildLabelDataExportXlsxBuffer,
  buildLabelDataTemplateXlsxBuffer,
  parseLabelDataXlsx,
} from "../lib/labelDataImportXlsx";
import { ItemsModuleLayout } from "../components/ItemsModuleLayout";

type ViewMode = "all" | "translation" | "marking";

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type DuplicatePolicy = NonNullable<AnalyzeLabelDataImportOptions["duplicateKeyPolicy"]>;
type MergePolicy = NonNullable<AnalyzeLabelDataImportOptions["mergePolicy"]>;
type ReviewSection = "all" | "applicable" | "skipped";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function ItemsLabelDataPage() {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<LabelDataFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [persistedById, setPersistedById] = useState<Record<string, ItemLabelDataDraft>>({});
  const [draftById, setDraftById] = useState<Record<string, ItemLabelDataDraft>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>(null);
  const [importParsedSnapshot, setImportParsedSnapshot] = useState<ParseLabelDataImportResult | null>(null);
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("exclude_all");
  const [mergePolicy, setMergePolicy] = useState<MergePolicy>("strict");
  const [ambiguousPickByLine, setAmbiguousPickByLine] = useState<Record<number, string>>({});
  const [reviewSection, setReviewSection] = useState<ReviewSection>("all");
  const [importSkippedIds, setImportSkippedIds] = useState<Set<string>>(() => new Set());
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkField, setBulkField] = useState<keyof ItemLabelDataDraft>("translationName");
  const [bulkValue, setBulkValue] = useState("");

  const allItems = useMemo((): Item[] => {
    void revision;
    return itemRepository.list();
  }, [revision]);

  const dirtyRef = useRef(dirtyIds);
  useEffect(() => {
    dirtyRef.current = dirtyIds;
  }, [dirtyIds]);

  useEffect(() => {
    void revision;
    const dirty = dirtyRef.current;
    setPersistedById((prev) => {
      const next = { ...prev };
      for (const it of allItems) {
        if (!dirty.has(it.id)) {
          next[it.id] = itemToLabelDataDraft(it);
        }
      }
      return next;
    });
    setDraftById((prev) => {
      const next = { ...prev };
      for (const it of allItems) {
        if (!dirty.has(it.id)) {
          next[it.id] = itemToLabelDataDraft(it);
        }
      }
      return next;
    });
  }, [revision, allItems]);

  const searchedItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return allItems;
    return itemRepository.search(q);
  }, [allItems, searchQuery]);

  const filteredItems = useMemo(
    () =>
      applyLabelDataFilter(searchedItems, filter, {
        dirtyIds,
        importSkippedIds,
        draftById,
      }),
    [searchedItems, filter, dirtyIds, importSkippedIds, draftById],
  );

  const importAnalysis = useMemo((): LabelDataImportAnalysis | null => {
    if (!importParsedSnapshot) return null;
    return analyzeLabelDataImport(importParsedSnapshot, allItems, {
      duplicateKeyPolicy: duplicatePolicy,
      mergePolicy: mergePolicy,
      ambiguousResolution: ambiguousPickByLine,
    });
  }, [importParsedSnapshot, allItems, duplicatePolicy, mergePolicy, ambiguousPickByLine]);

  const importReviewRows = useMemo((): ImportReviewRow[] => {
    if (!importParsedSnapshot || !importAnalysis) return [];
    return buildImportReviewRows(importParsedSnapshot, importAnalysis);
  }, [importParsedSnapshot, importAnalysis]);

  const filteredReviewRows = useMemo(() => {
    if (reviewSection === "all") return importReviewRows;
    if (reviewSection === "applicable") return importReviewRows.filter((r) => r.status === "applicable");
    return importReviewRows.filter((r) => r.status !== "applicable");
  }, [importReviewRows, reviewSection]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((x) => x.id)));
  }, [filteredItems]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const updateDraft = useCallback((id: string, patch: Partial<ItemLabelDataDraft>) => {
    setDraftById((prev) => {
      const cur = prev[id] ?? emptyLabelDataDraft();
      return { ...prev, [id]: { ...cur, ...patch } };
    });
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  const handleReset = useCallback(() => {
    setFeedback(null);
    setDraftById((d) => {
      const next = { ...d };
      for (const id of dirtyIds) {
        next[id] = { ...(persistedById[id] ?? emptyLabelDataDraft()) };
      }
      return next;
    });
    setDirtyIds(new Set());
  }, [dirtyIds, persistedById]);

  const handleApply = useCallback(async () => {
    setFeedback(null);
    if (dirtyIds.size === 0) {
      setFeedback({ kind: "error", message: t("master.itemsLabelData.nothingToSave") });
      return;
    }
    setSaving(true);
    const errors: string[] = [];
    try {
      for (const id of dirtyIds) {
        const base = persistedById[id] ?? emptyLabelDataDraft();
        const draft = draftById[id] ?? base;
        const patch = diffLabelDraftPatch(base, draft);
        if (Object.keys(patch).length === 0) continue;
        const updated = itemRepository.update(id, patch);
        if (!updated) errors.push(t("master.itemsLabelData.rowSaveMissing", { id }));
      }
      await flushPendingItemsPersist().catch(() => undefined);
      if (errors.length > 0) {
        setFeedback({ kind: "error", message: errors.join(" ") });
      } else {
        setFeedback({ kind: "success", message: t("master.itemsLabelData.saveSuccess", { count: dirtyIds.size }) });
        setDirtyIds(new Set());
      }
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : t("master.itemsLabelData.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  }, [dirtyIds, draftById, persistedById, t]);

  const runImportApply = useCallback(() => {
    if (!importAnalysis || importAnalysis.applicable.length === 0) return;
    const applicable = importAnalysis.applicable;
    setDraftById((prev) => {
      let next = { ...prev };
      for (const { item, mergedFields } of applicable) {
        const cur = next[item.id] ?? persistedById[item.id] ?? emptyLabelDataDraft();
        next = { ...next, [item.id]: mergeImportIntoDraft(cur, mergedFields) };
      }
      return next;
    });
    setDirtyIds((prev) => {
      const n = new Set(prev);
      for (const { item } of applicable) n.add(item.id);
      return n;
    });
    const skipped = new Set<string>();
    for (const c of importAnalysis.conflicts) skipped.add(c.item.id);
    for (const a of importAnalysis.ambiguous) {
      for (const it of a.candidates) skipped.add(it.id);
    }
    setImportSkippedIds(skipped);

    setImportOpen(false);
    setImportText("");
    setLastImportedFileName(null);
    setImportParsedSnapshot(null);
    setXlsxBuffer(null);
    setAmbiguousPickByLine({});
    setFeedback({
      kind: "success",
      message: t("master.itemsLabelData.importAppliedDetail", {
        items: applicable.length,
        rows: applicable.reduce((n, a) => n + a.sourceRows.length, 0),
      }),
    });
  }, [importAnalysis, persistedById, t]);

  const runImportPreview = useCallback(async () => {
    setFeedback(null);
    let parsed: ParseLabelDataImportResult;
    try {
      if (xlsxBuffer) {
        parsed = await parseLabelDataXlsx(xlsxBuffer);
      } else {
        const hint = lastImportedFileName ? delimiterHintFromFilename(lastImportedFileName) : undefined;
        parsed = parseLabelDataText(importText, hint ? { delimiter: hint } : undefined);
      }
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : t("master.itemsLabelData.importParseError"),
      });
      return;
    }
    if (parsed.rows.length === 0) {
      setFeedback({ kind: "error", message: t("master.itemsLabelData.importEmpty") });
      setImportParsedSnapshot(null);
      return;
    }
    setImportParsedSnapshot(parsed);
    setAmbiguousPickByLine({});
  }, [xlsxBuffer, lastImportedFileName, importText, t]);

  const onImportFileSelected = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLastImportedFileName(file.name);
    setImportParsedSnapshot(null);
    setFeedback(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx")) {
      try {
        setXlsxBuffer(await file.arrayBuffer());
        setImportText("");
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : t("master.itemsLabelData.importParseError"),
        });
      }
      return;
    }
    setXlsxBuffer(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }, [t]);

  const applyBulk = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      updateDraft(id, { [bulkField]: bulkValue } as Partial<ItemLabelDataDraft>);
    }
    setBulkOpen(false);
    setBulkValue("");
  }, [bulkField, bulkValue, selectedIds, updateDraft]);

  const bulkClearField = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      updateDraft(id, { [bulkField]: "" } as Partial<ItemLabelDataDraft>);
    }
    setBulkOpen(false);
  }, [bulkField, selectedIds, updateDraft]);

  const bulkTranslationFromName = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const it = allItems.find((x) => x.id === id);
      if (!it) continue;
      updateDraft(id, { translationName: it.name });
    }
  }, [allItems, selectedIds, updateDraft]);

  const bulkMarkingFromPrimaryBarcode = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const it = allItems.find((x) => x.id === id);
      if (!it) continue;
      const v = primaryBarcodeValue(it);
      if (v) updateDraft(id, { markingCode: v });
    }
  }, [allItems, selectedIds, updateDraft]);

  const filterOptions = useMemo(
    () =>
      (
        [
          ["all", t("master.itemsLabelData.filter.all")],
          ["dirty_only", t("master.itemsLabelData.filter.dirty_only")],
          ["import_skipped", t("master.itemsLabelData.filter.import_skipped")],
          ["no_translation", t("master.itemsLabelData.filter.no_translation")],
          ["no_marking", t("master.itemsLabelData.filter.no_marking")],
          ["no_datamatrix", t("master.itemsLabelData.filter.no_datamatrix")],
          ["no_kiz_marking", t("master.itemsLabelData.filter.no_kiz_marking")],
          ["issues", t("master.itemsLabelData.filter.issues")],
        ] as const
      ).map(([value, label]) => ({ value, label })),
    [t],
  );

  const viewOptions = useMemo(
    () =>
      (
        [
          ["all", t("master.itemsLabelData.view.all")],
          ["translation", t("master.itemsLabelData.view.translation")],
          ["marking", t("master.itemsLabelData.view.marking")],
        ] as const
      ).map(([value, label]) => ({ value, label })),
    [t],
  );

  const bulkFieldOptions = useMemo(
    () =>
      LABEL_DATA_FIELD_KEYS.map((k) => ({
        value: k,
        label: t(`master.item.labelData.${k}` as "master.item.labelData.translationName"),
      })),
    [t],
  );

  const showCol = useCallback(
    (k: keyof ItemLabelDataDraft) => {
      if (viewMode === "all") return true;
      const trans: (keyof ItemLabelDataDraft)[] = [
        "translationName",
        "translationDescription",
        "translationComposition",
        "translationCountry",
        "translationImporter",
        "translationExtraText",
      ];
      const mark: (keyof ItemLabelDataDraft)[] = [
        "markingCode",
        "kizCode",
        "dataMatrixPayload",
        "gs1DataMatrixPayload",
        "markingComment",
      ];
      if (viewMode === "translation") return trans.includes(k);
      return mark.includes(k);
    },
    [viewMode],
  );

  const exportTemplate = useCallback(() => {
    downloadTextFile(
      "label-data-template.tsv",
      buildLabelDataTemplateFileContent(),
      "text/tab-separated-values;charset=utf-8",
    );
  }, []);

  const exportTemplateXlsx = useCallback(async () => {
    try {
      const buf = await buildLabelDataTemplateXlsxBuffer();
      downloadBlob("label-data-template.xlsx", new Blob([buf], { type: XLSX_MIME }));
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : t("master.itemsLabelData.exportFailed"),
      });
    }
  }, [t]);

  const exportCurrentData = useCallback(() => {
    const rows =
      selectedIds.size > 0 ? filteredItems.filter((i) => selectedIds.has(i.id)) : filteredItems;
    if (rows.length === 0) {
      setFeedback({ kind: "error", message: t("master.itemsLabelData.exportNothing") });
      return;
    }
    const tsv = buildLabelDataExportTsv(rows, draftById);
    downloadTextFile("label-data-export.tsv", tsv, "text/tab-separated-values;charset=utf-8");
    setFeedback({ kind: "success", message: t("master.itemsLabelData.exportDone", { n: rows.length }) });
  }, [selectedIds, filteredItems, draftById, t]);

  const exportCurrentDataXlsx = useCallback(async () => {
    const rows =
      selectedIds.size > 0 ? filteredItems.filter((i) => selectedIds.has(i.id)) : filteredItems;
    if (rows.length === 0) {
      setFeedback({ kind: "error", message: t("master.itemsLabelData.exportNothing") });
      return;
    }
    try {
      const buf = await buildLabelDataExportXlsxBuffer(rows, draftById);
      downloadBlob("label-data-export.xlsx", new Blob([buf], { type: XLSX_MIME }));
      setFeedback({ kind: "success", message: t("master.itemsLabelData.exportDoneXlsx", { n: rows.length }) });
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : t("master.itemsLabelData.exportFailed"),
      });
    }
  }, [selectedIds, filteredItems, draftById, t]);

  return (
    <ItemsModuleLayout
      className="flex min-h-0 min-w-0 flex-col gap-3"
      contentVariant="full"
      contentClassName="space-y-3 p-3 md:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">{t("master.itemsLabelData.pageTitle")}</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{t("master.itemsLabelData.intro")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/items">{t("master.itemsLabelData.backToItems")}</Link>
        </Button>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`rounded-md border px-2 py-1.5 text-xs ${
            feedback.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
              : "border-destructive/45 bg-destructive/10 text-foreground"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="space-y-2 rounded-md border border-border/80 bg-card/40 p-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[min(100%,14rem)] flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.searchLabel")}</Label>
            <Input
              className="h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("master.itemsLabelData.searchPlaceholder")}
            />
          </div>
          <div className="w-[min(100%,12rem)] space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.filterLabel")}</Label>
            <SelectField
              value={filter}
              onChange={(v) => setFilter(v as LabelDataFilter)}
              options={filterOptions}
              placeholder=""
              className="w-full max-w-full"
              aria-label={t("master.itemsLabelData.filterLabel")}
            />
          </div>
          <div className="w-[min(100%,11rem)] space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.viewLabel")}</Label>
            <SelectField
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={viewOptions}
              placeholder=""
              className="w-full max-w-full"
              aria-label={t("master.itemsLabelData.viewLabel")}
            />
          </div>
        </div>
        {dirtyIds.size > 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.applySummary", { count: dirtyIds.size })}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="h-8" disabled={saving || dirtyIds.size === 0} onClick={() => void handleApply()}>
            {saving ? t("common.loading") : t("master.itemsLabelData.apply")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={dirtyIds.size === 0} onClick={handleReset}>
            {t("master.itemsLabelData.reset")}
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => setImportOpen(true)}>
            {t("master.itemsLabelData.import")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={exportTemplate}>
            {t("master.itemsLabelData.exportTemplate")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void exportTemplateXlsx()}>
            {t("master.itemsLabelData.exportTemplateXlsx")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={exportCurrentData}>
            {t("master.itemsLabelData.exportData")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void exportCurrentDataXlsx()}>
            {t("master.itemsLabelData.exportDataXlsx")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={selectedIds.size === 0} onClick={() => setBulkOpen(true)}>
            {t("master.itemsLabelData.bulkFill")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={selectAllVisible}>
            {t("master.itemsLabelData.selectAllVisible")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
            {t("master.itemsLabelData.clearSelection")}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {t("master.itemsLabelData.stats", {
              shown: filteredItems.length,
              dirty: dirtyIds.size,
              selected: selectedIds.size,
            })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-2">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={selectedIds.size === 0} onClick={bulkTranslationFromName}>
            {t("master.itemsLabelData.quickTranslationName")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={selectedIds.size === 0}
            onClick={bulkMarkingFromPrimaryBarcode}
          >
            {t("master.itemsLabelData.quickMarkingBarcode")}
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-md border border-border/80">
        <table className="w-full min-w-[1200px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 w-8 bg-muted/30 px-1 py-1.5">
                <Checkbox
                  checked={filteredItems.length > 0 && filteredItems.every((x) => selectedIds.has(x.id))}
                  onCheckedChange={(c) => (c === true ? selectAllVisible() : clearSelection())}
                  aria-label={t("master.itemsLabelData.selectAllVisible")}
                />
              </th>
              <th className="px-2 py-1.5">{t("master.related.colCode")}</th>
              <th className="px-2 py-1.5">{t("master.related.colName")}</th>
              <th className="px-2 py-1.5">{t("master.item.barcodeLabel")}</th>
              {LABEL_DATA_FIELD_KEYS.map((k) =>
                showCol(k) ? (
                  <th key={k} className="min-w-[7rem] px-1 py-1.5">
                    {t(`master.item.labelData.${k}` as "master.item.labelData.translationName")}
                  </th>
                ) : null,
              )}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const draft = draftById[item.id] ?? itemToLabelDataDraft(item);
              const dirty = dirtyIds.has(item.id);
              const bc = primaryBarcodeValue(item);
              return (
                <tr
                  key={item.id}
                  className={`border-b border-border/40 ${dirty ? "bg-amber-500/5" : ""} hover:bg-muted/20`}
                >
                  <td className="sticky left-0 z-10 bg-background/95 px-1 py-0.5">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      aria-label={item.code}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-0.5 font-mono">
                    <Link className="text-primary underline-offset-2 hover:underline" to={`/items/${item.id}`}>
                      {item.code}
                    </Link>
                  </td>
                  <td className="max-w-[10rem] truncate px-2 py-0.5" title={item.name}>
                    {item.name}
                  </td>
                  <td className="max-w-[8rem] truncate font-mono px-2 py-0.5" title={bc}>
                    {bc || "—"}
                  </td>
                  {LABEL_DATA_FIELD_KEYS.map((k) =>
                    showCol(k) ? (
                      <td key={k} className="px-0.5 py-0.5">
                        <Input
                          className="h-7 min-w-[6rem] font-mono text-[11px]"
                          value={draft[k]}
                          onChange={(e) => updateDraft(item.id, { [k]: e.target.value } as Partial<ItemLabelDataDraft>)}
                        />
                      </td>
                    ) : null,
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t("master.itemsLabelData.empty")}</p>
        ) : null}
      </div>

      <Dialog.Root
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportParsedSnapshot(null);
            setLastImportedFileName(null);
            setXlsxBuffer(null);
            setAmbiguousPickByLine({});
            setDuplicatePolicy("exclude_all");
            setMergePolicy("strict");
            setReviewSection("all");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(92vh,820px)] w-[min(96vw,900px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-lg focus:outline-none">
            <Dialog.Title className="text-sm font-semibold">{t("master.itemsLabelData.importTitle")}</Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground">
              {t("master.itemsLabelData.importHelp")}
            </Dialog.Description>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".tsv,.csv,.xlsx,text/tab-separated-values,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                className="sr-only"
                aria-hidden
                onChange={onImportFileSelected}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => importFileInputRef.current?.click()}
              >
                {t("master.itemsLabelData.importFromFile")}
              </Button>
              {lastImportedFileName ? (
                <span className="text-[11px] text-muted-foreground">{lastImportedFileName}</span>
              ) : null}
              {xlsxBuffer ? (
                <span className="text-[11px] text-amber-800 dark:text-amber-200">{t("master.itemsLabelData.xlsxLoadedHint")}</span>
              ) : null}
            </div>
            <Textarea
              className="min-h-[160px] font-mono text-xs"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportParsedSnapshot(null);
                setXlsxBuffer(null);
                setLastImportedFileName(null);
              }}
              placeholder={t("master.itemsLabelData.importPlaceholder")}
              disabled={!!xlsxBuffer}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.duplicatePolicyLabel")}</span>
              <Button
                type="button"
                size="sm"
                variant={duplicatePolicy === "exclude_all" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDuplicatePolicy("exclude_all")}
              >
                {t("master.itemsLabelData.duplicatePolicyExclude")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={duplicatePolicy === "keep_last" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDuplicatePolicy("keep_last")}
              >
                {t("master.itemsLabelData.duplicatePolicyLast")}
              </Button>
              <span className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.mergePolicyLabel")}</span>
              <Button
                type="button"
                size="sm"
                variant={mergePolicy === "strict" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => setMergePolicy("strict")}
              >
                {t("master.itemsLabelData.mergePolicyStrict")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mergePolicy === "last_wins" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => setMergePolicy("last_wins")}
              >
                {t("master.itemsLabelData.mergePolicyLast")}
              </Button>
            </div>
            <Button type="button" size="sm" variant="secondary" className="w-fit" onClick={() => void runImportPreview()}>
              {t("master.itemsLabelData.importPreview")}
            </Button>
            {importAnalysis ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
                  <li>{t("master.itemsLabelData.report.sourceRows", { n: importAnalysis.sourceRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.unknownHeaders", { n: importAnalysis.unknownHeaderCount })}</li>
                  <li>{t("master.itemsLabelData.report.duplicateKeys", { n: importAnalysis.duplicateKeyRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.notFound", { n: importAnalysis.notFoundRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.ambiguous", { n: importAnalysis.ambiguousRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.conflicts", { n: importAnalysis.conflictRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.applicableRows", { n: importAnalysis.applicableRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.skippedRows", { n: importAnalysis.skippedRowCount })}</li>
                  <li>{t("master.itemsLabelData.report.unresolvedAmbiguous", { n: importAnalysis.unresolvedAmbiguousCount })}</li>
                  <li className="sm:col-span-2 lg:col-span-3 font-medium text-foreground">
                    {t("master.itemsLabelData.report.willApply", { n: importAnalysis.applicable.length })}
                  </li>
                </ul>
                {importAnalysis.unknownHeaders.length > 0 ? (
                  <p className="text-amber-800 dark:text-amber-200">
                    {t("master.itemsLabelData.previewUnknownHeaders", {
                      headers: importAnalysis.unknownHeaders.join(", "),
                    })}
                  </p>
                ) : null}
                {importAnalysis.duplicateKeyLineIndices.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium text-destructive">{t("master.itemsLabelData.report.duplicateTitle")}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {importAnalysis.duplicateKeyLineIndices.slice(0, 40).join(", ")}
                      {importAnalysis.duplicateKeyLineIndices.length > 40 ? "…" : ""}
                    </p>
                  </div>
                ) : null}
                {importAnalysis.notFound.length > 0 ? (
                  <ul className="max-h-20 list-inside list-disc overflow-y-auto text-destructive">
                    {importAnalysis.notFound.slice(0, 15).map((r) => (
                      <li key={r.lineIndex}>
                        {t("master.itemsLabelData.previewUnmatchedLine", {
                          line: r.lineIndex,
                          code: r.rawCode ?? "—",
                          barcode: r.rawBarcode ?? "—",
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {importAnalysis.ambiguous.length > 0 ? (
                  <ul className="max-h-20 list-inside list-disc overflow-y-auto text-amber-800 dark:text-amber-200">
                    {importAnalysis.ambiguous.slice(0, 15).map((a) => (
                      <li key={a.row.lineIndex}>
                        {t("master.itemsLabelData.report.ambiguousLine", {
                          line: a.row.lineIndex,
                          codes: a.candidates.map((c) => c.code).join(", "),
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {importAnalysis.conflicts.length > 0 ? (
                  <ul className="max-h-24 list-inside list-disc overflow-y-auto text-destructive">
                    {importAnalysis.conflicts.slice(0, 15).map((c, i) => (
                      <li key={`${c.item.id}-${i}`}>
                        {t("master.itemsLabelData.report.conflictLine", {
                          code: c.item.code,
                          lines: c.lineIndices.join(", "),
                          field: t(`master.item.labelData.${c.field}` as "master.item.labelData.translationName"),
                          a: c.values[0],
                          b: c.values[1],
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                  <span className="text-[11px] text-muted-foreground">{t("master.itemsLabelData.reviewFilterLabel")}</span>
                  <SelectField
                    value={reviewSection}
                    onChange={(v) => setReviewSection(v as ReviewSection)}
                    options={[
                      { value: "all", label: t("master.itemsLabelData.reviewSectionAll") },
                      { value: "applicable", label: t("master.itemsLabelData.reviewSectionApplicable") },
                      { value: "skipped", label: t("master.itemsLabelData.reviewSectionSkipped") },
                    ]}
                    placeholder=""
                    className="h-8 w-[min(100%,11rem)] text-xs"
                    aria-label={t("master.itemsLabelData.reviewFilterLabel")}
                  />
                </div>
                <div className="max-h-[min(40vh,280px)] overflow-auto rounded border border-border/50">
                  <table className="w-full min-w-[640px] border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] uppercase text-muted-foreground">
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColLine")}</th>
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColStatus")}</th>
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColKey")}</th>
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColTarget")}</th>
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColSummary")}</th>
                        <th className="px-1.5 py-1">{t("master.itemsLabelData.reviewColResolve")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReviewRows.map((rr) => {
                        const amb = importAnalysis.ambiguous.find((x) => x.row.lineIndex === rr.lineIndex);
                        return (
                          <tr key={rr.lineIndex} className="border-b border-border/30">
                            <td className="whitespace-nowrap px-1.5 py-0.5 font-mono">{rr.lineIndex}</td>
                            <td className="px-1.5 py-0.5">
                              {t(`master.itemsLabelData.reviewStatus.${rr.status}` as "master.itemsLabelData.reviewStatus.applicable")}
                            </td>
                            <td className="max-w-[8rem] truncate font-mono px-1.5 py-0.5" title={rr.key}>
                              {rr.key}
                            </td>
                            <td className="max-w-[10rem] truncate px-1.5 py-0.5" title={rr.targetCode}>
                              {rr.targetCode ? `${rr.targetCode}${rr.targetName ? ` · ${rr.targetName}` : ""}` : "—"}
                            </td>
                            <td className="max-w-[14rem] truncate text-muted-foreground" title={rr.summary}>
                              {rr.summary}
                            </td>
                            <td className="min-w-[10rem] px-0.5 py-0.5">
                              {amb ? (
                                <SelectField
                                  value={ambiguousPickByLine[rr.lineIndex] ?? ""}
                                  onChange={(v) =>
                                    setAmbiguousPickByLine((prev) => ({ ...prev, [rr.lineIndex]: v }))
                                  }
                                  options={[
                                    { value: "", label: t("master.itemsLabelData.ambiguousPickPlaceholder") },
                                    ...amb.candidates.map((it) => ({
                                      value: it.id,
                                      label: `${it.code} — ${it.name}`,
                                    })),
                                  ]}
                                  placeholder=""
                                  className="h-7 w-full max-w-[220px] text-[10px]"
                                  aria-label={t("master.itemsLabelData.reviewColResolve")}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!importAnalysis || importAnalysis.applicable.length === 0}
                onClick={runImportApply}
              >
                {t("master.itemsLabelData.importApply")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={bulkOpen} onOpenChange={setBulkOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-3 shadow-lg focus:outline-none">
            <Dialog.Title className="text-sm font-semibold">{t("master.itemsLabelData.bulkTitle")}</Dialog.Title>
            <div className="mt-2 space-y-2">
              <Label className="text-xs">{t("master.itemsLabelData.bulkField")}</Label>
              <SelectField
                value={bulkField}
                onChange={(v) => setBulkField(v as keyof ItemLabelDataDraft)}
                options={bulkFieldOptions}
                placeholder=""
                className="w-full max-w-full"
              />
              <Label className="text-xs">{t("master.itemsLabelData.bulkValue")}</Label>
              <Input className="h-8 text-xs" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-2">
              <Button type="button" variant="outline" onClick={bulkClearField}>
                {t("master.itemsLabelData.bulkClear")}
              </Button>
              <Button type="button" onClick={applyBulk}>
                {t("master.itemsLabelData.bulkApply")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ItemsModuleLayout>
  );
}
