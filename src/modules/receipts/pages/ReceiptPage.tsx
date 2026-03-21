import { useParams } from "react-router-dom";
import { useMemo, useState, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { receiptRepository } from "../repository";
import { post, cancelDocument, reverseDocument, validateReceiptFull } from "../service";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { ReceiptLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { actionIssue, getErrorAndWarningMessages, type Issue } from "../../../shared/issues";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { agGridDefaultColDef, agGridSelectionColumnDef } from "../../../shared/ui/ag-grid/agGridDefaults";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildLinesXlsxBuffer, buildDocumentXlsxBuffer, type ReceiptExportLineRow, type ReceiptDocumentSummary } from "../receiptExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { factualDocumentIssuesForStrip } from "../../../shared/factualDocumentPageIssues";
import {
  CancelDocumentReasonDialog,
  type CancelDocumentReasonPayload,
} from "../../../shared/ui/object/CancelDocumentReasonDialog";
import {
  ReverseDocumentReasonDialog,
  type ReverseDocumentReasonPayload,
} from "../../../shared/ui/object/ReverseDocumentReasonDialog";
import { DocumentEventLogSection } from "../../../shared/ui/object/DocumentEventLogSection";
import {
  CANCEL_DOCUMENT_REASON_LABELS,
  REVERSAL_DOCUMENT_REASON_LABELS,
  type CancelDocumentReasonCode,
  type ReversalDocumentReasonCode,
} from "../../../shared/reasonCodes";

type LineWithItem = ReceiptLine & { itemName: string; uom: string };

function receiptLinesColumnDefs(): ColDef<LineWithItem>[] {
  return [
    {
      headerName: "№",
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
    },
    {
      headerName: "Item Code",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    { field: "itemName", headerName: "Item Name", flex: 1, minWidth: 180 },
    {
      headerName: "Brand",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      headerName: "Category",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    { field: "qty", headerName: "Qty", width: 100 },
    { field: "uom", headerName: "UOM", width: 80 },
  ];
}

function buildExportRowsFromLinesWithItem(lines: LineWithItem[]): ReceiptExportLineRow[] {
  return lines.map((line, idx) => {
    const item = itemRepository.getById(line.itemId);
    const qty = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
    const brand = item?.brandId ? brandRepository.getById(item.brandId)?.code ?? "" : "";
    const category = item?.categoryId ? categoryRepository.getById(item.categoryId)?.code ?? "" : "";
    return {
      no: idx + 1,
      itemCode: item?.code ?? line.itemId,
      itemName: line.itemName ?? item?.name ?? line.itemId,
      brand,
      category,
      qty,
      uom: line.uom ?? item?.uom ?? "—",
    };
  });
}

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [refresh, setRefresh] = useState(0);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [cancelReasonDialogOpen, setCancelReasonDialogOpen] = useState(false);
  const [reverseReasonDialogOpen, setReverseReasonDialogOpen] = useState(false);
  const doc = useMemo(
    () => (id ? receiptRepository.getById(id) : undefined),
    [id, refresh],
  );
  const lines = useMemo(
    () => (id ? receiptRepository.listLines(id) : []),
    [id, refresh],
  );
  const purchaseOrderNumber = useMemo(
    () =>
      doc
        ? purchaseOrderRepository.getById(doc.purchaseOrderId)?.number ??
          doc.purchaseOrderId
        : "",
    [doc],
  );
  const warehouseName = useMemo(
    () =>
      doc
        ? warehouseRepository.getById(doc.warehouseId)?.name ?? doc.warehouseId
        : "",
    [doc],
  );
  const linesWithItem = useMemo<LineWithItem[]>(() => {
    return lines.map((line) => {
      const item = itemRepository.getById(line.itemId);
      return {
        ...line,
        itemName: item?.name ?? line.itemId,
        uom: item?.uom ?? "—",
      };
    });
  }, [lines]);

  const isDraft = doc?.status === "draft";
  const isPosted = doc?.status === "posted";
  const isReversed = doc?.status === "reversed";

  const onLinesSelectionChanged = useCallback((e: SelectionChangedEvent<LineWithItem>) => {
    const ids = e.api.getSelectedRows().map((r) => r.id);
    setSelectedLineIds(ids);
  }, []);

  const receiptNumberForFile = doc?.number ?? "receipt";

  const getExportRowsAll = useCallback((): ReceiptExportLineRow[] => {
    return buildExportRowsFromLinesWithItem(linesWithItem);
  }, [linesWithItem]);

  const getExportRowsSelected = useCallback((): ReceiptExportLineRow[] => {
    if (selectedLineIds.length === 0) return [];
    const set = new Set(selectedLineIds);
    const filtered = linesWithItem.filter((l) => set.has(l.id));
    return buildExportRowsFromLinesWithItem(filtered);
  }, [selectedLineIds, linesWithItem]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
        });
        if (path == null) return;

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path, contentsBase64 });
        const filename = path.replace(/^.*[/\\]/, "") || defaultFilename;
        setExportSuccess({ path, filename });
      } catch (err) {
        console.error("Export failed", err);
        const buffer = await buildBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const handleExportMain = useCallback(() => {
    const rows = getExportRowsAll();
    const summary: ReceiptDocumentSummary = {
      number: doc!.number,
      date: doc!.date,
      purchaseOrder: purchaseOrderNumber,
      warehouse: warehouseName,
      comment: doc!.comment ?? "",
    };
    runExportWithSaveAs(`${receiptNumberForFile}_document.xlsx`, () =>
      buildDocumentXlsxBuffer(summary, rows),
    );
  }, [doc, purchaseOrderNumber, warehouseName, receiptNumberForFile, getExportRowsAll, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${receiptNumberForFile}_selected-lines.xlsx`, () =>
      buildLinesXlsxBuffer(rows),
    );
  }, [getExportRowsSelected, receiptNumberForFile, runExportWithSaveAs]);

  const handleExportAll = useCallback(() => {
    const rows = getExportRowsAll();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${receiptNumberForFile}_all-lines.xlsx`, () => buildLinesXlsxBuffer(rows));
  }, [getExportRowsAll, receiptNumberForFile, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedLineIds.length === 0;

  const handlePost = () => {
    if (!id) return;
    const result = post(id);
    if (result.success) {
      setActionIssues([]);
      setRefresh((r) => r + 1);
    }
  };
  const handleCancelDocument = () => {
    if (!id) return;
    setActionIssues([]);
    setCancelReasonDialogOpen(true);
  };

  const handleCancelDocumentConfirm = (payload: CancelDocumentReasonPayload) => {
    if (!id) return;
    setActionIssues([]);
    const result = cancelDocument(id, payload);
    if (result.success) {
      setActionIssues([]);
      setRefresh((r) => r + 1);
    } else {
      setActionIssues([actionIssue(result.error)]);
    }
  };

  const handleReverseDocumentConfirm = (payload: ReverseDocumentReasonPayload) => {
    if (!id) return;
    setActionIssues([]);
    const result = reverseDocument(id, payload);
    if (result.success) {
      setActionIssues([]);
      setRefresh((r) => r + 1);
    } else {
      setActionIssues([actionIssue(result.error)]);
    }
  };

  if (!id || !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Receipt not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Purchasing", to: "/purchase-orders" },
    { label: "Receipts", to: "/receipts" },
    { label: doc.number },
  ];

  const issuesForStrip = useMemo(
    () => factualDocumentIssuesForStrip(actionIssues, isDraft, id, validateReceiptFull),
    [actionIssues, isDraft, id, refresh],
  );

  const { errors: documentErrors, warnings: documentWarnings } =
    getErrorAndWarningMessages(issuesForStrip);
  const hasDocumentIssues =
    documentErrors.length > 0 || documentWarnings.length > 0;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/receipts" aria-label="Back to Receipts" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">Receipt {doc.number}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <div className="doc-header__right">
            {hasDocumentIssues && (
              <DocumentIssueStrip
                errors={documentErrors}
                warnings={documentWarnings}
              />
            )}
            <div className="doc-header__actions">
              {isDraft && (
                <Button type="button" onClick={handlePost}>
                  Post
                </Button>
              )}
              {isDraft && (
                <Button type="button" variant="outline" onClick={handleCancelDocument}>
                  Cancel document
                </Button>
              )}
              {isPosted && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActionIssues([]);
                    setReverseReasonDialogOpen(true);
                  }}
                >
                  Reverse document
                </Button>
              )}
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      <Card className="max-w-2xl border-0 shadow-none">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Source purchase order, warehouse, and document references.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <dl className="doc-summary doc-summary--compact">
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Number</dt>
              <dd className="doc-summary__value">{doc.number}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Date</dt>
              <dd className="doc-summary__value">{doc.date}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Related Purchase Order</dt>
              <dd className="doc-summary__value">{purchaseOrderNumber}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Warehouse</dt>
              <dd className="doc-summary__value">{warehouseName}</dd>
            </div>
            {doc.comment != null && doc.comment !== "" && (
              <div className="doc-summary__row">
                <dt className="doc-summary__term">Comment</dt>
                <dd className="doc-summary__value">{doc.comment}</dd>
              </div>
            )}
            {doc.status === "cancelled" && doc.cancelReasonCode != null && doc.cancelReasonCode !== "" && (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Cancel reason</dt>
                  <dd className="doc-summary__value">
                    {CANCEL_DOCUMENT_REASON_LABELS[doc.cancelReasonCode as CancelDocumentReasonCode] ??
                      doc.cancelReasonCode}
                  </dd>
                </div>
                {doc.cancelReasonComment != null && doc.cancelReasonComment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">Cancel comment</dt>
                    <dd className="doc-summary__value">{doc.cancelReasonComment}</dd>
                  </div>
                )}
              </>
            )}
            {isReversed && doc.reversalReasonCode != null && (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Reversal reason</dt>
                  <dd className="doc-summary__value">
                    {REVERSAL_DOCUMENT_REASON_LABELS[doc.reversalReasonCode as ReversalDocumentReasonCode] ??
                      doc.reversalReasonCode}
                  </dd>
                </div>
                {doc.reversalReasonComment != null && doc.reversalReasonComment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">Reversal comment</dt>
                    <dd className="doc-summary__value">{doc.reversalReasonComment}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>
      <div className="doc-lines mt-6">
        <h3 className="doc-lines__title">Lines</h3>
        <div className="flex flex-row items-center justify-end gap-2 w-full mb-1.5">
          {exportSuccess && (
            <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
              <span className="text-muted-foreground text-xs">Export completed:</span>
              <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Open file"
                aria-label="Open file"
                onClick={async () => {
                  try {
                    await invoke("open_export_file", { path: exportSuccess.path });
                    setExportSuccess(null);
                  } catch (err) {
                    console.error("Export failed", err);
                    setExportSuccess(null);
                  }
                }}
              >
                <File className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Open folder"
                aria-label="Open folder"
                onClick={() => {
                  revealItemInDir(exportSuccess.path);
                  setExportSuccess(null);
                }}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                title="Dismiss"
                aria-label="Dismiss"
                onClick={() => setExportSuccess(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-stretch rounded-md border border-input shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-r-none border-0 border-r border-input gap-1.5"
              onClick={handleExportMain}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              Export
            </Button>
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
                  aria-label="Export options"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="!w-max min-w-0 p-1.5" align="end" side="top">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={exportSelectedDisabled}
                    className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    title={exportSelectedDisabled ? "Select one or more lines in the grid first." : undefined}
                    onClick={() => {
                      setExportOpen(false);
                      if (!exportSelectedDisabled) handleExportSelected();
                    }}
                  >
                    Export selected lines
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setExportOpen(false);
                      handleExportAll();
                    }}
                  >
                    Export all lines
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {linesWithItem.length === 0 ? (
          <p className="doc-lines__empty">No lines on this receipt.</p>
        ) : (
          <div className="doc-lines__grid">
            <AgGridContainer themeClass="doc-lines-grid">
              <AgGridReact<LineWithItem>
                rowData={linesWithItem}
                columnDefs={receiptLinesColumnDefs()}
                defaultColDef={agGridDefaultColDef}
                getRowId={(p) => p.data.id}
                rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
                selectionColumnDef={agGridSelectionColumnDef}
                onSelectionChanged={onLinesSelectionChanged}
              />
            </AgGridContainer>
          </div>
        )}
      </div>
      {id ? <DocumentEventLogSection entityType="receipt" entityId={id} refresh={refresh} /> : null}
      <CancelDocumentReasonDialog
        open={cancelReasonDialogOpen}
        onOpenChange={setCancelReasonDialogOpen}
        documentKindLabel="receipt"
        onConfirm={handleCancelDocumentConfirm}
      />
      <ReverseDocumentReasonDialog
        open={reverseReasonDialogOpen}
        onOpenChange={setReverseReasonDialogOpen}
        documentKindLabel="receipt"
        onConfirm={handleReverseDocumentConfirm}
      />
    </DocumentPageLayout>
  );
}
