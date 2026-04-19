import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  exportTemplateTsvHeader,
  matchImportRows,
  mergeImportIntoDraft,
  parseLabelDataPaste,
  type ParsedImportRow,
} from "../lib/parseLabelDataImport";

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
  const [importPreview, setImportPreview] = useState<{
    matched: { itemId: string; row: ParsedImportRow }[];
    unmatched: { lineIndex: number; code?: string; barcode?: string }[];
    unknownHeaders: string[];
  } | null>(null);

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

  const filteredItems = useMemo(() => applyLabelDataFilter(searchedItems, filter), [searchedItems, filter]);

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
    if (!importPreview) return;
    const matched = importPreview.matched;
    setDraftById((prev) => {
      let next = { ...prev };
      for (const { itemId, row } of matched) {
        const cur = next[itemId] ?? persistedById[itemId] ?? emptyLabelDataDraft();
        next = { ...next, [itemId]: mergeImportIntoDraft(cur, row.fields as Partial<ItemLabelDataDraft>) };
      }
      return next;
    });
    setDirtyIds((prev) => {
      const n = new Set(prev);
      for (const { itemId } of matched) n.add(itemId);
      return n;
    });
    setImportOpen(false);
    setImportText("");
    setImportPreview(null);
    setFeedback({
      kind: "success",
      message: t("master.itemsLabelData.importApplied", { n: matched.length }),
    });
  }, [importPreview, persistedById, t]);

  const parseImportPreview = useCallback(() => {
    setFeedback(null);
    const parsed = parseLabelDataPaste(importText);
    if (parsed.rows.length === 0) {
      setFeedback({ kind: "error", message: t("master.itemsLabelData.importEmpty") });
      setImportPreview(null);
      return;
    }
    const { matched, unmatched } = matchImportRows(parsed.rows, allItems);
    setImportPreview({
      matched: matched.map((m) => ({ itemId: m.item.id, row: m.row })),
      unmatched: unmatched.map((u) => ({
        lineIndex: u.lineIndex,
        code: u.code,
        barcode: u.barcode,
      })),
      unknownHeaders: parsed.unknownHeaders,
    });
  }, [importText, allItems, t]);

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
    const header = exportTemplateTsvHeader();
    downloadTextFile("label-data-template.tsv", `\uFEFF${header}\n`, "text/tab-separated-values;charset=utf-8");
  }, []);

  return (
    <div className="mx-auto max-w-[1920px] space-y-3 p-3 md:p-4">
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

      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,720px)] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-lg focus:outline-none">
            <Dialog.Title className="text-sm font-semibold">{t("master.itemsLabelData.importTitle")}</Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground">
              {t("master.itemsLabelData.importHelp")}
            </Dialog.Description>
            <Textarea
              className="min-h-[180px] font-mono text-xs"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportPreview(null);
              }}
              placeholder={t("master.itemsLabelData.importPlaceholder")}
            />
            <Button type="button" size="sm" variant="secondary" className="w-fit" onClick={parseImportPreview}>
              {t("master.itemsLabelData.importPreview")}
            </Button>
            {importPreview ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                <p>{t("master.itemsLabelData.previewMatched", { n: importPreview.matched.length })}</p>
                <p>{t("master.itemsLabelData.previewUnmatched", { n: importPreview.unmatched.length })}</p>
                {importPreview.unmatched.length > 0 ? (
                  <ul className="max-h-24 list-inside list-disc overflow-y-auto text-destructive">
                    {importPreview.unmatched.slice(0, 20).map((u) => (
                      <li key={u.lineIndex}>
                        {t("master.itemsLabelData.previewUnmatchedLine", {
                          line: u.lineIndex,
                          code: u.code ?? "—",
                          barcode: u.barcode ?? "—",
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {importPreview.unknownHeaders.length > 0 ? (
                  <p className="text-amber-800 dark:text-amber-200">
                    {t("master.itemsLabelData.previewUnknownHeaders", {
                      headers: importPreview.unknownHeaders.join(", "),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" disabled={!importPreview || importPreview.matched.length === 0} onClick={runImportApply}>
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
    </div>
  );
}
