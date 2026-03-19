import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ClipboardPaste, Eye, FileSpreadsheet, FolderOpen, X } from "lucide-react";
import type { Item } from "../../../modules/items/model";
import {
  resolveBatchPastedItems,
  type BatchPastePreview,
} from "../../batchPasteItems";
import {
  parseExcelLineImport,
  type ExcelImportPreview,
} from "../../excelLineImport";

export type LineImportTab = "paste" | "excel";

export type ResolvedImportLine = {
  itemId: string;
  qty: number;
  unitPrice: number;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const close = () => onOpenChange(false);

  const currentValidLineCount =
    activeTab === "paste"
      ? pastePreview?.groupedValid.length ?? 0
      : excelPreview?.groupedValid.length ?? 0;

  const handlePreviewPaste = () => {
    setFileErrorMessage(null);
    setPastePreview(resolveBatchPastedItems(pasteInput, items));
  };

  const handleChooseExcel = () => {
    fileInputRef.current?.click();
  };

  const handleExcelFileSelected = async (file: File | null) => {
    if (!file) return;
    setFileErrorMessage(null);
    setExcelPreview(null);
    setImportFileName(file.name);
    setIsImportingExcel(true);
    try {
      const preview = await parseExcelLineImport(await file.arrayBuffer(), {
        items,
        getDefaultUnitPrice,
      });
      setExcelPreview(preview);
    } catch (e) {
      setFileErrorMessage(e instanceof Error ? e.message : "Failed to parse Excel file.");
    } finally {
      setIsImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      setPasteInput("");
      setPastePreview(null);
      setFileErrorMessage(null);
      close();
      return;
    }

    if (!excelPreview || excelPreview.groupedValid.length === 0) return;
    const lines: ResolvedImportLine[] = excelPreview.groupedValid.map((grouped) => ({
      itemId: grouped.itemId,
      qty: grouped.qty,
      unitPrice: grouped.unitPrice,
    }));
    const skippedRows =
      excelPreview.inactiveRows +
      excelPreview.notFoundRows +
      excelPreview.invalidQuantityRows +
      excelPreview.invalidFormatRows;
    onApply({ lines, skippedRows });
    setExcelPreview(null);
    setImportFileName(null);
    setFileErrorMessage(null);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-md border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Add lines</h3>
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
                {importFileName ? (
                  <span className="max-w-[420px] truncate text-xs text-muted-foreground">
                    {importFileName}
                  </span>
                ) : null}
              </div>
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
              <div className="max-h-64 overflow-auto rounded border border-border/50">
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
                    {pastePreview.rows.map((row, idx) => (
                      <tr key={`${row.token}-${idx}`} className="border-b border-border/30">
                        <td className="px-2 py-1">{idx + 1}</td>
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
              </div>
            </div>
          ) : null}

          {activeTab === "excel" && excelPreview ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <ExcelSummary preview={excelPreview} />
              <div className="max-h-64 overflow-auto rounded border border-border/50">
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
                    {excelPreview.rows.map((row) => (
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
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Add all valid lines
          </Button>
        </div>
      </div>
    </div>
  );
}
