import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { purchaseOrderRepository } from "../repository";
import { confirm, cancelDocument, createReceipt, saveDraft } from "../service";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { PurchaseOrderLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agGridDefaultColDef, agGridSelectionColumnDef } from "../../../shared/ui/ag-grid/agGridDefaults";
import { todayYYYYMMDD, normalizeDateForPO } from "../dateUtils";
import {
  lineAmountMoney,
  roundMoney,
  sumPlanningDocumentLineAmounts,
} from "../../../shared/commercialMoney";
import { computePlanningDueDate, parsePaymentTermsDaysToStore } from "../../../shared/planningCommercialDates";
import { getPurchaseOrderHealth } from "../../../shared/documentHealth";
import { getErrorAndWarningMessages, actionIssue, actionWarning, combineIssues, hasErrors, issueListContainsMessage, type Issue } from "../../../shared/issues";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { SelectField } from "@/components/ui/select-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DocumentLineImportModal,
  type LineImportTab,
  type ResolvedImportLine,
} from "../../../shared/ui/object/DocumentLineImportModal";
import {
  ClipboardPaste,
  Check,
  ChevronDown,
  CircleCheck,
  File,
  FileSpreadsheet,
  FileX,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { PurchaseOrderItemAutocomplete, type PurchaseOrderItemAutocompleteRef } from "../components/PurchaseOrderItemAutocomplete";
import {
  buildLinesXlsxBuffer,
  buildDocumentXlsxBuffer,
  type PoExportLineRow,
  type PoDocumentSummary,
} from "../poExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  CancelDocumentReasonDialog,
  type CancelDocumentReasonPayload,
} from "../../../shared/ui/object/CancelDocumentReasonDialog";
import { DocumentEventLogSection } from "../../../shared/ui/object/DocumentEventLogSection";
import {
  CANCEL_DOCUMENT_REASON_LABELS,
  ZERO_PRICE_LINE_REASON_CODES,
  ZERO_PRICE_LINE_REASON_LABELS,
  type CancelDocumentReasonCode,
  type ZeroPriceLineReasonCode,
} from "../../../shared/reasonCodes";
import {
  computePurchaseOrderFulfillment,
  planningFulfillmentStateLabel,
  type PurchaseOrderFulfillment,
  type PoLineFulfillment,
} from "../../../shared/planningFulfillment";

type LineWithItem = PurchaseOrderLine & { itemName: string };

type LineFormRow = {
  itemId: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode: string;
  _lineId: number;
};

const ZERO_PRICE_REASON_SELECT_OPTIONS = ZERO_PRICE_LINE_REASON_CODES.map((code) => ({
  value: code,
  label: ZERO_PRICE_LINE_REASON_LABELS[code],
}));

type FormState = {
  date: string;
  supplierId: string;
  warehouseId: string;
  paymentTermsDays: string;
  comment: string;
  lines: LineFormRow[];
};

function defaultForm(): FormState {
  return {
    date: todayYYYYMMDD(),
    supplierId: "",
    warehouseId: "",
    paymentTermsDays: "",
    comment: "",
    lines: [],
  };
}

function buildExportRowsFromFormLines(lines: LineFormRow[]): PoExportLineRow[] {
  return lines.map((line, idx) => {
    const item = itemRepository.getById(line.itemId);
    const qty = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
    const unitPrice =
      typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) && line.unitPrice >= 0
        ? roundMoney(line.unitPrice)
        : 0;
    const lineAmount = lineAmountMoney(qty, unitPrice);
    const brand = item?.brandId ? brandRepository.getById(item.brandId)?.code ?? "" : "";
    const category = item?.categoryId ? categoryRepository.getById(item.categoryId)?.code ?? "" : "";
    return {
      no: idx + 1,
      itemCode: item?.code ?? line.itemId,
      itemName: item?.name ?? line.itemId,
      brand,
      category,
      qty,
      unitPrice,
      lineAmount,
    };
  });
}

function buildExportRowsFromLinesWithItem(lines: LineWithItem[]): PoExportLineRow[] {
  return lines.map((line, idx) => {
    const item = itemRepository.getById(line.itemId);
    const qty = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
    const unitPrice =
      typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) && line.unitPrice >= 0
        ? roundMoney(line.unitPrice)
        : 0;
    const lineAmount = lineAmountMoney(qty, unitPrice);
    const brand = item?.brandId ? brandRepository.getById(item.brandId)?.code ?? "" : "";
    const category = item?.categoryId ? categoryRepository.getById(item.categoryId)?.code ?? "" : "";
    return {
      no: idx + 1,
      itemCode: item?.code ?? line.itemId,
      itemName: line.itemName ?? item?.name ?? line.itemId,
      brand,
      category,
      qty,
      unitPrice,
      lineAmount,
    };
  });
}

function poLinesDisplayColumnDefs(
  fulfillmentByItemId: Map<string, PoLineFulfillment>,
): ColDef<LineFormRow>[] {
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
      editable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    {
      field: "itemId",
      headerName: "Item Name",
      flex: 1,
      minWidth: 180,
      editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const item = itemRepository.getById(p.value);
        return item?.name ?? p.value;
      },
    },
    {
      headerName: "Brand",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      editable: false,
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
      editable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    {
      field: "qty",
      headerName: "Qty",
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      editable: false,
    },
    {
      headerName: "Received",
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      editable: false,
      sortable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "—";
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return "—";
        return String(f.receivedQty);
      },
    },
    {
      headerName: "Remaining",
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      editable: false,
      sortable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "—";
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return "—";
        if (f.remainingQty < 0) return `${f.remainingQty} (over)`;
        return String(f.remainingQty);
      },
    },
    {
      field: "unitPrice",
      headerName: "Unit price",
      width: 110,
      minWidth: 100,
      maxWidth: 120,
      editable: false,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? p.value.toFixed(2)
          : "0.00",
    },
    {
      headerName: "Line amount",
      width: 120,
      minWidth: 110,
      maxWidth: 130,
      editable: false,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return "0.00";
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? "0.00" : amount.toFixed(2);
      },
    },
    {
      headerName: "Zero-price reason",
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      editable: false,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return ZERO_PRICE_LINE_REASON_LABELS[c as ZeroPriceLineReasonCode] ?? c;
      },
    },
  ];
}

function poLinesReadOnlyColumnDefs(
  fulfillment: PurchaseOrderFulfillment | null,
): ColDef<LineWithItem>[] {
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
    { field: "qty", headerName: "Qty", width: 80, minWidth: 70, maxWidth: 90 },
    {
      headerName: "Received",
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      sortable: false,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return "—";
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return "—";
        return String(row.receivedQty);
      },
    },
    {
      headerName: "Remaining",
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      sortable: false,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return "—";
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return "—";
        if (row.remainingQty < 0) return `${row.remainingQty} (over)`;
        return String(row.remainingQty);
      },
    },
    {
      field: "unitPrice",
      headerName: "Unit price",
      width: 110,
      minWidth: 100,
      maxWidth: 120,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? p.value.toFixed(2)
          : "0.00",
    },
    {
      headerName: "Line amount",
      width: 120,
      minWidth: 110,
      maxWidth: 130,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return "0.00";
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? "0.00" : amount.toFixed(2);
      },
    },
    {
      headerName: "Zero-price reason",
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return ZERO_PRICE_LINE_REASON_LABELS[c as ZeroPriceLineReasonCode] ?? c;
      },
    },
  ];
}

export function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const isNew = id === "new";
  const doc = useMemo(
    () => (id && !isNew ? purchaseOrderRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );
  const lines = useMemo(
    () => (id && !isNew ? purchaseOrderRepository.listLines(id) : []),
    [id, isNew, refresh],
  );

  const nextLineIdRef = useRef(0);
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineEntryItemId, setLineEntryItemId] = useState("");
  const [lineEntryQty, setLineEntryQty] = useState(1);
  const [lineEntryUnitPrice, setLineEntryUnitPrice] = useState(0);
  const [lineEntryZeroPriceReason, setLineEntryZeroPriceReason] = useState("");
  const [cancelReasonDialogOpen, setCancelReasonDialogOpen] = useState(false);
  const [duplicateChoicePending, setDuplicateChoicePending] = useState<{
    itemId: string;
    qty: number;
    unitPrice: number;
  } | null>(null);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [isLineImportModalOpen, setIsLineImportModalOpen] = useState(false);
  const [lineImportInitialTab, setLineImportInitialTab] = useState<LineImportTab>("paste");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const linesGridRef = useRef<AgGridReact<LineFormRow> | null>(null);
  const lineEntryItemPickerRef = useRef<PurchaseOrderItemAutocompleteRef | null>(null);
  const lineEntryQtyInputRef = useRef<HTMLInputElement | null>(null);
  const lineEntryDropdownRightEdgeRef = useRef<HTMLDivElement | null>(null);
  const prevSupplierIdRef = useRef<string | null>(null);

  useEffect(() => {
    prevSupplierIdRef.current = null;
  }, [id]);

  useEffect(() => {
    setActionIssues([]);
  }, [form.supplierId, form.warehouseId, form.paymentTermsDays, form.lines]);

  useEffect(() => {
    if (isNew) {
      nextLineIdRef.current = 0;
      prevSupplierIdRef.current = null;
      setForm(defaultForm());
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
      setDuplicateChoicePending(null);
      return;
    }
    if (doc?.status === "draft" && id) {
      const draftLines = purchaseOrderRepository.listLines(id);
      const linesWithId =
        draftLines.length > 0
          ? draftLines.map((l, idx) => ({
              itemId: l.itemId,
              qty: l.qty,
              unitPrice:
                typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice)
                  ? roundMoney(l.unitPrice)
                  : 0,
              zeroPriceReasonCode: l.zeroPriceReasonCode ?? "",
              _lineId: idx,
            }))
          : [];
      nextLineIdRef.current = linesWithId.length;
      setForm({
        date: normalizeDateForPO(doc.date),
        supplierId: doc.supplierId,
        warehouseId: doc.warehouseId,
        paymentTermsDays:
          doc.paymentTermsDays !== undefined && Number.isInteger(doc.paymentTermsDays)
            ? String(doc.paymentTermsDays)
            : "",
        comment: doc.comment ?? "",
        lines: linesWithId,
      });
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
      setDuplicateChoicePending(null);
    }
  }, [
    id,
    isNew,
    doc?.id,
    doc?.status,
    doc?.date,
    doc?.supplierId,
    doc?.warehouseId,
    doc?.paymentTermsDays,
    doc?.comment,
    refresh,
  ]);

  const supplierName = useMemo(
    () =>
      doc
        ? supplierRepository.getById(doc.supplierId)?.name ?? doc.supplierId
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
      };
    });
  }, [lines]);

  const isDraft = doc?.status === "draft";
  const isConfirmed = doc?.status === "confirmed";
  const isEditable = isNew || isDraft;
  const displayNumber = !doc ? "—" : isNew ? "—" : doc.number;

  useEffect(() => {
    if (!isEditable) return;
    const sid = form.supplierId;
    if (prevSupplierIdRef.current === null) {
      prevSupplierIdRef.current = sid;
      return;
    }
    if (prevSupplierIdRef.current === sid) return;
    prevSupplierIdRef.current = sid;
    const sup = supplierRepository.getById(sid);
    const d = sup?.paymentTermsDays;
    setForm((f) => ({
      ...f,
      paymentTermsDays:
        d !== undefined && Number.isFinite(d) && Number.isInteger(d) && d >= 0 ? String(d) : "",
    }));
  }, [form.supplierId, isEditable]);

  const computedDueDateDisplay = useMemo(() => {
    const d = computePlanningDueDate(
      normalizeDateForPO(form.date),
      parsePaymentTermsDaysToStore(form.paymentTermsDays),
    );
    return d ?? "—";
  }, [form.date, form.paymentTermsDays]);

  const activeSuppliers = useMemo(
    () => supplierRepository.list().filter((s) => s.isActive),
    [],
  );
  const activeWarehouses = useMemo(
    () => warehouseRepository.list().filter((w) => w.isActive),
    [],
  );
  const handleConfirm = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = confirm(id);
    if (result.success) setRefresh((r) => r + 1);
    else if (!issueListContainsMessage(health.issues, result.error)) setActionIssues([actionIssue(result.error)]);
  };
  const handleCancelDocument = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    setCancelReasonDialogOpen(true);
  };

  const handleCreateReceipt = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = createReceipt(id);
    if (result.success) navigate(`/receipts/${result.receiptId}`);
    else if (!issueListContainsMessage(health.issues, result.error)) setActionIssues([actionIssue(result.error)]);
  };

  const handleSave = () => {
    setActionIssues([]);
    const linesToSave = form.lines
      .filter(
        (l) => l.itemId.trim() !== "" && typeof l.qty === "number" && l.qty > 0,
      )
      .map(({ itemId, qty, unitPrice, zeroPriceReasonCode }) => {
        const up = roundMoney(
          typeof unitPrice === "number" && !Number.isNaN(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        );
        return {
          itemId,
          qty,
          unitPrice: up,
          ...(up === 0 && zeroPriceReasonCode.trim() !== ""
            ? { zeroPriceReasonCode: zeroPriceReasonCode.trim() }
            : {}),
        };
      });
    const result = saveDraft(
      {
        date: normalizeDateForPO(form.date),
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        paymentTermsDays: form.paymentTermsDays,
        comment: form.comment || undefined,
        lines: linesToSave,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      if (isNew) {
        navigate(`/purchase-orders/${result.id}`, { replace: true });
      } else {
        setRefresh((r) => r + 1);
      }
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssue(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/purchase-orders");
  };

  const removeLineByLineId = useCallback((lineId: number) => {
    setDuplicateChoicePending(null);
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => l._lineId !== lineId),
    }));
    if (editingLineId === lineId) {
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
      linesGridRef.current?.api?.deselectAll();
    }
  }, [editingLineId]);

  const addLineFromEntry = () => {
    const itemId = lineEntryItemId.trim();
    const qty = Number(lineEntryQty);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) return;

    const item = itemRepository.getById(itemId);
    if (!item) {
      setActionIssues([actionIssue("Selected item is invalid and cannot be added.")]);
      return;
    }
    if (!item.isActive) {
      setActionIssues([actionIssue("Inactive items cannot be added.")]);
      return;
    }

    const rawPrice = Number(lineEntryUnitPrice);
    const unitPrice = roundMoney(Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0);
    const isDuplicate = form.lines.some((l) => l.itemId === itemId);
    if (isDuplicate) {
      setDuplicateChoicePending({ itemId, qty, unitPrice });
      return;
    }
    const _lineId = nextLineIdRef.current++;
    const zp =
      unitPrice === 0 && lineEntryZeroPriceReason.trim() !== "" ? lineEntryZeroPriceReason.trim() : "";
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemId, qty, unitPrice, zeroPriceReasonCode: zp, _lineId }],
    }));
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    setLineEntryZeroPriceReason("");
    setTimeout(() => lineEntryItemPickerRef.current?.focus(), 0);
  };

  const handleDuplicateIncreaseQty = () => {
    if (!duplicateChoicePending) return;
    const { itemId, qty: addQty } = duplicateChoicePending;
    const idx = form.lines.findIndex((l) => l.itemId === itemId);
    if (idx === -1) {
      setDuplicateChoicePending(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
      return;
    }
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === idx ? { ...l, qty: l.qty + addQty } : l,
      ),
    }));
    setDuplicateChoicePending(null);
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    setLineEntryZeroPriceReason("");
    setTimeout(() => lineEntryItemPickerRef.current?.focus(), 0);
  };

  const handleDuplicateCancel = () => {
    setDuplicateChoicePending(null);
    setTimeout(() => lineEntryItemPickerRef.current?.focus(), 0);
  };

  const updateLineFromEntry = () => {
    if (editingLineId === null) return;
    const itemId = lineEntryItemId.trim();
    const qty = Number(lineEntryQty);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) return;
    const rawPrice = Number(lineEntryUnitPrice);
    const unitPrice = roundMoney(Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0);
    const zp =
      unitPrice === 0 && lineEntryZeroPriceReason.trim() !== "" ? lineEntryZeroPriceReason.trim() : "";
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) =>
        l._lineId === editingLineId ? { ...l, itemId, qty, unitPrice, zeroPriceReasonCode: zp } : l,
      ),
    }));
    setEditingLineId(null);
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    setLineEntryZeroPriceReason("");
    linesGridRef.current?.api?.deselectAll();
  };

  const cancelEdit = () => {
    setEditingLineId(null);
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    setLineEntryZeroPriceReason("");
    setDuplicateChoicePending(null);
    linesGridRef.current?.api?.deselectAll();
  };

  const onLinesSelectionChanged = useCallback((e: SelectionChangedEvent<LineFormRow>) => {
    const rows = e.api.getSelectedRows();
    const ids = rows.map((r) => r._lineId);
    setSelectedLineIds(ids);
    setDuplicateChoicePending(null);
    if (rows.length === 1 && rows[0]) {
      const row = rows[0];
      setEditingLineId(row._lineId);
      setLineEntryItemId(row.itemId);
      setLineEntryQty(row.qty);
      setLineEntryUnitPrice(
        roundMoney(typeof row.unitPrice === "number" && !Number.isNaN(row.unitPrice) ? row.unitPrice : 0),
      );
      setLineEntryZeroPriceReason(
        typeof row.zeroPriceReasonCode === "string" ? row.zeroPriceReasonCode : "",
      );
    } else {
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
    }
  }, []);

  const removeSelectedLines = useCallback(() => {
    const ids = new Set(selectedLineIds);
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => !ids.has(l._lineId)),
    }));
    linesGridRef.current?.api?.deselectAll();
    setSelectedLineIds([]);
    setDuplicateChoicePending(null);
    if (editingLineId !== null && ids.has(editingLineId)) {
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setLineEntryZeroPriceReason("");
    }
  }, [selectedLineIds, editingLineId]);

  const handleLineEntryItemChange = (itemId: string) => {
    setLineEntryItemId(itemId);
    const item = itemId ? itemRepository.getById(itemId) : undefined;
    const price = item?.purchasePrice;
    const up = roundMoney(
      typeof price === "number" && !Number.isNaN(price) && price >= 0 ? price : 0,
    );
    setLineEntryUnitPrice(up);
    if (up !== 0) setLineEntryZeroPriceReason("");
    if (itemId && editingLineId === null) {
      setTimeout(() => {
        lineEntryQtyInputRef.current?.focus();
        lineEntryQtyInputRef.current?.select();
      }, 0);
    }
  };

  const handleApplyImportedLines = ({ lines, skippedRows }: { lines: ResolvedImportLine[]; skippedRows: number }) => {
    if (lines.length === 0) return;
    setForm((f) => {
      const nextLines = [...f.lines];
      const lineIndexByItemId = new Map(
        nextLines.map((line, idx) => [line.itemId, idx]),
      );

      for (const grouped of lines) {
        const idx = lineIndexByItemId.get(grouped.itemId);
        if (idx != null) {
          nextLines[idx] = { ...nextLines[idx], qty: nextLines[idx].qty + grouped.qty };
          continue;
        }
        nextLines.push({
          _lineId: nextLineIdRef.current++,
          itemId: grouped.itemId,
          qty: grouped.qty,
          unitPrice: roundMoney(
            typeof grouped.unitPrice === "number" && Number.isFinite(grouped.unitPrice) && grouped.unitPrice >= 0
              ? grouped.unitPrice
              : 0,
          ),
          zeroPriceReasonCode: "",
        });
        lineIndexByItemId.set(grouped.itemId, nextLines.length - 1);
      }
      return { ...f, lines: nextLines };
    });

    if (skippedRows > 0) {
      setActionIssues([
        actionWarning(
          `Added ${lines.length} items. Skipped ${skippedRows} rows.`,
        ),
      ]);
    } else {
      setActionIssues([]);
    }
    setDuplicateChoicePending(null);
    setTimeout(() => lineEntryItemPickerRef.current?.focus(), 0);
  };

  const totals = useMemo(() => {
    let totalQty = 0;
    for (const l of form.lines) {
      const q = typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0;
      totalQty += q;
    }
    const totalAmount = sumPlanningDocumentLineAmounts(
      form.lines.map((l) => ({
        qty: typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0,
        unitPrice: typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0,
      })),
    );
    return { totalQty, totalAmount };
  }, [form.lines]);

  const readonlyTotals = useMemo(() => {
    let totalQty = 0;
    for (const l of lines) {
      const q = typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0;
      totalQty += q;
    }
    const totalAmount = sumPlanningDocumentLineAmounts(
      lines.map((l) => ({
        qty: typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0,
        unitPrice: typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0,
      })),
    );
    return { totalQty, totalAmount };
  }, [lines]);

  const poNumberForFile = doc?.number ?? "new";

  const getExportRowsAll = useCallback((): PoExportLineRow[] => {
    if (isEditable) return buildExportRowsFromFormLines(form.lines);
    return buildExportRowsFromLinesWithItem(linesWithItem);
  }, [isEditable, form.lines, linesWithItem]);

  const getExportRowsSelected = useCallback((): PoExportLineRow[] => {
    if (!isEditable) return [];
    if (selectedLineIds.length === 0) return [];
    const set = new Set(selectedLineIds);
    const filtered = form.lines.filter((l) => set.has(l._lineId));
    return buildExportRowsFromFormLines(filtered);
  }, [isEditable, selectedLineIds, form.lines]);

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
        // If we're not running inside Tauri or the dialog/command fails,
        // fall back to a browser download (best-effort).
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
    if (rows.length === 0) return;
    const summary: PoDocumentSummary = {
      number: displayNumber,
      date: normalizeDateForPO(isEditable ? form.date : doc?.date ?? ""),
      status: doc?.status ?? "draft",
      supplier: supplierName,
      warehouse: warehouseName,
      comment: isEditable ? form.comment : doc?.comment ?? "",
      totalQty: isEditable ? totals.totalQty : readonlyTotals.totalQty,
      totalAmount: isEditable ? totals.totalAmount : readonlyTotals.totalAmount,
    };
    runExportWithSaveAs(`${poNumberForFile}_document.xlsx`, () =>
      buildDocumentXlsxBuffer(summary, rows),
    );
  }, [
    getExportRowsAll,
    displayNumber,
    isEditable,
    form.date,
    form.comment,
    doc?.date,
    doc?.status,
    doc?.comment,
    supplierName,
    warehouseName,
    totals.totalQty,
    totals.totalAmount,
    readonlyTotals.totalQty,
    readonlyTotals.totalAmount,
    poNumberForFile,
    runExportWithSaveAs,
  ]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${poNumberForFile}_selected-lines.xlsx`, () =>
      buildLinesXlsxBuffer(rows),
    );
  }, [getExportRowsSelected, poNumberForFile, runExportWithSaveAs]);

  const handleExportAll = useCallback(() => {
    const rows = getExportRowsAll();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${poNumberForFile}_all-lines.xlsx`, () => buildLinesXlsxBuffer(rows));
  }, [getExportRowsAll, poNumberForFile, runExportWithSaveAs]);

  const exportSelectedDisabled = !isEditable || selectedLineIds.length === 0;

  const health = useMemo(
    () =>
      getPurchaseOrderHealth({
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        paymentTermsDays: form.paymentTermsDays,
        lines: form.lines,
      }),
    [form.supplierId, form.warehouseId, form.paymentTermsDays, form.lines],
  );

  const handleCancelDocumentConfirm = (payload: CancelDocumentReasonPayload) => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = cancelDocument(id, payload);
    if (result.success) setRefresh((r) => r + 1);
    else if (!issueListContainsMessage(health.issues, result.error))
      setActionIssues([actionIssue(result.error)]);
  };

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );
  const { errors: combinedErrors, warnings: combinedWarnings } = useMemo(
    () => getErrorAndWarningMessages(combinedIssues),
    [combinedIssues],
  );

  const getRowClass = useCallback(
    (params: { data?: LineFormRow }) => {
      if (!params.data) return undefined;
      const parts: string[] = [];
      if (params.data._lineId === editingLineId) parts.push("doc-lines__row--editing");
      const h = health.lineHealth.get(params.data._lineId);
      if (h === "error") parts.push("doc-lines__row--error");
      else if (h === "warning") parts.push("doc-lines__row--warning");
      return parts.length > 0 ? parts.join(" ") : undefined;
    },
    [health.lineHealth, editingLineId],
  );

  const poFulfillment = useMemo(() => {
    if (!id || isNew) return null;
    return computePurchaseOrderFulfillment(id);
  }, [id, isNew, refresh]);

  const fulfillmentByItemId = useMemo(() => {
    const m = new Map<string, PoLineFulfillment>();
    if (!poFulfillment) return m;
    for (const row of poFulfillment.lines) {
      m.set(row.itemId, row);
    }
    return m;
  }, [poFulfillment]);

  const linesColumnDefs = useMemo(
    () => poLinesDisplayColumnDefs(fulfillmentByItemId),
    [fulfillmentByItemId],
  );

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Purchase order not found.</p>
      </div>
    );
  }

  if (!isNew && !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Purchase order not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Purchasing", to: "/purchase-orders" },
    { label: "Purchase Orders", to: "/purchase-orders" },
    { label: isNew ? "New" : doc!.number },
  ];

  const displayTitle = isNew ? "New Purchase Order" : `Purchase Order ${doc!.number}`;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/purchase-orders" aria-label="Back to Purchase Orders" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
            {!isNew && <StatusBadge status={doc!.status} />}
          </div>
          <div className="doc-header__right">
            {isEditable && (combinedErrors.length > 0 || combinedWarnings.length > 0) && (
              <DocumentIssueStrip errors={combinedErrors} warnings={combinedWarnings} />
            )}
            <div className="doc-header__actions">
              {isEditable && (
                <Button type="button" onClick={handleSave}>
                  <Save aria-hidden />
                  Save
                </Button>
              )}
              {!isNew && isDraft && (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={hasErrors(health.issues)}
                  title={hasErrors(health.issues) ? "Fix errors before confirming." : undefined}
                >
                  <CircleCheck aria-hidden />
                  Confirm
                </Button>
              )}
              {!isNew && isConfirmed && (
                <Button type="button" onClick={handleCreateReceipt}>
                  <span className="create-btn__plus">+</span> Create Receipt
                </Button>
              )}
              {!isNew && (isDraft || isConfirmed) && (
                <Button type="button" variant="outline" onClick={handleCancelDocument}>
                  <FileX aria-hidden />
                  Cancel document
                </Button>
              )}
              {isEditable && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X aria-hidden />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      {isEditable ? (
        <>
          <Card className="max-w-2xl border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5">
              <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-1">
              <div className="grid w-fit grid-cols-[280px_280px] gap-x-2 gap-y-1">
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <Label htmlFor="po-number" className="text-sm">Number</Label>
                  <div id="po-number" className="flex h-8 items-center text-sm text-muted-foreground">
                    {displayNumber}
                  </div>
                </div>
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <Label htmlFor="po-date" className="text-sm">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePickerField
                    id="po-date"
                    value={form.date}
                    onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                    className="h-8 w-full min-w-0 [&_input]:text-sm"
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <Label htmlFor="po-supplier" className="text-sm">
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <SelectField
                    id="po-supplier"
                    value={form.supplierId}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, supplierId: v }))
                    }
                    options={activeSuppliers.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    }))}
                    placeholder="Select supplier"
                    aria-label="Supplier"
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <Label htmlFor="po-warehouse" className="text-sm">
                    Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <SelectField
                    id="po-warehouse"
                    value={form.warehouseId}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, warehouseId: v }))
                    }
                    options={activeWarehouses.map((w) => ({
                      value: w.id,
                      label: `${w.code} - ${w.name}`,
                    }))}
                    placeholder="Select warehouse"
                    aria-label="Warehouse"
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <Label htmlFor="po-payment-terms" className="text-sm">
                    Payment terms (days)
                  </Label>
                  <Input
                    id="po-payment-terms"
                    type="number"
                    min={0}
                    step={1}
                    value={form.paymentTermsDays}
                    onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                    placeholder="From supplier or enter"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">Due date</span>
                  <div className="flex h-8 items-center text-sm text-foreground/90 tabular-nums">
                    {computedDueDateDisplay}
                  </div>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <Label htmlFor="po-comment" className="text-sm">Comment</Label>
                  <Input
                    id="po-comment"
                    type="text"
                    value={form.comment}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, comment: e.target.value }))
                    }
                    placeholder="Optional"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="doc-lines mt-[calc(0.5rem+1cm)]">
            <div className="doc-lines__header mb-1.5 max-w-2xl">
              <h3 className="doc-lines__title">Lines</h3>
            </div>
            {!isNew && poFulfillment ? (
              <div className="mb-2 max-w-4xl text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">Receipt fulfillment</span>
                  <span className="tabular-nums text-muted-foreground">
                    {planningFulfillmentStateLabel(poFulfillment.state)}
                  </span>
                  <span className="text-muted-foreground">
                    Received{" "}
                    <span className="text-foreground tabular-nums">{poFulfillment.totalReceived}</span>
                    {" / "}
                    <span className="tabular-nums">{poFulfillment.totalOrdered}</span> ordered
                  </span>
                  <span className="text-muted-foreground">
                    Remaining{" "}
                    <span className="text-foreground tabular-nums">
                      {poFulfillment.totalRemaining < 0
                        ? `${poFulfillment.totalRemaining} (over)`
                        : poFulfillment.totalRemaining}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Receipts:{" "}
                    <span className="text-foreground tabular-nums">{poFulfillment.postedReceiptCount}</span>
                    {" posted / "}
                    <span className="tabular-nums">{poFulfillment.relatedReceiptCount}</span> total
                  </span>
                  {poFulfillment.hasOverFulfillment ? (
                    <span className="text-destructive font-medium">Over-received on line(s)</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isEditable && (
              <div className="flex items-end gap-2 w-full mb-1.5">
                <Card className="border-0 shadow-none flex-1 min-w-0">
                  <CardContent className="p-2 pb-0">
                    <div className="grid grid-cols-2 md:grid-cols-[minmax(200px,240px)_auto_auto_auto_minmax(160px,220px)_minmax(260px,1fr)] gap-x-2 gap-y-1 items-end w-max max-w-full">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-item" className="text-sm">
                        Item <span className="text-destructive">*</span>
                      </Label>
                      <PurchaseOrderItemAutocomplete
                        ref={lineEntryItemPickerRef}
                        id="line-entry-item"
                        value={lineEntryItemId}
                        onChange={handleLineEntryItemChange}
                        items={itemRepository.list()}
                        placeholder="Search by code, barcode or name…"
                        className="w-[240px]"
                        dropdownRightEdgeRef={lineEntryDropdownRightEdgeRef}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-qty" className="text-sm">
                        Qty <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        ref={lineEntryQtyInputRef}
                        id="line-entry-qty"
                        type="number"
                        min={1}
                        value={lineEntryQty}
                        onChange={(e) =>
                          setLineEntryQty(Number(e.target.value) || 1)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingLineId === null) {
                            e.preventDefault();
                            addLineFromEntry();
                          }
                        }}
                        className="h-8 w-[80px] text-sm text-right align-middle [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-unit-price" className="text-sm">Unit price</Label>
                      <Input
                        id="line-entry-unit-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={lineEntryUnitPrice}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const next = Number.isFinite(v) && v >= 0 ? v : 0;
                          setLineEntryUnitPrice(next);
                          if (roundMoney(next) !== 0) setLineEntryZeroPriceReason("");
                        }}
                        className="h-8 w-[80px] text-sm text-right align-middle [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 md:col-span-1">
                      <Label htmlFor="line-entry-zp-reason" className="text-sm">
                        Zero-price reason
                        {roundMoney(lineEntryUnitPrice) === 0 ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <SelectField
                        id="line-entry-zp-reason"
                        value={lineEntryZeroPriceReason}
                        onChange={setLineEntryZeroPriceReason}
                        options={ZERO_PRICE_REASON_SELECT_OPTIONS}
                        placeholder={roundMoney(lineEntryUnitPrice) === 0 ? "Select reason" : "—"}
                        className="w-[min(100%,220px)] min-w-0"
                        disabled={roundMoney(lineEntryUnitPrice) !== 0}
                      />
                    </div>
                    <div
                      ref={lineEntryDropdownRightEdgeRef}
                      className="flex gap-1.5 flex-shrink-0 items-center"
                    >
                      {editingLineId === null ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={addLineFromEntry}
                          >
                            <Plus className="h-4 w-4 shrink-0" aria-hidden />
                            Add line
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => {
                              setLineImportInitialTab("paste");
                              setIsLineImportModalOpen(true);
                            }}
                          >
                            <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden />
                            Add lines
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={updateLineFromEntry}
                          >
                            <Check className="h-4 w-4 shrink-0" aria-hidden />
                            Update line
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            disabled={form.lines.length <= 1}
                            onClick={() => {
                              if (editingLineId !== null) {
                                removeLineByLineId(editingLineId);
                                cancelEdit();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                            Remove
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 shrink-0" aria-hidden />
                            Cancel edit
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="doc-lines__contextual-slot min-h-9 flex items-end">
                      {duplicateChoicePending && editingLineId === null ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs leading-tight">Item already exists</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8"
                              onClick={handleDuplicateIncreaseQty}
                            >
                              Increase quantity
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={handleDuplicateCancel}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : selectedLineIds.length >= 2 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs leading-tight">
                            {selectedLineIds.length} lines selected
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button type="button" variant="outline" size="sm" className="h-8" onClick={removeSelectedLines}>
                              Remove selected lines
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
                <div className="flex flex-row items-center gap-2 shrink-0">
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
                          const path = exportSuccess.path;
                          console.log("[Export] Open file handler started", { path });
                          try {
                            await invoke("open_export_file", { path });
                            console.log("[Export] Open file succeeded");
                            setExportSuccess(null);
                          } catch (err) {
                            console.error("[Export] Open file failed", err);
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
                            title={exportSelectedDisabled ? (!isEditable ? "Selection is available in edit mode only." : "Select one or more lines in the grid first.") : undefined}
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
              </div>
            )}
            {!isEditable && (
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
                        const path = exportSuccess.path;
                        console.log("[Export] Open file handler started", { path });
                        try {
                          await invoke("open_export_file", { path });
                          console.log("[Export] Open file succeeded");
                          setExportSuccess(null);
                        } catch (err) {
                          console.error("[Export] Open file failed", err);
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
                          title={exportSelectedDisabled ? (!isEditable ? "Selection is available in edit mode only." : "Select one or more lines in the grid first.") : undefined}
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
            )}
            <div className="doc-lines__grid">
              <AgGridContainer themeClass="doc-lines-grid">
                <AgGridReact<LineFormRow>
                  ref={linesGridRef}
                  rowData={form.lines}
                  columnDefs={linesColumnDefs}
                  defaultColDef={agGridDefaultColDef}
                  getRowId={(p) => String(p.data._lineId)}
                  getRowClass={getRowClass}
                  rowSelection={isEditable ? { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true } : undefined}
                  selectionColumnDef={isEditable ? agGridSelectionColumnDef : undefined}
                  onSelectionChanged={isEditable ? onLinesSelectionChanged : undefined}
                />
              </AgGridContainer>
            </div>
            {form.lines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Total qty: {totals.totalQty}</span>
                <span>Total amount: {totals.totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Card className="max-w-2xl border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5">
              <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-1">
              <dl className="doc-summary doc-summary--compact doc-summary--dense">
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Number</dt>
                  <dd className="doc-summary__value">{doc!.number}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Date</dt>
                  <dd className="doc-summary__value">{normalizeDateForPO(doc!.date)}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Supplier</dt>
                  <dd className="doc-summary__value">{supplierName}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Warehouse</dt>
                  <dd className="doc-summary__value">{warehouseName}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Payment terms</dt>
                  <dd className="doc-summary__value">
                    {doc!.paymentTermsDays !== undefined ? `${doc!.paymentTermsDays} days` : "—"}
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Due date</dt>
                  <dd className="doc-summary__value">
                    {doc!.dueDate != null && doc!.dueDate !== "" ? doc!.dueDate : "—"}
                  </dd>
                </div>
                {doc!.comment != null && doc!.comment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">Comment</dt>
                    <dd className="doc-summary__value">{doc!.comment}</dd>
                  </div>
                )}
                {doc!.status === "cancelled" && doc!.cancelReasonCode != null && doc!.cancelReasonCode !== "" && (
                  <>
                    <div className="doc-summary__row">
                      <dt className="doc-summary__term">Cancel reason</dt>
                      <dd className="doc-summary__value">
                        {CANCEL_DOCUMENT_REASON_LABELS[doc!.cancelReasonCode as CancelDocumentReasonCode] ??
                          doc!.cancelReasonCode}
                      </dd>
                    </div>
                    {doc!.cancelReasonComment != null && doc!.cancelReasonComment !== "" && (
                      <div className="doc-summary__row">
                        <dt className="doc-summary__term">Cancel comment</dt>
                        <dd className="doc-summary__value">{doc!.cancelReasonComment}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </CardContent>
          </Card>
          <div className="doc-lines mt-[calc(0.5rem+1cm)]">
            <h3 className="doc-lines__title">Lines</h3>
            {poFulfillment ? (
              <div className="mb-2 max-w-4xl text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">Receipt fulfillment</span>
                  <span className="tabular-nums text-muted-foreground">
                    {planningFulfillmentStateLabel(poFulfillment.state)}
                  </span>
                  <span className="text-muted-foreground">
                    Received{" "}
                    <span className="text-foreground tabular-nums">{poFulfillment.totalReceived}</span>
                    {" / "}
                    <span className="tabular-nums">{poFulfillment.totalOrdered}</span> ordered
                  </span>
                  <span className="text-muted-foreground">
                    Remaining{" "}
                    <span className="text-foreground tabular-nums">
                      {poFulfillment.totalRemaining < 0
                        ? `${poFulfillment.totalRemaining} (over)`
                        : poFulfillment.totalRemaining}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Receipts:{" "}
                    <span className="text-foreground tabular-nums">{poFulfillment.postedReceiptCount}</span>
                    {" posted / "}
                    <span className="tabular-nums">{poFulfillment.relatedReceiptCount}</span> total
                  </span>
                  {poFulfillment.hasOverFulfillment ? (
                    <span className="text-destructive font-medium">Over-received on line(s)</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {linesWithItem.length === 0 ? (
              <p className="doc-lines__empty">No lines.</p>
            ) : (
              <>
                <div className="doc-lines__grid">
                  <AgGridContainer themeClass="doc-lines-grid">
                    <AgGridReact<LineWithItem>
                      rowData={linesWithItem}
                      columnDefs={poLinesReadOnlyColumnDefs(poFulfillment)}
                      defaultColDef={agGridDefaultColDef}
                      getRowId={(p) => p.data.id}
                    />
                  </AgGridContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>Total qty: {readonlyTotals.totalQty}</span>
                  <span>Total amount: {readonlyTotals.totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <DocumentLineImportModal
        open={isLineImportModalOpen}
        initialTab={lineImportInitialTab}
        items={itemRepository.list()}
        getDefaultUnitPrice={(item) =>
          roundMoney(
            typeof item.purchasePrice === "number" &&
              Number.isFinite(item.purchasePrice) &&
              item.purchasePrice >= 0
              ? item.purchasePrice
              : 0,
          )
        }
        templateFileName="purchase-order-lines-template.xlsx"
        onOpenChange={setIsLineImportModalOpen}
        onApply={handleApplyImportedLines}
      />
      {!isNew && id ? (
        <DocumentEventLogSection entityType="purchase_order" entityId={id} refresh={refresh} />
      ) : null}
      <CancelDocumentReasonDialog
        open={cancelReasonDialogOpen}
        onOpenChange={setCancelReasonDialogOpen}
        documentKindLabel="purchase order"
        onConfirm={handleCancelDocumentConfirm}
      />
    </DocumentPageLayout>
  );
}
