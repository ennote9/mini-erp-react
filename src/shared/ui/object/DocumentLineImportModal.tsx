import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Check,
  CircleCheck,
  ClipboardPaste,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FolderOpen,
  X,
} from "lucide-react";
import type { Item } from "../../../modules/items/model";
import { roundMoney } from "../../commercialMoney";
import {
  resolveBatchPastedItems,
  type BatchPastePreview,
} from "../../batchPasteItems";
import {
  buildLineImportTemplateXlsxBuffer,
  parseExcelLineImport,
  type ExcelImportPreview,
  type LineImportHeaderSynonyms,
  type LineImportParseLabels,
  type LineImportTemplateLabels,
} from "../../excelLineImport";
import { useTranslation } from "@/shared/i18n/context";
import type { TFunction } from "@/shared/i18n/resolve";

function importRowStatusLabel(t: TFunction, status: string): string {
  return t(`ops.importModal.rowStatus.${status}`);
}

export type LineImportTab = "paste" | "excel";

export type ResolvedImportLine = {
  itemId: string;
  qty: number;
  unitPrice: number;
};

type PreviewFilter = "all" | "errors" | "valid";

type TemplateDownloadResult = {
  filename: string;
  path: string | null;
};

type ApplyPayload = {
  lines: ResolvedImportLine[];
  skippedRows: number;
};

type Props = {
  open: boolean;
  initialTab: LineImportTab;
  items: Item[];
  getDefaultUnitPrice: (item: Item) => number;
  templateFileName?: string;
  /** Localized name shown after download; file on disk remains `templateFileName`. */
  templateDisplayLabel?: string;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: ApplyPayload) => void;
};

function PasteSummary({ preview }: { preview: BatchPastePreview }) {
  const { t } = useTranslation();
  return (
    <div>
      {t("ops.importModal.summaryPaste", {
        total: preview.totalLines,
        valid: preview.validMatchCount,
        inactive: preview.inactiveCount,
        notFound: preview.notFoundCount,
        badQty: preview.invalidQuantityCount,
        badFmt: preview.invalidFormatCount,
        headerSkipped: preview.headerSkippedCount,
        merged: preview.mergedDuplicateCount,
        extraCols: preview.extraColumnsIgnoredCount,
      })}
    </div>
  );
}

function ExcelSummary({ preview }: { preview: ExcelImportPreview }) {
  const { t } = useTranslation();
  return (
    <div>
      {t("ops.importModal.summaryExcel", {
        total: preview.totalRowsRead,
        valid: preview.validRows,
        inactive: preview.inactiveRows,
        notFound: preview.notFoundRows,
        badQty: preview.invalidQuantityRows,
        badFmt: preview.invalidFormatRows,
        merged: preview.mergedDuplicates,
      })}
    </div>
  );
}

export function DocumentLineImportModal(props: Props) {
  const {
    open,
    initialTab,
    items,
    getDefaultUnitPrice,
    templateFileName = "line-import-template.xlsx",
    templateDisplayLabel,
    onOpenChange,
    onApply,
  } = props;

  const { t, locale } = useTranslation();
  const emDash = t("domain.audit.summary.emDash");

  const lineImportTemplateLabels = useMemo((): LineImportTemplateLabels => {
    const sheetName = t("ops.importModal.lineImport.dataSheetName");
    return {
      dataSheetName: sheetName,
      instructionSheetName: t("ops.importModal.lineImport.instructionsSheetName"),
      columnHeaders: {
        itemCode: t("ops.importModal.lineImport.headerItemCode"),
        qty: t("ops.importModal.lineImport.headerQty"),
        unitPrice: t("ops.importModal.lineImport.headerUnitPrice"),
      },
      instructionTitle: t("ops.importModal.lineImport.instructionTitle"),
      instructionLines: [
        t("ops.importModal.lineImport.instruction1", { sheetName }),
        t("ops.importModal.lineImport.instruction2"),
        t("ops.importModal.lineImport.instruction3"),
        t("ops.importModal.lineImport.instruction4"),
        t("ops.importModal.lineImport.instruction5"),
      ],
    };
  }, [t, locale]);

  const lineImportHeaderSynonyms = useMemo((): LineImportHeaderSynonyms => {
    const itemCode = t("ops.importModal.lineImport.headerItemCode");
    const qty = t("ops.importModal.lineImport.headerQty");
    const unitPrice = t("ops.importModal.lineImport.headerUnitPrice");
    const barcode = t("ops.importModal.lineImport.headerBarcode");
    return {
      code: [itemCode, "Item Code", "item code", "code"],
      barcode: [barcode, "Barcode", "barcode", "Item Barcode", "item barcode"],
      qty: [qty, "Qty", "qty", "Quantity", "quantity"],
      unitPrice: [unitPrice, "Unit Price", "unit price", "Price", "price"],
    };
  }, [t, locale]);

  const buildLineImportHeaderError = useCallback(
    (kind: "missing_qty" | "missing_identifier", detectedHeaders: string[]) => {
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      const detectedText =
        detectedHeaders.length > 0
          ? detectedHeaders.join(" | ")
          : t("ops.importModal.lineImport.headerDetectedBlank");
      const lines: string[] = [
        t("ops.importModal.lineImport.headerErrorIntro"),
        ...(kind === "missing_qty"
          ? [
              t("ops.importModal.lineImport.headerMissingQtyLine"),
              t("ops.importModal.lineImport.headerMissingQtyExpected"),
            ]
          : [
              t("ops.importModal.lineImport.headerMissingIdLine"),
              t("ops.importModal.lineImport.headerMissingIdExpected"),
            ]),
        t("ops.importModal.lineImport.headerDetectedLine", { detected: detectedText }),
        t("ops.importModal.lineImport.headerTipRow"),
        t("ops.importModal.lineImport.headerExample", {
          code: t("ops.importModal.lineImport.headerItemCode"),
          qty: t("ops.importModal.lineImport.headerQty"),
        }),
        t("ops.importModal.lineImport.headerExampleRow", {
          sampleCode: "ITEM-001",
          sampleQty: "5",
        }),
      ];
      const normalizedDetected = detectedHeaders.map((h) => norm(h));
      if (normalizedDetected.some((h) => h.includes("item") && h.includes("barcode"))) {
        lines.push(t("ops.importModal.lineImport.headerHintSplitLabels"));
      }
      if (
        kind === "missing_qty" &&
        normalizedDetected.some((h) => h.includes("qty") || h.includes("quant"))
      ) {
        lines.push(t("ops.importModal.lineImport.headerHintQtyTypo"));
      }
      return lines.join("\n");
    },
    [t, locale],
  );

  const lineImportParseLabels = useMemo((): LineImportParseLabels => {
    return {
      workbookNoWorksheets: t("ops.importModal.lineImport.workbookNoWorksheets"),
      headerSynonyms: lineImportHeaderSynonyms,
      buildHeaderValidationError: buildLineImportHeaderError,
      rowReasons: {
        missingItemCodeBarcode: t("ops.importModal.lineImport.reasonMissingItemCodeBarcode"),
        qtyMustBePositive: t("ops.importModal.lineImport.reasonQtyMustBePositive"),
        unitPriceNumericNonNegative: t(
          "ops.importModal.lineImport.reasonUnitPriceNumericNonNegative",
        ),
      },
    };
  }, [t, locale, lineImportHeaderSynonyms, buildLineImportHeaderError]);
  const [activeTab, setActiveTab] = useState<LineImportTab>(initialTab);
  const [pasteInput, setPasteInput] = useState("");
  const [pastePreview, setPastePreview] = useState<BatchPastePreview | null>(null);
  const [excelPreview, setExcelPreview] = useState<ExcelImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);
  const [templateDownloadResult, setTemplateDownloadResult] =
    useState<TemplateDownloadResult | null>(null);
  const [pastePreviewFilter, setPastePreviewFilter] = useState<PreviewFilter>("all");
  const [excelPreviewFilter, setExcelPreviewFilter] = useState<PreviewFilter>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Bumps on each session reset so in-flight async work does not mutate state after close. */
  const modalSessionRef = useRef(0);

  const resetTemporarySessionState = useCallback(() => {
    modalSessionRef.current += 1;
    setPasteInput("");
    setPastePreview(null);
    setExcelPreview(null);
    setImportFileName(null);
    setIsImportingExcel(false);
    setFileErrorMessage(null);
    setTemplateDownloadResult(null);
    setPastePreviewFilter("all");
    setExcelPreviewFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) {
      resetTemporarySessionState();
      return;
    }
    resetTemporarySessionState();
    setActiveTab(initialTab);
  }, [open, initialTab, resetTemporarySessionState]);

  const close = () => onOpenChange(false);

  const currentValidLineCount =
    activeTab === "paste"
      ? pastePreview?.groupedValid.length ?? 0
      : excelPreview?.groupedValid.length ?? 0;

  const handlePreviewPaste = () => {
    setFileErrorMessage(null);
    setPastePreview(resolveBatchPastedItems(pasteInput, items));
    setPastePreviewFilter("all");
  };

  const handleChooseExcel = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    const defaultFilename = templateFileName;
    const sessionAtStart = modalSessionRef.current;
    try {
      const path = await save({
        defaultPath: defaultFilename,
        filters: [{ name: t("ops.importModal.excelFileFilterName"), extensions: ["xlsx"] }],
      });
      if (path == null) return;

      const buffer = await buildLineImportTemplateXlsxBuffer(lineImportTemplateLabels);
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const contentsBase64 = btoa(binary);
      await invoke("write_export_file", { path, contentsBase64 });
      if (modalSessionRef.current !== sessionAtStart) return;
      const filename = path.replace(/^.*[/\\]/, "") || defaultFilename;
      setTemplateDownloadResult({ filename, path });
      return;
    } catch {
      const buffer = await buildLineImportTemplateXlsxBuffer(lineImportTemplateLabels);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      a.click();
      URL.revokeObjectURL(url);
      if (modalSessionRef.current !== sessionAtStart) return;
      setTemplateDownloadResult({ filename: defaultFilename, path: null });
    }
  };

  const handleOpenTemplateFile = async () => {
    const path = templateDownloadResult?.path;
    if (!path) return;
    try {
      await invoke("open_export_file", { path });
    } catch (err) {
      console.error("Open template file failed", err);
    }
  };

  const handleOpenTemplateFolder = () => {
    const path = templateDownloadResult?.path;
    if (!path) return;
    revealItemInDir(path).catch((err) => {
      console.error("Reveal template file failed", err);
    });
  };

  const handleExcelFileSelected = async (file: File | null) => {
    if (!file) return;
    const sessionAtStart = modalSessionRef.current;
    setFileErrorMessage(null);
    setExcelPreview(null);
    setImportFileName(file.name);
    setIsImportingExcel(true);
    try {
      const preview = await parseExcelLineImport(await file.arrayBuffer(), {
        items,
        getDefaultUnitPrice,
        labels: lineImportParseLabels,
      });
      if (modalSessionRef.current !== sessionAtStart) return;
      setExcelPreview(preview);
      setExcelPreviewFilter("all");
    } catch (e) {
      if (modalSessionRef.current !== sessionAtStart) return;
      setFileErrorMessage(e instanceof Error ? e.message : t("ops.importModal.parseError"));
    } finally {
      if (modalSessionRef.current === sessionAtStart) {
        setIsImportingExcel(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleAddAllValid = () => {
    if (activeTab === "paste") {
      if (!pastePreview || pastePreview.groupedValid.length === 0) return;
      const lines: ResolvedImportLine[] = pastePreview.groupedValid
        .map((grouped) => {
          const item = items.find((i) => i.id === grouped.itemId);
          if (!item) return null;
          return {
            itemId: grouped.itemId,
            qty: grouped.qty,
            unitPrice: getDefaultUnitPrice(item),
          };
        })
        .filter((x): x is ResolvedImportLine => x !== null);
      const skippedRows =
        pastePreview.inactiveCount +
        pastePreview.notFoundCount +
        pastePreview.invalidQuantityCount +
        pastePreview.invalidFormatCount +
        pastePreview.headerSkippedCount;
      onApply({ lines, skippedRows });
      close();
      return;
    }

    if (!excelPreview || excelPreview.groupedValid.length === 0) return;
    const lines: ResolvedImportLine[] = excelPreview.groupedValid.map((grouped) => ({
      itemId: grouped.itemId,
      qty: grouped.qty,
      unitPrice: roundMoney(grouped.unitPrice),
    }));
    const skippedRows =
      excelPreview.inactiveRows +
      excelPreview.notFoundRows +
      excelPreview.invalidQuantityRows +
      excelPreview.invalidFormatRows;
    onApply({ lines, skippedRows });
    close();
  };

  const applyKeyboardRef = useRef({ apply: handleAddAllValid, count: currentValidLineCount });
  applyKeyboardRef.current = { apply: handleAddAllValid, count: currentValidLineCount };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (e.target instanceof HTMLTextAreaElement) return;
        const { apply, count } = applyKeyboardRef.current;
        if (count > 0) {
          e.preventDefault();
          apply();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const isPasteRowValid = (status: string): boolean => status === "valid";
  const isExcelRowValid = (status: string): boolean => status === "valid";

  const filteredPasteRows = pastePreview
    ? pastePreview.rows
        .map((row, idx) => ({ row, rowNumber: idx + 1 }))
        .filter(({ row }) => {
          if (pastePreviewFilter === "all") return true;
          if (pastePreviewFilter === "valid") return isPasteRowValid(row.status);
          return !isPasteRowValid(row.status);
        })
    : [];
  const pasteValidCount = pastePreview
    ? pastePreview.rows.filter((row) => isPasteRowValid(row.status)).length
    : 0;
  const pasteErrorCount = pastePreview ? pastePreview.rows.length - pasteValidCount : 0;

  const filteredExcelRows = excelPreview
    ? excelPreview.rows.filter((row) => {
        if (excelPreviewFilter === "all") return true;
        if (excelPreviewFilter === "valid") return isExcelRowValid(row.status);
        return !isExcelRowValid(row.status);
      })
    : [];
  const excelValidCount = excelPreview
    ? excelPreview.rows.filter((row) => isExcelRowValid(row.status)).length
    : 0;
  const excelErrorCount = excelPreview ? excelPreview.rows.length - excelValidCount : 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-import-title"
        data-state="open"
        className="w-full max-w-4xl rounded-md border border-border bg-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h3 id="line-import-title" className="text-sm font-semibold">
              {t("ops.importModal.title")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("ops.importModal.subtitle")}</p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={activeTab === "paste" ? "default" : "outline"}
              onClick={() => setActiveTab("paste")}
            >
              <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden />
              {t("ops.importModal.tabPaste")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === "excel" ? "default" : "outline"}
              onClick={() => setActiveTab("excel")}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
              {t("ops.importModal.tabExcel")}
            </Button>
          </div>

          {activeTab === "paste" ? (
            <div className="space-y-1.5">
              <Label htmlFor="line-import-paste" className="text-sm">
                {t("ops.importModal.pasteLabel")}
              </Label>
              <Textarea
                id="line-import-paste"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={t("ops.importModal.pastePlaceholder")}
                className="min-h-[120px] font-mono text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handlePreviewPaste}>
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                {t("ops.importModal.preview")}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("ops.importModal.excelHint")}</p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleChooseExcel}
                  disabled={isImportingExcel}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                  {isImportingExcel ? t("ops.importModal.parsing") : t("ops.importModal.chooseXlsx")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  {t("ops.importModal.downloadTemplate")}
                </Button>
                {importFileName ? (
                  <span className="max-w-[420px] truncate text-xs text-muted-foreground">
                    {importFileName}
                  </span>
                ) : null}
              </div>
              {templateDownloadResult ? (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="font-medium">{t("ops.importModal.templateDownloaded")}</span>
                      </div>
                      <div
                        className="truncate text-muted-foreground"
                        title={templateDownloadResult.filename}
                      >
                        {templateDisplayLabel ?? templateDownloadResult.filename}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {templateDownloadResult.path ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              void handleOpenTemplateFile();
                            }}
                          >
                            <File className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {t("ops.importModal.openFile")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={handleOpenTemplateFolder}
                          >
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {t("ops.importModal.openFolder")}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setTemplateDownloadResult(null)}
                      >
                        {t("ops.importModal.dismiss")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleExcelFileSelected(file);
                }}
              />
            </div>
          )}

          {fileErrorMessage ? (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-2 whitespace-pre-line text-xs text-destructive">
              {fileErrorMessage}
            </div>
          ) : null}

          {activeTab === "paste" && pastePreview ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <PasteSummary preview={pastePreview} />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={pastePreviewFilter === "all" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPastePreviewFilter("all")}
                >
                  {t("ops.importModal.filterAll", { count: pastePreview.rows.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pastePreviewFilter === "errors" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPastePreviewFilter("errors")}
                >
                  {t("ops.importModal.filterErrors", { count: pasteErrorCount })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pastePreviewFilter === "valid" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPastePreviewFilter("valid")}
                >
                  {t("ops.importModal.filterValid", { count: pasteValidCount })}
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-border/50">
                {filteredPasteRows.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {pastePreviewFilter === "errors"
                      ? t("ops.importModal.noErrorRows")
                      : t("ops.importModal.noValidRows")}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95">
                      <tr className="border-b border-border/50 text-left">
                        <th className="px-2 py-1">{t("doc.columns.row")}</th>
                        <th className="px-2 py-1">{t("doc.columns.input")}</th>
                        <th className="px-2 py-1">{t("doc.columns.resolvedItem")}</th>
                        <th className="px-2 py-1">{t("doc.columns.qty")}</th>
                        <th className="px-2 py-1">{t("doc.columns.status")}</th>
                        <th className="px-2 py-1">{t("doc.columns.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPasteRows.map(({ row, rowNumber }, idx) => (
                        <tr key={`${row.token}-${idx}`} className="border-b border-border/30">
                          <td className="px-2 py-1">{rowNumber}</td>
                          <td className="px-2 py-1 font-mono">{row.token}</td>
                          <td className="px-2 py-1">
                            {row.itemCode
                              ? `${row.itemCode} — ${row.itemName ?? ""}`
                              : emDash}
                          </td>
                          <td className="px-2 py-1">{row.qty ?? emDash}</td>
                          <td className="px-2 py-1">{importRowStatusLabel(t, row.status)}</td>
                          <td className="px-2 py-1">{row.note ?? emDash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "excel" && excelPreview ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <ExcelSummary preview={excelPreview} />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={excelPreviewFilter === "all" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setExcelPreviewFilter("all")}
                >
                  {t("ops.importModal.filterAll", { count: excelPreview.rows.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={excelPreviewFilter === "errors" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setExcelPreviewFilter("errors")}
                >
                  {t("ops.importModal.filterErrors", { count: excelErrorCount })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={excelPreviewFilter === "valid" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setExcelPreviewFilter("valid")}
                >
                  {t("ops.importModal.filterValid", { count: excelValidCount })}
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-border/50">
                {filteredExcelRows.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {excelPreviewFilter === "errors"
                      ? t("ops.importModal.noErrorRows")
                      : t("ops.importModal.noValidRows")}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95">
                      <tr className="border-b border-border/50 text-left">
                        <th className="px-2 py-1">{t("doc.columns.row")}</th>
                        <th className="px-2 py-1">{t("doc.columns.input")}</th>
                        <th className="px-2 py-1">{t("doc.columns.resolvedItem")}</th>
                        <th className="px-2 py-1">{t("doc.columns.qty")}</th>
                        <th className="px-2 py-1">{t("doc.columns.unitPrice")}</th>
                        <th className="px-2 py-1">{t("doc.columns.status")}</th>
                        <th className="px-2 py-1">{t("doc.columns.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExcelRows.map((row) => (
                        <tr
                          key={`excel-row-${row.rowNumber}-${row.sourceValue}`}
                          className="border-b border-border/30"
                        >
                          <td className="px-2 py-1">{row.rowNumber}</td>
                          <td className="px-2 py-1 font-mono">{row.sourceValue || emDash}</td>
                          <td className="px-2 py-1">
                            {row.itemCode
                              ? `${row.itemCode} — ${row.itemName ?? ""}`
                              : emDash}
                          </td>
                          <td className="px-2 py-1">{row.qty ?? emDash}</td>
                          <td className="px-2 py-1">{row.unitPrice ?? emDash}</td>
                          <td className="px-2 py-1">{importRowStatusLabel(t, row.status)}</td>
                          <td className="px-2 py-1">{row.reason ?? emDash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-1.5 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={close}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleAddAllValid}
            disabled={currentValidLineCount <= 0}
            title={t("ops.importModal.addAllValidTitle")}
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {t("ops.importModal.addAllValid")}
          </Button>
        </div>
      </div>
    </div>
  );
}
