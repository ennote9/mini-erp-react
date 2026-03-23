import { useParams } from "react-router-dom";
import { useMemo, useState, useCallback, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { shipmentRepository } from "../repository";
import {
  post,
  cancelDocument,
  reverseDocument,
  validateShipmentFull,
  updateShipmentDraftLogistics,
} from "../service";
import { carrierRepository } from "../../carriers/repository";
import { buildCarrierTrackingUrl, translateCarrierType } from "../../carriers";
import { salesOrderRepository } from "../../sales-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { ShipmentLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import {
  actionIssueFromServiceMessage,
  hasErrors,
  hasWarnings,
  type Issue,
} from "../../../shared/issues";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridSelectionColumnDef,
} from "../../../shared/ui/ag-grid/agGridDefaults";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildLinesXlsxBuffer, buildDocumentXlsxBuffer, type ShipmentExportLineRow, type ShipmentDocumentSummary } from "../shipmentExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { factualDocumentIssuesForStrip } from "../../../shared/factualDocumentPageIssues";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import type { TFunction } from "@/shared/i18n/resolve";
import { shipmentExcelExportLabels } from "@/shared/i18n/excelPlanningExportLabels";
import { translateCancelReason, translateReversalReason } from "@/shared/i18n/reasonLabels";
import {
  CancelDocumentReasonDialog,
  type CancelDocumentReasonPayload,
} from "../../../shared/ui/object/CancelDocumentReasonDialog";
import {
  ReverseDocumentReasonDialog,
  type ReverseDocumentReasonPayload,
} from "../../../shared/ui/object/ReverseDocumentReasonDialog";
import { DocumentEventLogSection } from "../../../shared/ui/object/DocumentEventLogSection";
import { DocumentPrintActionsMenu } from "../../../shared/ui/object/DocumentPrintActionsMenu";
import { useSettings } from "../../../shared/settings/SettingsContext";
import { getEffectiveWorkspaceFeatureEnabled } from "../../../shared/workspace";
import {
  type CancelDocumentReasonCode,
  type ReversalDocumentReasonCode,
} from "../../../shared/reasonCodes";

type LineWithItem = ShipmentLine & { itemName: string; uom: string };

function shipmentLinesColumnDefs(t: TFunction): ColDef<LineWithItem>[] {
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
    { field: "qty", headerName: t("doc.columns.qty"), width: 100 },
    { field: "uom", headerName: t("doc.columns.uom"), width: 80 },
  ];
}

function buildExportRowsFromLinesWithItem(lines: LineWithItem[]): ShipmentExportLineRow[] {
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
      uom: line.uom ?? item?.uom ?? "\u2014",
    };
  });
}

export function ShipmentPage() {
  const { t, locale } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const workspaceMode = settings.general.workspaceMode;
  const profileOverrides = settings.general.profileOverrides;
  const showReverseDocument = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    profileOverrides,
    "documentReversePosted",
  );
  const showDocumentEventLogSection =
    getEffectiveWorkspaceFeatureEnabled(workspaceMode, profileOverrides, "documentEventLog") &&
    settings.documents.showDocumentEventLog;
  const [refresh, setRefresh] = useState(0);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [cancelReasonDialogOpen, setCancelReasonDialogOpen] = useState(false);
  const [reverseReasonDialogOpen, setReverseReasonDialogOpen] = useState(false);
  const [draftCarrierId, setDraftCarrierId] = useState("");
  const [draftTracking, setDraftTracking] = useState("");
  const [draftRecipientName, setDraftRecipientName] = useState("");
  const [draftRecipientPhone, setDraftRecipientPhone] = useState("");
  const [draftDeliveryAddress, setDraftDeliveryAddress] = useState("");
  const [draftDeliveryComment, setDraftDeliveryComment] = useState("");
  const [logisticsIssues, setLogisticsIssues] = useState<Issue[]>([]);
  const doc = useMemo(
    () => (id ? shipmentRepository.getById(id) : undefined),
    [id, refresh],
  );
  const lines = useMemo(
    () => (id ? shipmentRepository.listLines(id) : []),
    [id, refresh],
  );

  const canOpenFinalCustomerDocument = useMemo(
    () => Boolean(id && doc?.status === "posted"),
    [id, doc?.status],
  );

  const shipmentPrintMenuItems = useMemo(() => {
    if (!id) return [];
    const rows: { to: string; label: string }[] = [
      { to: `/shipments/${id}/delivery-sheet`, label: t("doc.shipment.deliverySheetOpen") },
    ];
    if (canOpenFinalCustomerDocument) {
      rows.push({ to: `/shipments/${id}/customer-document`, label: t("doc.customerDocument.finalTitle") });
    }
    return rows;
  }, [id, canOpenFinalCustomerDocument, t, locale]);

  useEffect(() => {
    if (!id || !doc) return;
    setDraftCarrierId(doc.carrierId ?? "");
    setDraftTracking(doc.trackingNumber ?? "");
    setDraftRecipientName(doc.recipientName ?? "");
    setDraftRecipientPhone(doc.recipientPhone ?? "");
    setDraftDeliveryAddress(doc.deliveryAddress ?? "");
    setDraftDeliveryComment(doc.deliveryComment ?? "");
    setLogisticsIssues([]);
  }, [
    id,
    doc?.id,
    doc?.carrierId,
    doc?.trackingNumber,
    doc?.recipientName,
    doc?.recipientPhone,
    doc?.deliveryAddress,
    doc?.deliveryComment,
    refresh,
  ]);
  const salesOrderNumber = useMemo(
    () =>
      doc
        ? salesOrderRepository.getById(doc.salesOrderId)?.number ??
          doc.salesOrderId
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
  const emDash = t("domain.audit.summary.emDash");

  const linesWithItem = useMemo<LineWithItem[]>(() => {
    return lines.map((line) => {
      const item = itemRepository.getById(line.itemId);
      return {
        ...line,
        itemName: item?.name ?? line.itemId,
        uom: item?.uom ?? emDash,
      };
    });
  }, [lines, emDash]);

  const linesColumnDefs = useMemo(() => shipmentLinesColumnDefs(t), [t, locale]);

  const isDraft = doc?.status === "draft";
  const isPosted = doc?.status === "posted";
  const isReversed = doc?.status === "reversed";

  const carrierSelectOptions = useMemo(() => {
    const all = carrierRepository.list();
    const active = all
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const currentId = doc?.carrierId;
    if (!currentId) return active;
    const current = all.find((c) => c.id === currentId);
    if (current && !current.isActive && !active.some((c) => c.id === currentId)) {
      return [current, ...active];
    }
    return active;
  }, [doc?.carrierId, refresh]);

  const carrierSummaryLabel = useMemo(() => {
    if (!doc?.carrierId) return emDash;
    const c = carrierRepository.getById(doc.carrierId);
    if (!c) return t("doc.shipment.unknownCarrier");
    const inactive = !c.isActive ? ` (${t("doc.shipment.inactiveCarrierTag")})` : "";
    return `${c.name}${inactive}`;
  }, [doc?.carrierId, emDash, t, locale]);

  const trackingSummaryDisplay = useMemo(() => {
    const v = doc?.trackingNumber?.trim();
    return v ? v : emDash;
  }, [doc?.trackingNumber, emDash]);

  const recipientNameSummaryDisplay = useMemo(() => {
    const v = doc?.recipientName?.trim();
    return v ? v : emDash;
  }, [doc?.recipientName, emDash]);

  const recipientPhoneSummaryDisplay = useMemo(() => {
    const v = doc?.recipientPhone?.trim();
    return v ? v : emDash;
  }, [doc?.recipientPhone, emDash]);

  const deliveryAddressSummaryDisplay = useMemo(() => {
    const v = doc?.deliveryAddress?.trim();
    return v ? v : emDash;
  }, [doc?.deliveryAddress, emDash]);

  const deliveryCommentSummaryDisplay = useMemo(() => {
    const v = doc?.deliveryComment?.trim();
    return v ? v : emDash;
  }, [doc?.deliveryComment, emDash]);

  const trackingUrlReadOnly = useMemo(() => {
    if (!doc || doc.status === "draft") return null;
    const c = doc.carrierId ? carrierRepository.getById(doc.carrierId) : undefined;
    return buildCarrierTrackingUrl(c?.trackingUrlTemplate, doc.trackingNumber);
  }, [doc?.id, doc?.status, doc?.carrierId, doc?.trackingNumber, refresh]);

  const logisticsDirty =
    !!doc &&
    isDraft &&
    (draftCarrierId !== (doc.carrierId ?? "") ||
      draftTracking !== (doc.trackingNumber ?? "") ||
      draftRecipientName !== (doc.recipientName ?? "") ||
      draftRecipientPhone !== (doc.recipientPhone ?? "") ||
      draftDeliveryAddress !== (doc.deliveryAddress ?? "") ||
      draftDeliveryComment !== (doc.deliveryComment ?? ""));

  const onLinesSelectionChanged = useCallback((e: SelectionChangedEvent<LineWithItem>) => {
    const ids = e.api.getSelectedRows().map((r) => r.id);
    setSelectedLineIds(ids);
  }, []);

  const shipmentNumberForFile = doc?.number ?? "shipment";

  const getExportRowsAll = useCallback((): ShipmentExportLineRow[] => {
    return buildExportRowsFromLinesWithItem(linesWithItem);
  }, [linesWithItem]);

  const getExportRowsSelected = useCallback((): ShipmentExportLineRow[] => {
    if (selectedLineIds.length === 0) return [];
    const set = new Set(selectedLineIds);
    const filtered = linesWithItem.filter((l) => set.has(l.id));
    return buildExportRowsFromLinesWithItem(filtered);
  }, [selectedLineIds, linesWithItem]);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension });
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

  const shipmentExcelLabels = useMemo(() => shipmentExcelExportLabels(t), [t, locale]);

  const handleExportMain = useCallback(() => {
    const rows = getExportRowsAll();
    const carrierForExport = doc!.carrierId
      ? carrierRepository.getById(doc!.carrierId)
      : undefined;
    const tr = doc!.trackingNumber?.trim() ?? "";
    const summary: ShipmentDocumentSummary = {
      number: doc!.number,
      date: doc!.date,
      salesOrder: salesOrderNumber,
      warehouse: warehouseName,
      carrier:
        carrierForExport?.name ??
        (doc!.carrierId ? t("doc.shipment.unknownCarrier") : ""),
      trackingNumber: tr,
      recipientName: doc!.recipientName?.trim() ?? "",
      recipientPhone: doc!.recipientPhone?.trim() ?? "",
      deliveryAddress: doc!.deliveryAddress?.trim() ?? "",
      deliveryComment: doc!.deliveryComment?.trim() ?? "",
      comment: doc!.comment ?? "",
    };
    runExportWithSaveAs(`${shipmentNumberForFile}_document.xlsx`, () =>
      buildDocumentXlsxBuffer(summary, rows, shipmentExcelLabels),
    );
  }, [
    doc,
    salesOrderNumber,
    warehouseName,
    shipmentNumberForFile,
    getExportRowsAll,
    runExportWithSaveAs,
    shipmentExcelLabels,
    t,
  ]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${shipmentNumberForFile}_selected-lines.xlsx`, () =>
      buildLinesXlsxBuffer(rows, shipmentExcelLabels),
    );
  }, [getExportRowsSelected, shipmentNumberForFile, runExportWithSaveAs, shipmentExcelLabels]);

  const handleExportAll = useCallback(() => {
    const rows = getExportRowsAll();
    if (rows.length === 0) return;
    runExportWithSaveAs(`${shipmentNumberForFile}_all-lines.xlsx`, () =>
      buildLinesXlsxBuffer(rows, shipmentExcelLabels),
    );
  }, [getExportRowsAll, shipmentNumberForFile, runExportWithSaveAs, shipmentExcelLabels]);

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
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
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
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const issuesForStrip = useMemo(
    () => factualDocumentIssuesForStrip(actionIssues, isDraft, id, validateShipmentFull),
    [actionIssues, isDraft, id, refresh],
  );

  const hasDocumentIssues = hasErrors(issuesForStrip) || hasWarnings(issuesForStrip);
  const postBlockedByValidation =
    isDraft &&
    settings.documents.blockPostWhenFactualHasBlockingErrors &&
    hasErrors(issuesForStrip);

  if (!id || !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("doc.notFound.shipment")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("shell.sales"), to: "/sales-orders" },
    { label: t("shell.nav.shipments"), to: "/shipments" },
    { label: doc.number },
  ];

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/shipments" aria-label={t("doc.shipment.backToListAria")} />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{t("doc.shipment.titleNumbered", { number: doc.number })}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <div className="doc-header__right">
            {hasDocumentIssues && <DocumentIssueStrip issues={issuesForStrip} />}
            <div className="doc-header__actions">
              {isDraft && (
                <Button
                  type="button"
                  onClick={handlePost}
                  disabled={postBlockedByValidation}
                  title={
                    postBlockedByValidation
                      ? t("doc.factual.resolveBeforePost")
                      : undefined
                  }
                >
                  {t("doc.factual.post")}
                </Button>
              )}
              {isDraft && (
                <Button type="button" variant="outline" onClick={handleCancelDocument}>
                  {t("doc.page.cancelDocument")}
                </Button>
              )}
              {isPosted && showReverseDocument && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActionIssues([]);
                    setReverseReasonDialogOpen(true);
                  }}
                >
                  {t("doc.factual.reverseDocument")}
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
          <CardTitle className="text-[0.9rem] font-semibold">{t("doc.page.details")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <dl className="doc-summary doc-summary--compact">
            <div className="doc-summary__row">
              <dt className="doc-summary__term">{t("doc.columns.number")}</dt>
              <dd className="doc-summary__value">{doc.number}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">{t("doc.columns.date")}</dt>
              <dd className="doc-summary__value">{doc.date}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">{t("doc.shipment.relatedSalesOrder")}</dt>
              <dd className="doc-summary__value">{salesOrderNumber}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">{t("doc.columns.warehouse")}</dt>
              <dd className="doc-summary__value">{warehouseName}</dd>
            </div>
            {isDraft ? (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.carrier")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <select
                      className={cn(
                        "flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                      )}
                      value={draftCarrierId}
                      onChange={(e) => {
                        setDraftCarrierId(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      aria-label={t("doc.shipment.carrier")}
                    >
                      <option value="">{t("doc.shipment.carrierNotSet")}</option>
                      {carrierSelectOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {translateCarrierType(t, c.carrierType)}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.trackingNumber")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <Input
                      className="max-w-md"
                      value={draftTracking}
                      onChange={(e) => {
                        setDraftTracking(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      placeholder={t("doc.shipment.trackingPlaceholder")}
                      autoComplete="off"
                      aria-label={t("doc.shipment.trackingNumber")}
                    />
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.recipientName")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <Label htmlFor="shipment-recipient-name" className="sr-only">
                      {t("doc.shipment.recipientName")}
                    </Label>
                    <Input
                      id="shipment-recipient-name"
                      className="max-w-md"
                      value={draftRecipientName}
                      onChange={(e) => {
                        setDraftRecipientName(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      placeholder={t("doc.shipment.recipientNamePlaceholder")}
                      autoComplete="name"
                      aria-label={t("doc.shipment.recipientName")}
                    />
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.recipientPhone")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <Label htmlFor="shipment-recipient-phone" className="sr-only">
                      {t("doc.shipment.recipientPhone")}
                    </Label>
                    <Input
                      id="shipment-recipient-phone"
                      className="max-w-md"
                      type="tel"
                      value={draftRecipientPhone}
                      onChange={(e) => {
                        setDraftRecipientPhone(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      placeholder={t("doc.shipment.recipientPhonePlaceholder")}
                      autoComplete="tel"
                      aria-label={t("doc.shipment.recipientPhone")}
                    />
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.deliveryAddress")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <Label htmlFor="shipment-delivery-address" className="sr-only">
                      {t("doc.shipment.deliveryAddress")}
                    </Label>
                    <Textarea
                      id="shipment-delivery-address"
                      className="max-w-md min-h-[4rem] resize-y text-sm"
                      value={draftDeliveryAddress}
                      onChange={(e) => {
                        setDraftDeliveryAddress(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      placeholder={t("doc.shipment.deliveryAddressPlaceholder")}
                      rows={2}
                      aria-label={t("doc.shipment.deliveryAddress")}
                    />
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.deliveryComment")}</dt>
                  <dd className="doc-summary__value min-w-0">
                    <Label htmlFor="shipment-delivery-comment" className="sr-only">
                      {t("doc.shipment.deliveryComment")}
                    </Label>
                    <Textarea
                      id="shipment-delivery-comment"
                      className="max-w-md min-h-[4rem] resize-y text-sm"
                      value={draftDeliveryComment}
                      onChange={(e) => {
                        setDraftDeliveryComment(e.target.value);
                        setLogisticsIssues([]);
                      }}
                      placeholder={t("doc.shipment.deliveryCommentPlaceholder")}
                      rows={2}
                      aria-label={t("doc.shipment.deliveryComment")}
                    />
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.carrier")}</dt>
                  <dd className="doc-summary__value">{carrierSummaryLabel}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.trackingNumber")}</dt>
                  <dd className="doc-summary__value flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{trackingSummaryDisplay}</span>
                    {trackingUrlReadOnly ? (
                      <a
                        href={trackingUrlReadOnly}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline shrink-0"
                      >
                        {t("doc.shipment.openTracking")}
                      </a>
                    ) : null}
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.recipientName")}</dt>
                  <dd className="doc-summary__value">{recipientNameSummaryDisplay}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.recipientPhone")}</dt>
                  <dd className="doc-summary__value">{recipientPhoneSummaryDisplay}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.deliveryAddress")}</dt>
                  <dd className="doc-summary__value whitespace-pre-wrap break-words">
                    {deliveryAddressSummaryDisplay}
                  </dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.shipment.deliveryComment")}</dt>
                  <dd className="doc-summary__value whitespace-pre-wrap break-words">
                    {deliveryCommentSummaryDisplay}
                  </dd>
                </div>
              </>
            )}
            {isDraft && logisticsIssues.length > 0 ? (
              <div className="pt-2 not-prose">
                <DocumentIssueStrip issues={logisticsIssues} />
              </div>
            ) : null}
            {isDraft ? (
              <div className="flex justify-end pt-3 mt-1 border-t border-border/50">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!logisticsDirty}
                  onClick={() => {
                    if (!id) return;
                    const result = updateShipmentDraftLogistics(id, {
                      carrierId: draftCarrierId,
                      trackingNumber: draftTracking,
                      recipientName: draftRecipientName,
                      recipientPhone: draftRecipientPhone,
                      deliveryAddress: draftDeliveryAddress,
                      deliveryComment: draftDeliveryComment,
                    });
                    if (result.success) {
                      setLogisticsIssues([]);
                      setRefresh((r) => r + 1);
                    } else {
                      setLogisticsIssues([actionIssueFromServiceMessage(result.error)]);
                    }
                  }}
                >
                  {t("doc.shipment.saveLogistics")}
                </Button>
              </div>
            ) : null}
            {doc.comment != null && doc.comment !== "" && (
              <div className="doc-summary__row">
                <dt className="doc-summary__term">{t("doc.columns.comment")}</dt>
                <dd className="doc-summary__value">{doc.comment}</dd>
              </div>
            )}
            {doc.status === "cancelled" && doc.cancelReasonCode != null && doc.cancelReasonCode !== "" && (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.summary.cancelReason")}</dt>
                  <dd className="doc-summary__value">
                    {translateCancelReason(t, doc.cancelReasonCode as CancelDocumentReasonCode)}
                  </dd>
                </div>
                {doc.cancelReasonComment != null && doc.cancelReasonComment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">{t("doc.summary.cancelComment")}</dt>
                    <dd className="doc-summary__value">{doc.cancelReasonComment}</dd>
                  </div>
                )}
              </>
            )}
            {isReversed && doc.reversalReasonCode != null && (
              <>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">{t("doc.summary.reversalReason")}</dt>
                  <dd className="doc-summary__value">
                    {translateReversalReason(t, doc.reversalReasonCode as ReversalDocumentReasonCode)}
                  </dd>
                </div>
                {doc.reversalReasonComment != null && doc.reversalReasonComment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">{t("doc.summary.reversalComment")}</dt>
                    <dd className="doc-summary__value">{doc.reversalReasonComment}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>
      <div className="doc-lines mt-6">
        <h3 className="doc-lines__title">{t("doc.page.lines")}</h3>
        <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full mb-1.5">
          <DocumentPrintActionsMenu
            items={shipmentPrintMenuItems}
            triggerLabel={t("doc.page.print")}
            aria-label={t("doc.page.printMenuAria")}
          />
          {exportSuccess && (
            <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
              <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
              <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
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
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
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
                className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                title={t("doc.list.dismiss")}
                aria-label={t("doc.list.dismiss")}
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
                    title={exportSelectedDisabled ? t("doc.list.exportSelectLinesFirst") : undefined}
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
        </div>
        {linesWithItem.length === 0 ? (
          <p className="doc-lines__empty">{t("doc.shipment.emptyLines")}</p>
        ) : (
          <div className="doc-lines__grid">
            <AgGridContainer themeClass="doc-lines-grid">
              <AgGridReact<LineWithItem>
                {...agGridDefaultGridOptions}
                rowData={linesWithItem}
                columnDefs={linesColumnDefs}
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
      {id && showDocumentEventLogSection ? (
        <DocumentEventLogSection entityType="shipment" entityId={id} refresh={refresh} />
      ) : null}
      <CancelDocumentReasonDialog
        open={cancelReasonDialogOpen}
        onOpenChange={setCancelReasonDialogOpen}
        documentKindLabel={t("doc.kinds.shipment")}
        onConfirm={handleCancelDocumentConfirm}
      />
      <ReverseDocumentReasonDialog
        open={reverseReasonDialogOpen}
        onOpenChange={setReverseReasonDialogOpen}
        documentKindLabel={t("doc.kinds.shipment")}
        onConfirm={handleReverseDocumentConfirm}
      />
    </DocumentPageLayout>
  );
}
