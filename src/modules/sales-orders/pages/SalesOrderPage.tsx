import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { salesOrderRepository } from "../repository";
import { allocateStock, confirm, cancelDocument, createShipment, saveDraft } from "../service";
import { customerRepository } from "../../customers/repository";
import { carrierRepository } from "../../carriers/repository";
import { translateCarrierType } from "../../carriers";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { SalesOrderLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridSelectionColumnDef,
} from "../../../shared/ui/ag-grid/agGridDefaults";
import { todayYYYYMMDD, normalizeDateForSO } from "../dateUtils";
import { usePlanningDocumentHotkeys } from "../../../shared/hotkeys";
import {
  getCommercialMoneyDecimalPlaces,
  lineAmountMoney,
  roundMoney,
  sumPlanningDocumentLineAmounts,
} from "../../../shared/commercialMoney";
import { computePlanningDueDate, parsePaymentTermsDaysToStore } from "../../../shared/planningCommercialDates";
import { getSalesOrderHealth } from "../../../shared/documentHealth";
import {
  actionIssue,
  actionIssueFromServiceMessage,
  actionWarning,
  combineIssues,
  hasErrors,
  hasWarnings,
  issueListContainsMessage,
  type Issue,
} from "../../../shared/issues";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { SalesOrderItemAutocomplete, type SalesOrderItemAutocompleteRef } from "../components/SalesOrderItemAutocomplete";
import { SalesOrderFinanceSection } from "../components/SalesOrderFinanceSection";
import { deriveSalesOrderPaymentSummary } from "../salesOrderFinance";
import { salesOrderPaymentRepository } from "../salesOrderPaymentRepository";
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
  ClipboardList,
  Coins,
  File,
  FileSpreadsheet,
  FileX,
  FolderOpen,
  History,
  List,
  Activity,
  Plus,
  Save,
  Truck,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { buildLinesXlsxBuffer, buildDocumentXlsxBuffer, type SoExportLineRow, type SoDocumentSummary } from "../soExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  CancelDocumentReasonDialog,
  type CancelDocumentReasonPayload,
} from "../../../shared/ui/object/CancelDocumentReasonDialog";
import { DocumentEventLogSection } from "../../../shared/ui/object/DocumentEventLogSection";
import { DocumentPrintActionsMenu } from "../../../shared/ui/object/DocumentPrintActionsMenu";
import { useSettings } from "../../../shared/settings/SettingsContext";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n/resolve";
import { planningSalesOrderExportLabels } from "@/shared/i18n/excelPlanningExportLabels";
import { translateZeroPriceReason, translateCancelReason } from "@/shared/i18n/reasonLabels";
import {
  translatePlanningFulfillmentState,
  translateSalesOrderAllocationState,
} from "@/shared/i18n/fulfillmentLabels";
import { getEffectiveWorkspaceFeatureEnabled } from "../../../shared/workspace";
import {
  ZERO_PRICE_LINE_REASON_CODES,
  type CancelDocumentReasonCode,
  type ZeroPriceLineReasonCode,
} from "../../../shared/reasonCodes";
import {
  computeSalesOrderFulfillment,
  type SalesOrderFulfillment,
  type SoLineFulfillment,
} from "../../../shared/planningFulfillment";
import {
  computeSalesOrderAllocationView,
  type SalesOrderAllocationView,
  type SoLineAllocationRow,
} from "../../../shared/soAllocation";

type LineWithItem = SalesOrderLine & { itemName: string };

type LineFormRow = {
  itemId: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode: string;
  _lineId: number;
};

type FormState = {
  date: string;
  customerId: string;
  warehouseId: string;
  carrierId: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryComment: string;
  paymentTermsDays: string;
  comment: string;
  lines: LineFormRow[];
};

function defaultForm(): FormState {
  return {
    date: todayYYYYMMDD(),
    customerId: "",
    warehouseId: "",
    carrierId: "",
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryComment: "",
    paymentTermsDays: "",
    comment: "",
    lines: [],
  };
}

function soLinesDisplayColumnDefs(
  t: TFunction,
  fulfillmentByItemId: Map<string, SoLineFulfillment>,
  allocationByItemId: Map<string, SoLineAllocationRow>,
  includeAllocationColumns: boolean,
): ColDef<LineFormRow>[] {
  const dash = t("domain.audit.summary.emDash");
  const allocationCols: ColDef<LineFormRow>[] = includeAllocationColumns
    ? [
        {
          headerName: t("doc.columns.reserved"),
          width: 78,
          minWidth: 70,
          maxWidth: 88,
          editable: false,
          sortable: false,
          valueGetter: (p) => {
            const itemId = p.data?.itemId;
            if (!itemId) return dash;
            const a = allocationByItemId.get(itemId);
            if (!a) return dash;
            return String(a.reservedQty);
          },
        },
        {
          headerName: t("doc.columns.shortage"),
          width: 78,
          minWidth: 70,
          maxWidth: 88,
          editable: false,
          sortable: false,
          valueGetter: (p) => {
            const itemId = p.data?.itemId;
            if (!itemId) return dash;
            const a = allocationByItemId.get(itemId);
            if (!a) return dash;
            return String(a.shortageQty);
          },
        },
      ]
    : [];

  return [
    {
      headerName: t("doc.columns.lineNo"),
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
    },
    {
      headerName: t("doc.columns.itemCode"),
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
      headerName: t("doc.columns.itemName"),
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
      headerName: t("doc.columns.brand"),
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
      headerName: t("doc.columns.category"),
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
      headerName: t("doc.columns.qty"),
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      editable: false,
    },
    {
      headerName: t("doc.columns.shipped"),
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      editable: false,
      sortable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        return String(f.shippedQty);
      },
    },
    {
      headerName: t("doc.columns.remaining"),
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      editable: false,
      sortable: false,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        if (f.remainingQty < 0)
          return t("doc.fulfillment.remainingOver", { qty: f.remainingQty });
        return String(f.remainingQty);
      },
    },
    ...allocationCols,
    {
      field: "unitPrice",
      headerName: t("doc.columns.unitPrice"),
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
      headerName: t("doc.columns.lineAmount"),
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
      headerName: t("doc.columns.zeroPriceReason"),
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      editable: false,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
    },
  ];
}

function soLinesReadOnlyColumnDefs(
  t: TFunction,
  fulfillment: SalesOrderFulfillment | null,
  allocation: SalesOrderAllocationView | null,
  includeAllocationColumns: boolean,
): ColDef<LineWithItem>[] {
  const dash = t("domain.audit.summary.emDash");
  const allocationCols: ColDef<LineWithItem>[] = includeAllocationColumns
    ? [
        {
          headerName: t("doc.columns.reserved"),
          width: 78,
          minWidth: 70,
          maxWidth: 88,
          sortable: false,
          valueGetter: (p) => {
            const lineId = p.data?.id;
            if (!lineId || !allocation) return dash;
            const row = allocation.lines.find((l) => l.lineId === lineId);
            if (!row) return dash;
            return String(row.reservedQty);
          },
        },
        {
          headerName: t("doc.columns.shortage"),
          width: 78,
          minWidth: 70,
          maxWidth: 88,
          sortable: false,
          valueGetter: (p) => {
            const lineId = p.data?.id;
            if (!lineId || !allocation) return dash;
            const row = allocation.lines.find((l) => l.lineId === lineId);
            if (!row) return dash;
            return String(row.shortageQty);
          },
        },
      ]
    : [];

  return [
    {
      headerName: t("doc.columns.lineNo"),
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
    },
    {
      headerName: t("doc.columns.itemCode"),
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
    { field: "itemName", headerName: t("doc.columns.itemName"), flex: 1, minWidth: 180 },
    {
      headerName: t("doc.columns.brand"),
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
      headerName: t("doc.columns.category"),
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
    { field: "qty", headerName: t("doc.columns.qty"), width: 80, minWidth: 70, maxWidth: 90 },
    {
      headerName: t("doc.columns.shipped"),
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      sortable: false,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return dash;
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return dash;
        return String(row.shippedQty);
      },
    },
    {
      headerName: t("doc.columns.remaining"),
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      sortable: false,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return dash;
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return dash;
        if (row.remainingQty < 0)
          return t("doc.fulfillment.remainingOver", { qty: row.remainingQty });
        return String(row.remainingQty);
      },
    },
    ...allocationCols,
    {
      field: "unitPrice",
      headerName: t("doc.columns.unitPrice"),
      width: 110,
      minWidth: 100,
      maxWidth: 120,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? p.value.toFixed(2)
          : "0.00",
    },
    {
      headerName: t("doc.columns.lineAmount"),
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
      headerName: t("doc.columns.zeroPriceReason"),
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
    },
  ];
}

function buildExportRowsFromFormLines(lines: LineFormRow[]): SoExportLineRow[] {
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

function buildExportRowsFromLinesWithItem(lines: LineWithItem[]): SoExportLineRow[] {
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

export function SalesOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { settings } = useSettings();
  const [refresh, setRefresh] = useState(0);
  const isNew = id === "new";
  const doc = useMemo(
    () => (id && !isNew ? salesOrderRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );
  const lines = useMemo(
    () => (id && !isNew ? salesOrderRepository.listLines(id) : []),
    [id, isNew, refresh],
  );

  const canOpenPreliminaryCustomerDoc = useMemo(
    () => Boolean(!isNew && id && doc && doc.status !== "cancelled" && lines.length > 0),
    [isNew, id, doc, lines.length],
  );

  const salesOrderPrintMenuItems = useMemo(() => {
    if (!id || !canOpenPreliminaryCustomerDoc) return [];
    return [
      { to: `/sales-orders/${id}/customer-document`, label: t("doc.customerDocument.preliminaryTitle") },
      { to: `/sales-orders/${id}/customer-invoice`, label: t("finance.openCustomerInvoiceShort") },
    ];
  }, [id, canOpenPreliminaryCustomerDoc, t, locale]);

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
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [soWorkingTab, setSoWorkingTab] = useState<"lines" | "execution" | "payments" | "events">("lines");
  const linesGridRef = useRef<AgGridReact<LineFormRow> | null>(null);
  const lineEntryItemPickerRef = useRef<SalesOrderItemAutocompleteRef | null>(null);
  const lineEntryQtyInputRef = useRef<HTMLInputElement | null>(null);
  const lineEntryDropdownRightEdgeRef = useRef<HTMLDivElement | null>(null);
  const prevCustomerIdRef = useRef<string | null>(null);

  const zeroPriceReasonOptions = useMemo(
    () =>
      ZERO_PRICE_LINE_REASON_CODES.map((code) => ({
        value: code,
        label: translateZeroPriceReason(t, code),
      })),
    [t, locale],
  );

  useEffect(() => {
    prevCustomerIdRef.current = null;
  }, [id]);

  useEffect(() => {
    setActionIssues([]);
  }, [
    form.customerId,
    form.warehouseId,
    form.carrierId,
    form.recipientName,
    form.recipientPhone,
    form.deliveryAddress,
    form.deliveryComment,
    form.paymentTermsDays,
    form.lines,
  ]);

  useEffect(() => {
    if (isNew) {
      nextLineIdRef.current = 0;
      prevCustomerIdRef.current = null;
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
      const draftLines = salesOrderRepository.listLines(id);
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
        date: normalizeDateForSO(doc.date),
        customerId: doc.customerId,
        warehouseId: doc.warehouseId,
        carrierId: doc.carrierId ?? "",
        recipientName: doc.recipientName ?? "",
        recipientPhone: doc.recipientPhone ?? "",
        deliveryAddress: doc.deliveryAddress ?? "",
        deliveryComment: doc.deliveryComment ?? "",
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
    doc?.customerId,
    doc?.warehouseId,
    doc?.carrierId,
    doc?.recipientName,
    doc?.recipientPhone,
    doc?.deliveryAddress,
    doc?.deliveryComment,
    doc?.paymentTermsDays,
    doc?.comment,
    refresh,
  ]);

  const customerName = useMemo(
    () =>
      doc
        ? customerRepository.getById(doc.customerId)?.name ?? doc.customerId
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
  const emDashSummary = t("domain.audit.summary.emDash");
  const carrierReadOnlyLabel = useMemo(() => {
    if (!doc?.carrierId?.trim()) return emDashSummary;
    const c = carrierRepository.getById(doc.carrierId.trim());
    if (!c) return t("doc.shipment.unknownCarrier");
    return c.name;
  }, [doc?.carrierId, emDashSummary, t, locale]);
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

  const workspaceMode = settings.general.workspaceMode;
  const profileOverrides = settings.general.profileOverrides;
  const showSalesOrderAllocationUi = useMemo(() => {
    return getEffectiveWorkspaceFeatureEnabled(
      workspaceMode,
      profileOverrides,
      "salesOrderAllocateStock",
      { requireReservationBeforeShipment: settings.inventory.requireReservationBeforeShipment },
    );
  }, [
    workspaceMode,
    profileOverrides,
    settings.inventory.requireReservationBeforeShipment,
  ]);
  const showDocumentEventLogSection = useMemo(
    () =>
      getEffectiveWorkspaceFeatureEnabled(workspaceMode, profileOverrides, "documentEventLog") &&
      settings.documents.showDocumentEventLog,
    [workspaceMode, profileOverrides, settings.documents.showDocumentEventLog],
  );

  useEffect(() => {
    if (!isEditable) return;
    const cid = form.customerId.trim();
    if (prevCustomerIdRef.current === null) {
      prevCustomerIdRef.current = cid;
      return;
    }
    if (prevCustomerIdRef.current === cid) return;
    prevCustomerIdRef.current = cid;

    const cust = cid ? customerRepository.getById(cid) : undefined;
    const d = cust?.paymentTermsDays;
    const paymentTermsDays =
      d !== undefined && Number.isFinite(d) && Number.isInteger(d) && d >= 0 ? String(d) : "";

    let carrierId = "";
    if (cust && cid) {
      const p = cust.preferredCarrierId?.trim() ?? "";
      if (p !== "" && carrierRepository.getById(p)) carrierId = p;
    }

    const recipientName = cust?.defaultRecipientName ?? "";
    const recipientPhone = cust?.defaultRecipientPhone ?? "";
    const deliveryAddress = cust?.defaultDeliveryAddress ?? "";
    const deliveryComment = cust?.defaultDeliveryComment ?? "";

    setForm((f) => ({
      ...f,
      paymentTermsDays,
      carrierId,
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryComment,
    }));
  }, [form.customerId, isEditable]);

  const carrierSelectOptions = useMemo(() => {
    const all = carrierRepository.list();
    const active = all
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const sel = form.carrierId.trim();
    if (!sel) return active;
    const current = all.find((c) => c.id === sel);
    if (current && !current.isActive && !active.some((c) => c.id === sel)) {
      return [current, ...active];
    }
    return active;
  }, [form.carrierId, locale]);

  const computedDueDateDisplay = useMemo(() => {
    const d = computePlanningDueDate(
      normalizeDateForSO(form.date),
      parsePaymentTermsDaysToStore(form.paymentTermsDays),
    );
    return d ?? t("domain.audit.summary.emDash");
  }, [form.date, form.paymentTermsDays, t, locale]);

  const activeCustomers = useMemo(
    () => customerRepository.list().filter((c) => c.isActive),
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
    else if (!issueListContainsMessage(health.issues, result.error))
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
  };
  const handleCancelDocument = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    setCancelReasonDialogOpen(true);
  };
  const handleCreateShipment = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = createShipment(id);
    if (result.success) navigate(`/shipments/${result.shipmentId}`);
    else if (!issueListContainsMessage(health.issues, result.error))
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
  };

  const handleAllocateStock = () => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = allocateStock(id);
    if (result.success) setRefresh((r) => r + 1);
    else if (!issueListContainsMessage(health.issues, result.error))
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
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
        date: normalizeDateForSO(form.date),
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        carrierId: form.carrierId.trim() || undefined,
        recipientName: form.recipientName || undefined,
        recipientPhone: form.recipientPhone || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        deliveryComment: form.deliveryComment || undefined,
        paymentTermsDays: form.paymentTermsDays,
        comment: form.comment || undefined,
        lines: linesToSave,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      if (isNew) {
        navigate(`/sales-orders/${result.id}`, { replace: true });
      } else {
        setRefresh((r) => r + 1);
      }
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/sales-orders");
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
      setActionIssues([actionIssue(t("doc.so.errors.invalidItem"))]);
      return;
    }
    if (!item.isActive) {
      setActionIssues([actionIssue(t("doc.so.errors.inactiveItem"))]);
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
        roundMoney(
          typeof row.unitPrice === "number" && !Number.isNaN(row.unitPrice) && row.unitPrice >= 0
            ? row.unitPrice
            : 0,
        ),
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
    const price = item?.salePrice;
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
          t("doc.so.importWarning", { added: lines.length, skipped: skippedRows }),
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
    const totalAmount = sumPlanningDocumentLineAmounts(form.lines);
    return { totalQty, totalAmount };
  }, [form.lines]);

  const readonlyTotals = useMemo(() => {
    let totalQty = 0;
    for (const l of lines) {
      const q = typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0;
      totalQty += q;
    }
    const totalAmount = sumPlanningDocumentLineAmounts(lines);
    return { totalQty, totalAmount };
  }, [lines]);

  const soDetailsPaymentSummary = useMemo(() => {
    const totalAmount = isEditable ? totals.totalAmount : readonlyTotals.totalAmount;
    const payments = !isNew && id ? salesOrderPaymentRepository.listBySalesOrderId(id) : [];
    return deriveSalesOrderPaymentSummary(totalAmount, payments);
  }, [isEditable, totals.totalAmount, readonlyTotals.totalAmount, isNew, id, refresh]);

  const health = useMemo(
    () =>
      getSalesOrderHealth({
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        carrierId: form.carrierId,
        recipientPhone: form.recipientPhone,
        paymentTermsDays: form.paymentTermsDays,
        lines: form.lines,
      }),
    [
      form.customerId,
      form.warehouseId,
      form.carrierId,
      form.recipientPhone,
      form.paymentTermsDays,
      form.lines,
    ],
  );

  const handleCancelDocumentConfirm = (payload: CancelDocumentReasonPayload) => {
    if (!id || isNew) return;
    setActionIssues([]);
    const result = cancelDocument(id, payload);
    if (result.success) setRefresh((r) => r + 1);
    else if (!issueListContainsMessage(health.issues, result.error))
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
  };

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
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

  const soFulfillment = useMemo(() => {
    if (!id || isNew) return null;
    return computeSalesOrderFulfillment(id);
  }, [id, isNew, refresh]);

  const soFulfillmentByItemId = useMemo(() => {
    const m = new Map<string, SoLineFulfillment>();
    if (!soFulfillment) return m;
    for (const row of soFulfillment.lines) {
      m.set(row.itemId, row);
    }
    return m;
  }, [soFulfillment]);

  const soAllocationView = useMemo(() => {
    if (!id || isNew) return null;
    return computeSalesOrderAllocationView(id);
  }, [id, isNew, refresh]);

  const soAllocationByItemId = useMemo(() => {
    const m = new Map<string, SoLineAllocationRow>();
    if (!soAllocationView) return m;
    for (const row of soAllocationView.lines) {
      m.set(row.itemId, row);
    }
    return m;
  }, [soAllocationView]);

  const linesColumnDefs = useMemo(
    () =>
      soLinesDisplayColumnDefs(
        t,
        soFulfillmentByItemId,
        soAllocationByItemId,
        showSalesOrderAllocationUi,
      ),
    [t, locale, soFulfillmentByItemId, soAllocationByItemId, showSalesOrderAllocationUi],
  );

  const readOnlyLinesColumnDefs = useMemo(
    () =>
      soLinesReadOnlyColumnDefs(
        t,
        soFulfillment,
        soAllocationView,
        showSalesOrderAllocationUi,
      ),
    [t, locale, soFulfillment, soAllocationView, showSalesOrderAllocationUi],
  );

  const soNumberForFile = doc?.number ?? "new";

  const getExportRowsAll = useCallback((): SoExportLineRow[] => {
    if (isEditable) return buildExportRowsFromFormLines(form.lines);
    return buildExportRowsFromLinesWithItem(linesWithItem);
  }, [isEditable, form.lines, linesWithItem]);

  const getExportRowsSelected = useCallback((): SoExportLineRow[] => {
    if (!isEditable) return [];
    if (selectedLineIds.length === 0) return [];
    const set = new Set(selectedLineIds);
    const filtered = form.lines.filter((l) => set.has(l._lineId));
    return buildExportRowsFromFormLines(filtered);
  }, [isEditable, selectedLineIds, form.lines]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
      const base = defaultFilename.replace(/\.[^.]+$/, "");
      const generatedFilename = buildReadableUniqueFilename({ base, extension });
      try {
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) return;
        const safePath = await ensureUniqueExportPath(path);

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
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
    [t],
  );

  const soExcelLabels = useMemo(() => planningSalesOrderExportLabels(t), [t, locale]);

  const handleExportMain = useCallback(() => {
    const rows = getExportRowsAll();
    const summary: SoDocumentSummary = {
      number: isNew ? t("domain.audit.summary.emDash") : doc!.number,
      date: normalizeDateForSO(isEditable ? form.date : doc?.date ?? ""),
      status: doc?.status ?? "draft",
      customer: customerName,
      warehouse: warehouseName,
      comment: isEditable ? form.comment : doc?.comment ?? "",
      recipientName: isEditable ? form.recipientName.trim() || undefined : doc?.recipientName,
      recipientPhone: isEditable ? form.recipientPhone.trim() || undefined : doc?.recipientPhone,
      deliveryAddress: isEditable ? form.deliveryAddress.trim() || undefined : doc?.deliveryAddress,
      deliveryComment: isEditable ? form.deliveryComment.trim() || undefined : doc?.deliveryComment,
      totalQty: isEditable ? totals.totalQty : readonlyTotals.totalQty,
      totalAmount: isEditable ? totals.totalAmount : readonlyTotals.totalAmount,
    };
    runExportWithSaveAs(`${soNumberForFile}_document.xlsx`, () =>
      buildDocumentXlsxBuffer(summary, rows, soExcelLabels),
    );
  }, [
    getExportRowsAll,
    soExcelLabels,
    isNew,
    doc,
    isEditable,
    form.date,
    form.comment,
    form.recipientName,
    form.recipientPhone,
    form.deliveryAddress,
    form.deliveryComment,
    doc?.date,
    doc?.status,
    doc?.comment,
    doc?.recipientName,
    doc?.recipientPhone,
    doc?.deliveryAddress,
    doc?.deliveryComment,
    customerName,
    warehouseName,
    totals.totalQty,
    totals.totalAmount,
    readonlyTotals.totalQty,
    readonlyTotals.totalAmount,
    soNumberForFile,
    runExportWithSaveAs,
    t,
  ]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${soNumberForFile}_selected-lines.xlsx`, () =>
      buildLinesXlsxBuffer(rows, soExcelLabels),
    );
  }, [getExportRowsSelected, soNumberForFile, soExcelLabels, runExportWithSaveAs]);

  const handleExportAll = useCallback(() => {
    const rows = getExportRowsAll();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${soNumberForFile}_all-lines.xlsx`, () => buildLinesXlsxBuffer(rows, soExcelLabels));
  }, [getExportRowsAll, soNumberForFile, soExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = !isEditable || selectedLineIds.length === 0;

  usePlanningDocumentHotkeys({
    isEditable,
    editingLineId,
    isLineImportModalOpen,
    onSave: handleSave,
    onAddLine: addLineFromEntry,
    onOpenLineImport: () => {
      setLineImportInitialTab("paste");
      setIsLineImportModalOpen(true);
    },
    allocateStockAvailable: !isNew && isConfirmed && showSalesOrderAllocationUi,
    onAllocateStock: handleAllocateStock,
  });

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("doc.notFound.salesOrder")}</p>
      </div>
    );
  }

  if (!isNew && !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("doc.notFound.salesOrder")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("shell.sales"), to: "/sales-orders" },
    { label: t("shell.nav.salesOrders"), to: "/sales-orders" },
    { label: isNew ? t("doc.page.new") : doc!.number },
  ];

  const displayTitle = isNew
    ? t("doc.so.titleNew")
    : t("doc.so.titleNumbered", { number: doc!.number });
  const displayNumber = isNew ? t("domain.audit.summary.emDash") : doc!.number;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/sales-orders" aria-label={t("doc.so.backToListAria")} />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
            {!isNew && (
              <Badge
                variant="outline"
                className="h-6 rounded-full border-border px-2.5 text-xs font-medium leading-none text-foreground"
              >
                {t(`status.labels.${doc!.status}`)}
              </Badge>
            )}
          </div>
          <div className="doc-header__right">
            {isEditable && (hasErrors(combinedIssues) || hasWarnings(combinedIssues)) && (
              <DocumentIssueStrip issues={combinedIssues} />
            )}
            <div className="doc-header__actions items-center [&_button]:!text-xs [&_button]:!leading-tight [&_button_svg]:!h-3 [&_button_svg]:!w-3 [&_button_svg]:!max-h-3 [&_button_svg]:!max-w-3">
              {isEditable && (
                <Button
                  type="button"
                  className="h-[1.625rem] !px-1 !py-0 !gap-0.5"
                  onClick={handleSave}
                  title={t("doc.page.saveTitle")}
                >
                  <Save aria-hidden />
                  {t("common.save")}
                </Button>
              )}
              {!isNew && isDraft && (
                <Button
                  type="button"
                  className="h-[1.625rem] !px-1 !py-0 !gap-0.5"
                  onClick={handleConfirm}
                  disabled={
                    settings.documents.blockConfirmWhenPlanningHasBlockingErrors &&
                    hasErrors(health.issues)
                  }
                  title={
                    settings.documents.blockConfirmWhenPlanningHasBlockingErrors &&
                    hasErrors(health.issues)
                      ? t("doc.page.fixErrorsBeforeConfirm")
                      : undefined
                  }
                >
                  <CircleCheck aria-hidden />
                  {t("doc.page.confirm")}
                </Button>
              )}
              {!isNew && isConfirmed && showSalesOrderAllocationUi && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-[1.625rem] !px-1 !py-0 !gap-0.5"
                  onClick={handleAllocateStock}
                  title={t("doc.page.allocateStockTitle")}
                >
                  <ClipboardList className="h-3 w-3" aria-hidden />
                  {t("doc.page.allocateStock")}
                </Button>
              )}
              {!isNew && isConfirmed && (
                <Button type="button" className="h-[1.625rem] !px-1 !py-0 !gap-0.5" onClick={handleCreateShipment}>
                  <Truck className="h-3 w-3" aria-hidden /> {t("doc.page.createShipment")}
                </Button>
              )}
              {!isNew && (isDraft || isConfirmed) && (
                <Button type="button" variant="outline" className="h-[1.625rem] !px-1 !py-0 !gap-0.5" onClick={handleCancelDocument}>
                  <FileX aria-hidden />
                  {t("doc.page.cancelDocument")}
                </Button>
              )}
              {!isNew && (
                <>
                  <DocumentPrintActionsMenu
                    items={salesOrderPrintMenuItems}
                    triggerLabel={t("doc.page.print")}
                    aria-label={t("doc.page.printMenuAria")}
                    className="h-[1.625rem] !px-1 !py-0 !gap-0.5"
                  />
                  <div className="relative shrink-0">
                    <div className="flex items-stretch rounded-md border border-input shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-[1.625rem] rounded-r-none border-0 border-r border-input !px-1 !py-0 !gap-0.5"
                        onClick={handleExportMain}
                      >
                        <FileSpreadsheet className="h-4 w-4 shrink-0" />
                        {t("doc.page.export")}
                      </Button>
                      <Popover open={exportOpen} onOpenChange={setExportOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-[1.625rem] w-[1.625rem] shrink-0 rounded-l-none border-0 shadow-none"
                            aria-label={t("doc.list.exportOptionsAria")}
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
                              title={
                                exportSelectedDisabled
                                  ? !isEditable
                                    ? t("doc.list.exportSelectionEditModeOnly")
                                    : t("doc.list.exportSelectLinesFirst")
                                  : undefined
                              }
                              onClick={() => {
                                setExportOpen(false);
                                if (!exportSelectedDisabled) handleExportSelected();
                              }}
                            >
                              {t("doc.list.exportSelectedRows")}
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
                              onClick={() => {
                                setExportOpen(false);
                                handleExportAll();
                              }}
                            >
                              {t("doc.list.exportAllLines")}
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {exportSuccess && (
                      <div className="absolute right-0 top-full z-10 mt-1 h-7 w-max flex max-w-[20rem] items-center gap-0 rounded-md border border-input bg-background px-1 text-sm">
                        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label={t("doc.list.exportCompleted")} />
                        <span className="ml-1 font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>
                          {exportSuccess.filename}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 !p-0 shrink-0 text-muted-foreground hover:text-foreground"
                          title={t("doc.list.openFile")}
                          aria-label={t("doc.list.openFile")}
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
                          className="h-5 w-5 !p-0 shrink-0 text-muted-foreground hover:text-foreground"
                          title={t("doc.list.openFolder")}
                          aria-label={t("doc.list.openFolder")}
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
                          className="h-[1.125rem] w-[1.125rem] !p-0 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                          title={t("doc.list.dismiss")}
                          aria-label={t("doc.list.dismiss")}
                          onClick={() => setExportSuccess(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {isEditable && (
                <Button type="button" variant="outline" className="h-[1.625rem] !px-1 !py-0 !gap-0.5" onClick={handleCancel}>
                  <X aria-hidden />
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      <div className="doc-so-page flex w-full min-w-0 flex-col gap-2">
      {isEditable ? (
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardHeader className="px-3 py-2 pb-1.5">
              <CardTitle className="text-[0.9rem] font-semibold">{t("doc.page.details")}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="flex w-full min-w-0 flex-col gap-y-2 overflow-x-auto lg:flex-row lg:flex-nowrap lg:justify-start lg:gap-x-[1.5cm] lg:gap-y-0 lg:items-start">
                <div className="flex w-fit min-w-0 max-w-full shrink-0 flex-col gap-2.5 p-3">
                  <section className="min-w-0" aria-labelledby="so-details-doc-heading">
                    <h3
                      id="so-details-doc-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <File className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionDocument")}
                    </h3>
                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-0 sm:grid-cols-2 sm:justify-items-start">
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-number" className="text-xs leading-none">
                          {t("doc.columns.number")}
                        </Label>
                        <div id="so-number" className="flex h-6 items-center text-sm leading-tight text-muted-foreground">
                          {displayNumber}
                        </div>
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-date" className="text-xs leading-none">
                          {t("doc.columns.date")} <span className="text-destructive">*</span>
                        </Label>
                        <DatePickerField
                          id="so-date"
                          value={form.date}
                          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                          className="h-8 w-full max-w-[140px] min-w-0 [&_input]:text-sm"
                        />
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-customer" className="text-xs leading-none">
                          {t("doc.columns.customer")} <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                          id="so-customer"
                          value={form.customerId}
                          onChange={(customerId) => setForm((f) => ({ ...f, customerId }))}
                          options={activeCustomers.map((c) => ({
                            value: c.id,
                            label: `${c.code} - ${c.name}`,
                          }))}
                          placeholder={t("doc.page.selectCustomer")}
                          className="!w-[140px] min-w-0"
                        />
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-warehouse" className="text-xs leading-none">
                          {t("doc.columns.warehouse")} <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                          id="so-warehouse"
                          value={form.warehouseId}
                          onChange={(warehouseId) => setForm((f) => ({ ...f, warehouseId }))}
                          options={activeWarehouses.map((w) => ({
                            value: w.id,
                            label: `${w.code} - ${w.name}`,
                          }))}
                          placeholder={t("doc.page.selectWarehouse")}
                          className="!w-[140px] min-w-0"
                        />
                      </div>
                    </div>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="flex min-w-0 flex-col" aria-labelledby="so-details-delivery-heading">
                    <h3
                      id="so-details-delivery-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <Truck className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionDelivery")}
                    </h3>
                    <div className="flex w-full max-w-[20rem] min-w-0 flex-col gap-1.5 self-start">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-carrier" className="text-xs leading-none">
                          {t("doc.so.carrier")}
                        </Label>
                        <select
                          id="so-carrier"
                          className={cn(
                            "flex h-8 w-full max-w-full rounded-md border border-input bg-background px-1.5 py-0 text-sm leading-tight text-foreground",
                          )}
                          value={form.carrierId}
                          onChange={(e) => setForm((f) => ({ ...f, carrierId: e.target.value }))}
                          aria-label={t("doc.so.carrier")}
                        >
                          <option value="">{t("doc.shipment.carrierNotSet")}</option>
                          {carrierSelectOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {translateCarrierType(t, c.carrierType)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-x-2.5 gap-y-1 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <Label htmlFor="so-recipient-name" className="text-xs leading-none">
                            {t("doc.shipment.recipientName")}
                          </Label>
                          <Input
                            id="so-recipient-name"
                            type="text"
                            value={form.recipientName}
                            onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                            className="h-8 px-1.5 py-0 text-sm leading-tight"
                            autoComplete="name"
                          />
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <Label htmlFor="so-recipient-phone" className="text-xs leading-none">
                            {t("doc.shipment.recipientPhone")}
                          </Label>
                          <Input
                            id="so-recipient-phone"
                            type="text"
                            value={form.recipientPhone}
                            onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                            className="h-8 px-1.5 py-0 text-sm leading-tight"
                            autoComplete="tel"
                          />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-delivery-address" className="text-xs leading-none">
                          {t("doc.shipment.deliveryAddress")}
                        </Label>
                        <Textarea
                          id="so-delivery-address"
                          value={form.deliveryAddress}
                          onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                          rows={2}
                          className="min-h-[2.5rem] resize-y px-1.5 py-0.5 text-sm leading-tight"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Label htmlFor="so-delivery-comment" className="text-xs leading-none">
                          {t("doc.shipment.deliveryComment")}
                        </Label>
                        <Textarea
                          id="so-delivery-comment"
                          value={form.deliveryComment}
                          onChange={(e) => setForm((f) => ({ ...f, deliveryComment: e.target.value }))}
                          rows={2}
                          className="min-h-[2.5rem] resize-y px-1.5 py-0.5 text-sm leading-tight"
                        />
                      </div>
                    </div>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="flex min-w-0 flex-col" aria-labelledby="so-details-commercial-heading">
                    <h3
                      id="so-details-commercial-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <Coins className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionCommercial")}
                    </h3>
                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-0.5 sm:grid-cols-2 sm:items-start sm:justify-items-start">
                      <div className="flex w-full min-w-0 max-w-[calc(120px-1cm)] flex-col gap-0.5">
                        <Label htmlFor="so-payment-terms" className="text-xs leading-tight">
                          {t("doc.page.paymentTermsDaysLabel")}
                        </Label>
                        <Input
                          id="so-payment-terms"
                          type="number"
                          min={0}
                          step={1}
                          value={form.paymentTermsDays}
                          onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                          className="h-8 w-full text-right tabular-nums text-sm [appearance:textfield] focus-visible:border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/25 focus-visible:ring-offset-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex w-full max-w-[140px] min-w-0 flex-col gap-0.5">
                        <span className="text-sm leading-tight text-muted-foreground">{t("doc.page.dueDate")}</span>
                        <div className="flex min-h-8 items-center text-sm leading-tight text-foreground/90 tabular-nums">
                          {computedDueDateDisplay}
                        </div>
                      </div>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.orderTotal")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-semibold leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.totalAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.paidTotal")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-medium leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.paidAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.remaining")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-medium leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.remainingAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.paymentStatusLabel")}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-auto w-full max-w-[140px] justify-start border-0 p-0 text-left text-xs leading-tight text-foreground"
                      >
                        {t(`finance.paymentStatus.${soDetailsPaymentSummary.status}`)}
                      </Badge>
                    </div>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="min-w-0" aria-labelledby="so-details-notes-heading">
                    <h3
                      id="so-details-notes-heading"
                      className="mb-1 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionNotes")}
                    </h3>
                    <Label htmlFor="so-comment" className="sr-only">
                      {t("doc.columns.comment")}
                    </Label>
                    <Textarea
                      id="so-comment"
                      value={form.comment}
                      onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                      rows={3}
                      className="min-h-[4rem] w-[min(24rem,100%)] min-w-[12rem] resize-y text-sm"
                    />
                  </section>
                </div>
              </div>
            </CardContent>
          </Card>
      ) : (
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardHeader className="px-3 py-2 pb-1.5">
              <CardTitle className="text-[0.9rem] font-semibold">{t("doc.page.details")}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="flex w-full min-w-0 flex-col gap-y-2 overflow-x-auto lg:flex-row lg:flex-nowrap lg:justify-start lg:gap-x-[1.5cm] lg:gap-y-0 lg:items-start">
                <div className="flex w-fit min-w-0 max-w-full shrink-0 flex-col gap-2.5 p-3">
                  <section className="min-w-0" aria-labelledby="so-ro-details-doc-heading">
                    <h3
                      id="so-ro-details-doc-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <File className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionDocument")}
                    </h3>
                    <dl className="doc-summary doc-summary--compact doc-summary--dense so-doc-summary-compact">
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.columns.number")}</dt>
                        <dd className="doc-summary__value font-medium">{doc!.number}</dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.columns.date")}</dt>
                        <dd className="doc-summary__value">{normalizeDateForSO(doc!.date)}</dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.columns.customer")}</dt>
                        <dd className="doc-summary__value">{customerName}</dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.columns.warehouse")}</dt>
                        <dd className="doc-summary__value">{warehouseName}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="flex min-w-0 flex-col" aria-labelledby="so-ro-details-delivery-heading">
                    <h3
                      id="so-ro-details-delivery-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <Truck className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionDelivery")}
                    </h3>
                    <dl className="doc-summary doc-summary--compact doc-summary--dense so-doc-summary-compact max-w-[20rem] min-w-0 self-start">
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.so.carrier")}</dt>
                        <dd className="doc-summary__value">{carrierReadOnlyLabel}</dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.shipment.recipientName")}</dt>
                        <dd className="doc-summary__value">
                          {doc!.recipientName?.trim()
                            ? doc!.recipientName.trim()
                            : emDashSummary}
                        </dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.shipment.recipientPhone")}</dt>
                        <dd className="doc-summary__value">
                          {doc!.recipientPhone?.trim()
                            ? doc!.recipientPhone.trim()
                            : emDashSummary}
                        </dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.shipment.deliveryAddress")}</dt>
                        <dd className="doc-summary__value whitespace-pre-wrap text-sm leading-snug">
                          {doc!.deliveryAddress?.trim()
                            ? doc!.deliveryAddress.trim()
                            : emDashSummary}
                        </dd>
                      </div>
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.shipment.deliveryComment")}</dt>
                        <dd className="doc-summary__value whitespace-pre-wrap text-sm leading-snug">
                          {doc!.deliveryComment?.trim()
                            ? doc!.deliveryComment.trim()
                            : emDashSummary}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="flex min-w-0 flex-col" aria-labelledby="so-ro-details-commercial-heading">
                    <h3
                      id="so-ro-details-commercial-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <Coins className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionCommercial")}
                    </h3>
                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-0.5 sm:grid-cols-2 sm:items-start sm:justify-items-start">
                      <dl className="doc-summary doc-summary--compact doc-summary--dense so-doc-summary-compact m-0 min-w-0 max-w-full self-start">
                        <div className="doc-summary__row py-0.5">
                          <dt className="doc-summary__term">{t("doc.summary.paymentTerms")}</dt>
                          <dd className="doc-summary__value">
                            {doc!.paymentTermsDays !== undefined
                              ? t("doc.summary.paymentTermsDays", { days: doc!.paymentTermsDays })
                              : t("domain.audit.summary.emDash")}
                          </dd>
                        </div>
                      </dl>
                      <dl className="doc-summary doc-summary--compact doc-summary--dense so-doc-summary-compact m-0 min-w-0 max-w-[140px] self-start">
                        <div className="doc-summary__row py-0.5">
                          <dt className="doc-summary__term">{t("doc.page.dueDate")}</dt>
                          <dd className="doc-summary__value tabular-nums">
                            {doc!.dueDate != null && doc!.dueDate !== ""
                              ? doc!.dueDate
                              : t("domain.audit.summary.emDash")}
                          </dd>
                        </div>
                      </dl>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.orderTotal")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-semibold leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.totalAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.paidTotal")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-medium leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.paidAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.remaining")}
                      </span>
                      <span className="w-full max-w-[140px] text-xs font-medium leading-tight tabular-nums text-foreground">
                        {roundMoney(soDetailsPaymentSummary.remainingAmount).toFixed(getCommercialMoneyDecimalPlaces())}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground whitespace-nowrap">
                        {t("finance.paymentStatusLabel")}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-auto w-full max-w-[140px] justify-start border-0 p-0 text-left text-xs leading-tight text-foreground"
                      >
                        {t(`finance.paymentStatus.${soDetailsPaymentSummary.status}`)}
                      </Badge>
                    </div>
                  </section>
                </div>
                <div className="flex min-h-0 w-fit min-w-0 max-w-full shrink-0 flex-col p-3">
                  <section className="min-w-0" aria-labelledby="so-ro-details-notes-heading">
                    <h3
                      id="so-ro-details-notes-heading"
                      className="mb-0.5 flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      {t("doc.so.sectionNotes")}
                    </h3>
                    <dl className="doc-summary doc-summary--compact doc-summary--dense so-doc-summary-compact so-notes-summary-stack">
                      <div className="doc-summary__row py-0.5">
                        <dt className="doc-summary__term">{t("doc.columns.comment")}</dt>
                        <dd className="doc-summary__value whitespace-pre-wrap">
                          {doc!.comment != null && doc!.comment.trim() !== "" ? doc!.comment : emDashSummary}
                        </dd>
                      </div>
                      {doc!.status === "cancelled" && doc!.cancelReasonCode != null && doc!.cancelReasonCode !== "" && (
                        <>
                          <div className="doc-summary__row py-0.5">
                            <dt className="doc-summary__term text-destructive">{t("doc.summary.cancelReason")}</dt>
                            <dd className="doc-summary__value whitespace-pre-wrap">
                              {translateCancelReason(t, doc!.cancelReasonCode as CancelDocumentReasonCode)}
                            </dd>
                          </div>
                          {doc!.cancelReasonComment != null && doc!.cancelReasonComment.trim() !== "" && (
                            <div className="doc-summary__row py-0.5">
                              <dt className="doc-summary__term">{t("doc.summary.cancelComment")}</dt>
                              <dd className="doc-summary__value whitespace-pre-wrap">{doc!.cancelReasonComment}</dd>
                            </div>
                          )}
                        </>
                      )}
                    </dl>
                  </section>
                </div>
              </div>
            </CardContent>
          </Card>
      )}
      <div className="doc-so-working-area mt-0 max-w-full border-t border-border/60 pt-2">
        <div
          className="mb-2 flex flex-wrap gap-1 border-b border-border"
          role="tablist"
          aria-label={t("doc.so.tabPanelsAria")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "lines"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "lines"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("lines")}
          >
            <span className="inline-flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" aria-hidden />
              {t("doc.so.tabLines")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "execution"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "execution"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("execution")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              {t("doc.so.tabExecution")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "payments"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "payments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("payments")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {t("doc.so.tabPayments")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "events"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "events"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("events")}
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden />
              {t("doc.so.tabEventLog")}
            </span>
          </button>
        </div>
        {soWorkingTab === "execution" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--execution space-y-2">
            {!isNew ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {soFulfillment ? (
                  <section className="rounded-md border border-border/60 bg-transparent p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{t("doc.fulfillment.so.sectionTitle")}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-6 rounded-full px-2 text-[11px] font-semibold",
                          soFulfillment.hasOverFulfillment
                            ? "border-destructive/60 text-destructive"
                            : "border-border text-foreground",
                        )}
                      >
                        {translatePlanningFulfillmentState(t, soFulfillment.state)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("doc.columns.shipped")}</p>
                        <p className="tabular-nums text-sm font-semibold text-foreground">{soFulfillment.totalShipped}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("doc.columns.ordered")}</p>
                        <p className="tabular-nums text-sm font-semibold text-foreground">{soFulfillment.totalOrdered}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("doc.fulfillment.so.remainingLabel")}
                        </p>
                        <p
                          className={cn(
                            "tabular-nums text-sm font-semibold",
                            soFulfillment.totalRemaining < 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {soFulfillment.totalRemaining < 0
                            ? t("doc.fulfillment.remainingOver", { qty: soFulfillment.totalRemaining })
                            : soFulfillment.totalRemaining}
                        </p>
                      </div>
                      <div className="col-span-2 space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("doc.fulfillment.so.shipmentsPostedTotal", {
                            posted: soFulfillment.postedShipmentCount,
                            total: soFulfillment.relatedShipmentCount,
                          })}
                        </p>
                      </div>
                    </div>
                    {soFulfillment.hasOverFulfillment ? (
                      <p className="mt-2 text-xs font-medium text-destructive">{t("doc.fulfillment.so.overShipped")}</p>
                    ) : null}
                  </section>
                ) : null}
                {showSalesOrderAllocationUi && soAllocationView ? (
                  <section className="rounded-md border border-border/60 bg-transparent p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{t("doc.fulfillment.so.allocationSectionTitle")}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-6 rounded-full px-2 text-[11px] font-semibold",
                          soAllocationView.totalShortage > 0
                            ? "border-destructive/60 text-destructive"
                            : "border-border text-foreground",
                        )}
                      >
                        {translateSalesOrderAllocationState(t, soAllocationView.state)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("doc.columns.reserved")}</p>
                        <p className="tabular-nums text-sm font-semibold text-foreground">{soAllocationView.totalReserved}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("doc.columns.shortage")}</p>
                        <p
                          className={cn(
                            "tabular-nums text-sm font-semibold",
                            soAllocationView.totalShortage > 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {soAllocationView.totalShortage}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground/85">{t("doc.fulfillment.so.allocationShortageHint")}</p>
                  </section>
                ) : null}
              </div>
            ) : null}
            {isNew ? (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabSaveDocumentFirst")}</p>
            ) : null}
          </div>
        )}
        {soWorkingTab === "payments" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--payments">
            {isNew ? (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabSaveDocumentFirst")}</p>
            ) : doc ? (
              <SalesOrderFinanceSection
                salesOrderId={id!}
                cancelled={doc.status === "cancelled"}
                orderTotalAmount={isEditable ? totals.totalAmount : readonlyTotals.totalAmount}
                hasLines={isEditable ? form.lines.length > 0 : lines.length > 0}
              />
            ) : null}
          </div>
        )}
        {soWorkingTab === "events" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--events">
            {isNew ? (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabSaveDocumentFirst")}</p>
            ) : showDocumentEventLogSection && id ? (
              <DocumentEventLogSection entityType="sales_order" entityId={id} refresh={refresh} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabEventLogDisabled")}</p>
            )}
          </div>
        )}
        {soWorkingTab === "lines" && isEditable && (
          <div className="doc-lines mt-0">
            {isEditable && (
              <div className="flex items-end gap-2 w-full mb-1.5">
                <Card className="border-0 shadow-none flex-1 min-w-0">
                  <CardContent className="p-2 pb-0">
                    <div className="grid grid-cols-2 md:grid-cols-[minmax(200px,240px)_auto_auto_auto_minmax(160px,220px)_minmax(260px,1fr)] gap-x-2 gap-y-1 items-end w-max max-w-full">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-item" className="text-sm">
                        {t("doc.page.itemLabel")} <span className="text-destructive">*</span>
                      </Label>
                      <SalesOrderItemAutocomplete
                        ref={lineEntryItemPickerRef}
                        id="line-entry-item"
                        value={lineEntryItemId}
                        onChange={handleLineEntryItemChange}
                        items={itemRepository.list()}
                        placeholder={t("doc.page.searchItemPlaceholder")}
                        className="w-[240px]"
                        dropdownRightEdgeRef={lineEntryDropdownRightEdgeRef}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-qty" className="text-sm">
                        {t("doc.columns.qty")} <span className="text-destructive">*</span>
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
                      <Label htmlFor="line-entry-unit-price" className="text-sm">
                        {t("doc.columns.unitPrice")}
                      </Label>
                      <Input
                        id="line-entry-unit-price"
                        type="number"
                        min={0}
                        step={0.01}
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
                      <Label htmlFor="so-line-entry-zp-reason" className="text-sm">
                        {t("doc.page.zeroPriceReasonLabel")}
                        {roundMoney(lineEntryUnitPrice) === 0 ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <SelectField
                        id="so-line-entry-zp-reason"
                        value={lineEntryZeroPriceReason}
                        onChange={setLineEntryZeroPriceReason}
                        options={zeroPriceReasonOptions}
                        placeholder={
                          roundMoney(lineEntryUnitPrice) === 0
                            ? t("doc.cancelDialog.selectPlaceholder")
                            : t("domain.audit.summary.emDash")
                        }
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
                            title={t("doc.page.addLineTitle")}
                          >
                            <Plus className="h-4 w-4 shrink-0" aria-hidden />
                            {t("doc.page.addLine")}
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
                            title={t("doc.page.addLinesTitle")}
                          >
                            <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden />
                            {t("doc.page.addLines")}
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
                            {t("doc.page.updateLine")}
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
                            {t("doc.page.remove")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 shrink-0" aria-hidden />
                            {t("doc.page.cancelEdit")}
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="doc-lines__contextual-slot min-h-9 flex items-end">
                      {duplicateChoicePending && editingLineId === null ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs leading-tight">{t("doc.page.itemAlreadyExists")}</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8"
                              onClick={handleDuplicateIncreaseQty}
                            >
                              {t("doc.page.increaseQuantity")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={handleDuplicateCancel}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : selectedLineIds.length >= 2 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs leading-tight">
                            {t("doc.page.linesSelected", { count: selectedLineIds.length })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button type="button" variant="outline" size="sm" className="h-8" onClick={removeSelectedLines}>
                              {t("doc.page.removeSelectedLines")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            )}
<div className="doc-lines__grid doc-lines__grid--fixed-h h-[22rem] min-h-[22rem]">
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
              <div className="doc-lines__totals mt-1.5 flex gap-6 text-sm">
                <span>
                  {t("doc.page.totalQty")}: {totals.totalQty}
                </span>
                <span>
                  {t("doc.page.totalAmount")}: {totals.totalAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
        {soWorkingTab === "lines" && !isEditable && (
          <div className="doc-lines mt-0">
            {linesWithItem.length === 0 ? (
              <p className="doc-lines__empty">{t("doc.page.noLines")}</p>
            ) : (
              <>
                <div className="doc-lines__grid doc-lines__grid--fixed-h h-[22rem] min-h-[22rem]">
                  <AgGridContainer themeClass="doc-lines-grid">
                    <AgGridReact<LineWithItem>
                      {...agGridDefaultGridOptions}
                      rowData={linesWithItem}
                      columnDefs={readOnlyLinesColumnDefs}
                      defaultColDef={agGridDefaultColDef}
                      getRowId={(p) => p.data.id}
                    />
                  </AgGridContainer>
                </div>
                <div className="doc-lines__totals mt-1.5 flex gap-6 text-sm">
                  <span>
                    {t("doc.page.totalQty")}: {readonlyTotals.totalQty}
                  </span>
                  <span>
                    {t("doc.page.totalAmount")}: {readonlyTotals.totalAmount.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>

      <DocumentLineImportModal
        open={isLineImportModalOpen}
        initialTab={lineImportInitialTab}
        items={itemRepository.list()}
        getDefaultUnitPrice={(item) =>
          roundMoney(
            typeof item.salePrice === "number" &&
              Number.isFinite(item.salePrice) &&
              item.salePrice >= 0
              ? item.salePrice
              : 0,
          )
        }
        templateFileName="sales-order-lines-template.xlsx"
        templateDisplayLabel={t("doc.so.importTemplateLabel")}
        onOpenChange={setIsLineImportModalOpen}
        onApply={handleApplyImportedLines}
      />
      <CancelDocumentReasonDialog
        open={cancelReasonDialogOpen}
        onOpenChange={setCancelReasonDialogOpen}
        documentKindLabel={t("doc.kinds.salesOrder")}
        onConfirm={handleCancelDocumentConfirm}
      />
    </DocumentPageLayout>
  );
}
