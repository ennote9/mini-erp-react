import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository } from "../repository";
import type { Item } from "../model";
import { markingRecordRepository } from "../markingRecordRepository";
import { importMarkingPoolBatch } from "../markingRecordService";
import {
  analyzeMarkingPoolImport,
  type MarkingPoolReviewRow,
} from "../lib/markingPoolImportAnalyze";
import {
  delimiterHintFromFilename,
  parseMarkingPoolText,
  type ParseMarkingPoolImportResult,
} from "../lib/parseMarkingPoolImport";
import { parseMarkingPoolXlsx, buildMarkingPoolTemplateXlsxBuffer } from "../lib/markingPoolImportXlsx";
import {
  buildMarkingPoolExportCsv,
  buildMarkingPoolExportTsv,
  buildMarkingPoolExportXlsxBuffer,
  buildMarkingPoolTemplateTsv,
} from "../lib/markingPoolExport";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

type ReviewSection = "all" | "applicable" | "issues";

export function ItemsMarkingImportPage() {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null);
  const [parsed, setParsed] = useState<ParseMarkingPoolImportResult | null>(null);
  const [allowDupFile, setAllowDupFile] = useState(false);
  const [ambiguousPick, setAmbiguousPick] = useState<Record<number, string>>({});
  const [reviewSection, setReviewSection] = useState<ReviewSection>("all");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo((): Item[] => {
    void revision;
    return itemRepository.list();
  }, [revision]);

  const existingRecords = useMemo(() => {
    void revision;
    return markingRecordRepository.list();
  }, [revision]);

  const analysis = useMemo(() => {
    if (!parsed?.rows.length) return null;
    return analyzeMarkingPoolImport(parsed.rows, allItems, existingRecords, {
      ambiguousResolution: ambiguousPick,
      allowDuplicatePayloadInFile: allowDupFile,
    });
  }, [parsed, allItems, existingRecords, ambiguousPick, allowDupFile]);

  const reviewRows = useMemo((): MarkingPoolReviewRow[] => {
    if (!analysis) return [];
    return [...analysis.reviewRows].sort((a, b) => a.lineIndex - b.lineIndex);
  }, [analysis]);

  const filteredReview = useMemo(() => {
    if (reviewSection === "all") return reviewRows;
    if (reviewSection === "applicable") return reviewRows.filter((r) => r.status === "applicable");
    return reviewRows.filter((r) => r.status !== "applicable");
  }, [reviewRows, reviewSection]);

  const runPreview = useCallback(async () => {
    setFeedback(null);
    try {
      if (xlsxBuffer) {
        const r = await parseMarkingPoolXlsx(xlsxBuffer);
        setParsed(r);
        return;
      }
      const text = pasteText.trim();
      if (!text) {
        setParsed(null);
        setFeedback({ kind: "error", message: t("master.markingImport.emptyInput") });
        return;
      }
      setParsed(parseMarkingPoolText(text));
    } catch (e) {
      setFeedback({
        kind: "error",
        message: t("master.markingImport.parseError"),
      });
      if (import.meta.env.DEV) console.error(e);
    }
  }, [pasteText, xlsxBuffer, t]);

  const onFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setFeedback(null);
      setFileName(f.name);
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".xlsx")) {
        const buf = await f.arrayBuffer();
        setXlsxBuffer(buf);
        setPasteText("");
        setParsed(await parseMarkingPoolXlsx(buf));
        return;
      }
      setXlsxBuffer(null);
      const text = await f.text();
      setPasteText(text);
      const hint = delimiterHintFromFilename(f.name);
      setParsed(parseMarkingPoolText(text, hint ? { delimiter: hint } : undefined));
    },
    [],
  );

  const clearFile = useCallback(() => {
    setFileName(null);
    setXlsxBuffer(null);
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleApply = useCallback(() => {
    setFeedback(null);
    if (!analysis || analysis.applicableRows.length === 0) {
      setFeedback({ kind: "error", message: t("master.markingImport.nothingApplicable") });
      return;
    }
    setApplying(true);
    try {
      const entries = analysis.applicableRows.map((row) => {
        const itemId = analysis.applicableResolvedItemIds.get(row.lineIndex);
        if (!itemId || !row.markingKind) throw new Error("INVALID_ROW");
        return {
          itemId,
          kind: row.markingKind,
          payload: row.payload.trim(),
          humanLabel: row.humanLabel,
          serial: row.serial,
          batchRef: row.batchRef,
          source: row.source ?? "IMPORT",
          note: row.note,
        };
      });
      const { created } = importMarkingPoolBatch(entries);
      setFeedback({
        kind: "success",
        message: t("master.markingImport.applySuccess", {
          created,
          skipped: analysis.stats.totalRows - created,
          ambiguous: analysis.stats.ambiguous,
          duplicates:
            analysis.stats.duplicateInFile +
            analysis.stats.duplicateExisting +
            analysis.stats.conflictOtherItem,
        }),
      });
      setParsed(null);
      setPasteText("");
      clearFile();
      setAmbiguousPick({});
    } catch (err) {
      setFeedback({ kind: "error", message: t("master.markingImport.applyError") });
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setApplying(false);
    }
  }, [analysis, t, clearFile]);

  const statusLabel = useCallback(
    (s: MarkingPoolReviewRow["status"]) => t(`master.markingImport.reviewStatus.${s}`),
    [t],
  );

  return (
    <div className="doc-page mx-auto max-w-6xl space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <Link to="/items" className="text-primary hover:underline">
              {t("master.item.listBreadcrumb")}
            </Link>
          </p>
          <h1 className="text-base font-semibold tracking-tight">{t("master.markingImport.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("master.markingImport.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              downloadTextFile(
                "marking-import-template.tsv",
                `${buildMarkingPoolTemplateTsv()}\n`,
                "text/tab-separated-values;charset=utf-8",
              )
            }
          >
            {t("master.markingImport.downloadTemplateTsv")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void buildMarkingPoolTemplateXlsxBuffer().then((buf) => downloadBlob("marking-import-template.xlsx", new Blob([buf], { type: XLSX_MIME })))}
          >
            {t("master.markingImport.downloadTemplateXlsx")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => downloadTextFile("marking-pool-export.tsv", buildMarkingPoolExportTsv(), "text/tab-separated-values;charset=utf-8")}
          >
            {t("master.markingImport.exportTsv")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => downloadTextFile("marking-pool-export.csv", buildMarkingPoolExportCsv(), "text/csv;charset=utf-8")}
          >
            {t("master.markingImport.exportCsv")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void buildMarkingPoolExportXlsxBuffer().then((buf) => downloadBlob("marking-pool-export.xlsx", new Blob([buf], { type: XLSX_MIME })))}
          >
            {t("master.markingImport.exportXlsx")}
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-destructive/50 bg-destructive/10"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-md border border-border/80 bg-card/40 p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("master.markingImport.pasteLabel")}</Label>
          <Textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setXlsxBuffer(null);
              setFileName(null);
            }}
            placeholder={t("master.markingImport.pastePlaceholder")}
            rows={5}
            className="font-mono text-xs"
            disabled={!!xlsxBuffer}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("master.markingImport.fileLabel")}</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".tsv,.csv,.txt,.xlsx"
              className="block text-xs"
              onChange={(e) => void onFile(e)}
            />
          </div>
          {fileName ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFile}>
              {t("master.markingImport.clearFile")}
            </Button>
          ) : null}
          <Button type="button" size="sm" className="h-8" onClick={() => void runPreview()}>
            {t("master.markingImport.preview")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="mp-allow-dup"
            checked={allowDupFile}
            onCheckedChange={(v) => setAllowDupFile(v === true)}
          />
          <Label htmlFor="mp-allow-dup" className="text-xs font-normal">
            {t("master.markingImport.allowDupInFile")}
          </Label>
        </div>
        {parsed && parsed.unknownHeaders.length > 0 ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            {t("master.markingImport.unknownHeaders", { headers: parsed.unknownHeaders.join(", ") })}
          </p>
        ) : null}
      </section>

      {analysis ? (
        <section className="space-y-2 rounded-md border border-border/80 bg-card/30 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("master.markingImport.reportTitle")}</h2>
          <ul className="grid gap-1 text-[11px] sm:grid-cols-2">
            <li>{t("master.markingImport.statTotal", { n: analysis.stats.totalRows })}</li>
            <li>{t("master.markingImport.statApplicable", { n: analysis.stats.applicableCount })}</li>
            <li>{t("master.markingImport.statNotFound", { n: analysis.stats.notFound })}</li>
            <li>{t("master.markingImport.statAmbiguous", { n: analysis.stats.ambiguous })}</li>
            <li>{t("master.markingImport.statDupFile", { n: analysis.stats.duplicateInFile })}</li>
            <li>{t("master.markingImport.statDupExisting", { n: analysis.stats.duplicateExisting })}</li>
            <li>{t("master.markingImport.statConflict", { n: analysis.stats.conflictOtherItem })}</li>
            <li>{t("master.markingImport.statInvalid", { n: analysis.stats.invalidKind + analysis.stats.missingPayload })}</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[11px]">{t("master.markingImport.reviewFilter")}</Label>
            <SelectField
              value={reviewSection}
              onChange={(v) => setReviewSection(v as ReviewSection)}
              options={[
                { value: "all", label: t("master.markingImport.reviewAll") },
                { value: "applicable", label: t("master.markingImport.reviewApplicable") },
                { value: "issues", label: t("master.markingImport.reviewIssues") },
              ]}
              placeholder=""
              className="h-8 w-44 text-xs"
            />
          </div>

          <div className="overflow-x-auto rounded border border-border/60">
            <table className="w-full min-w-[800px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                  <th className="px-2 py-1">{t("master.markingImport.colLine")}</th>
                  <th className="px-2 py-1">{t("master.markingImport.colStatus")}</th>
                  <th className="px-2 py-1">{t("master.markingImport.colItem")}</th>
                  <th className="px-2 py-1">{t("master.markingImport.colKind")}</th>
                  <th className="px-2 py-1">{t("master.markingImport.colPayload")}</th>
                  <th className="px-2 py-1 min-w-[12rem]">{t("master.markingImport.colResolve")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReview.map((row) => (
                  <tr key={row.lineIndex} className="border-b border-border/40">
                    <td className="px-2 py-1 font-mono">{row.lineIndex}</td>
                    <td className="px-2 py-1">{statusLabel(row.status)}</td>
                    <td className="px-2 py-1">
                      {row.itemCode ? (
                        <span>
                          {row.itemCode} · {row.itemName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1 font-mono">{row.kind ?? "—"}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1 font-mono" title={row.payload}>
                      {row.payload}
                    </td>
                    <td className="px-2 py-1">
                      {row.status === "ambiguous" && row.candidateIds?.length ? (
                        <SelectField
                          value={ambiguousPick[row.lineIndex] ?? ""}
                          onChange={(v) => setAmbiguousPick((p) => ({ ...p, [row.lineIndex]: v }))}
                          options={[
                            { value: "", label: t("master.markingImport.pickItem") },
                            ...row.candidateIds.map((id) => {
                              const it = allItems.find((x) => x.id === id);
                              return { value: id, label: it ? `${it.code} · ${it.name}` : id };
                            }),
                          ]}
                          placeholder=""
                          className="h-7 text-[10px]"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={applying || analysis.applicableRows.length === 0}
              onClick={handleApply}
            >
              {applying ? t("common.loading") : t("master.markingImport.apply")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
