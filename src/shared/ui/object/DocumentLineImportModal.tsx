import { useCallback, useEffect, useRef, useState } from "react";
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
} from "../../excelLineImport";

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
  onOpenChange: (open: boolean) => void;
  onApply: (payload: ApplyPayload) => void;
};

function PasteSummary({ preview }: { preview: BatchPastePreview }) {
  return (
    <div>
      Rows: {preview.totalLines} | Valid: {preview.validMatchCount} | Inactive:{" "}
      {preview.inactiveCount} | Not found: {preview.notFoundCount} | Invalid qty:{" "}
      {preview.invalidQuantityCount} | Invalid format: {preview.invalidFormatCount} |
      Header skipped: {preview.headerSkippedCount} | Duplicates merged:{" "}
      {preview.mergedDuplicateCount} | Extra columns ignored:{" "}
      {preview.extraColumnsIgnoredCount}
    </div>
  );
}

function ExcelSummary({ preview }: { preview: ExcelImportPreview }) {
  return (
    <div>
      Rows: {preview.totalRowsRead} | Valid: {preview.validRows} | Inactive:{" "}
      {preview.inactiveRows} | Not found: {preview.notFoundRows} | Invalid qty:{" "}
      {preview.invalidQuantityRows} | Invalid format: {preview.invalidFormatRows} |
      Duplicates merged: {preview.mergedDuplicates}
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
    onOpenChange,
    onApply,
  } = props;

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
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (path == null) return;

      const buffer = await buildLineImportTemplateXlsxBuffer();
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
      const buffer = await buildLineImportTemplateXlsxBuffer();
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
      });
      if (modalSessionRef.current !== sessionAtStart) return;
      setExcelPreview(preview);
      setExcelPreviewFilter("all");
    } catch (e) {
      if (modalSessionRef.current !== sessionAtStart) return;
      setFileErrorMessage(e instanceof Error ? e.message : "Failed to parse Excel file.");
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
              Add lines
            </h3>
            <p className="text-xs text-muted-foreground">
              Paste item codes/barcodes or import an Excel file. Review the preview before adding lines.
            </p>
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
              Paste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === "excel" ? "default" : "outline"}
              onClick={() => setActiveTab("excel")}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
              Excel
            </Button>
          </div>

          {activeTab === "paste" ? (
            <div className="space-y-1.5">
              <Label htmlFor="line-import-paste" className="text-sm">
                Paste one item code/barcode per line, or code/barcode + qty
              </Label>
              <Textarea
                id="line-import-paste"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={"ITEM-001\nITEM-002 2\n1234567890123\t3"}
                className="min-h-[120px] font-mono text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handlePreviewPaste}>
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                Preview
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Expected columns: Item Code or Barcode, Qty, optional Unit Price.
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleChooseExcel}
                  disabled={isImportingExcel}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                  {isImportingExcel ? "Parsing..." : "Choose .xlsx file"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  Download template
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
                        <span className="font-medium">Template downloaded</span>
                      </div>
                      <div
                        className="truncate text-muted-foreground"
                        title={templateDownloadResult.filename}
                      >
                        {templateDownloadResult.filename}
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
                            Open file
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={handleOpenTemplateFolder}
                          >
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Open folder
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
                        Dismiss
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
                  All ({pastePreview.rows.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pastePreviewFilter === "errors" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPastePreviewFilter("errors")}
                >
                  Errors ({pasteErrorCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pastePreviewFilter === "valid" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPastePreviewFilter("valid")}
                >
                  Valid ({pasteValidCount})
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-border/50">
                {filteredPasteRows.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {pastePreviewFilter === "errors" ? "No error rows." : "No valid rows."}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95">
                      <tr className="border-b border-border/50 text-left">
                        <th className="px-2 py-1">Row</th>
                        <th className="px-2 py-1">Input</th>
                        <th className="px-2 py-1">Resolved item</th>
                        <th className="px-2 py-1">Qty</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPasteRows.map(({ row, rowNumber }, idx) => (
                        <tr key={`${row.token}-${idx}`} className="border-b border-border/30">
                          <td className="px-2 py-1">{rowNumber}</td>
                          <td className="px-2 py-1 font-mono">{row.token}</td>
                          <td className="px-2 py-1">
                            {row.itemCode ? `${row.itemCode} - ${row.itemName ?? ""}` : "—"}
                          </td>
                          <td className="px-2 py-1">{row.qty ?? "—"}</td>
                          <td className="px-2 py-1">{row.status}</td>
                          <td className="px-2 py-1">{row.note ?? "—"}</td>
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
                  All ({excelPreview.rows.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={excelPreviewFilter === "errors" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setExcelPreviewFilter("errors")}
                >
                  Errors ({excelErrorCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={excelPreviewFilter === "valid" ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setExcelPreviewFilter("valid")}
                >
                  Valid ({excelValidCount})
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-border/50">
                {filteredExcelRows.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {excelPreviewFilter === "errors" ? "No error rows." : "No valid rows."}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95">
                      <tr className="border-b border-border/50 text-left">
                        <th className="px-2 py-1">Row</th>
                        <th className="px-2 py-1">Input</th>
                        <th className="px-2 py-1">Resolved item</th>
                        <th className="px-2 py-1">Qty</th>
                        <th className="px-2 py-1">Unit price</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExcelRows.map((row) => (
                        <tr
                          key={`excel-row-${row.rowNumber}-${row.sourceValue}`}
                          className="border-b border-border/30"
                        >
                          <td className="px-2 py-1">{row.rowNumber}</td>
                          <td className="px-2 py-1 font-mono">{row.sourceValue || "—"}</td>
                          <td className="px-2 py-1">
                            {row.itemCode ? `${row.itemCode} - ${row.itemName ?? ""}` : "—"}
                          </td>
                          <td className="px-2 py-1">{row.qty ?? "—"}</td>
                          <td className="px-2 py-1">{row.unitPrice ?? "—"}</td>
                          <td className="px-2 py-1">{row.status}</td>
                          <td className="px-2 py-1">{row.reason ?? "—"}</td>
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddAllValid}
            disabled={currentValidLineCount <= 0}
            title="Add all valid lines (Ctrl/Cmd+Enter)"
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Add all valid lines
          </Button>
        </div>
      </div>
    </div>
  );
}
