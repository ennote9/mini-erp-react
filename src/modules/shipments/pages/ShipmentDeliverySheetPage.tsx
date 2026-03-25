import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "@/shared/i18n/context";
import type { AppLocaleId } from "@/shared/i18n/locales";
import { shipmentRepository } from "../repository";
import { salesOrderRepository } from "../../sales-orders/repository";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { carrierRepository } from "../../carriers/repository";
import { itemRepository } from "../../items/repository";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Copy, Check, Download } from "lucide-react";
import { PdfRasterExportBlockedError } from "@/shared/document/renderElementToPdf";
import { savePrintableDocumentPdf } from "@/shared/document/savePrintableDocumentPdf";
import { PdfWriteFailedError } from "@/shared/document/savePdfFile";
import {
  DocumentExportSuccessStrip,
  type DocumentExportSuccessState,
} from "@/shared/ui/object/DocumentExportSuccessStrip";
import "../shipmentDeliverySheetPrint.css";

function formatHandoffDateTime(locale: AppLocaleId, d: Date): string {
  const tag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(
  t: (key: string) => string,
  status: string,
): string {
  switch (status) {
    case "draft":
      return t("status.factual.draft");
    case "posted":
      return t("status.factual.posted");
    case "reversed":
      return t("status.factual.reversed");
    case "cancelled":
      return t("status.factual.cancelled");
    default:
      return status;
  }
}

type CopyFieldId = "tracking" | "address" | "phone";

export function ShipmentDeliverySheetPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const emDash = t("domain.audit.summary.emDash");
  const [printTime, setPrintTime] = useState(() => new Date());
  const [copiedField, setCopiedField] = useState<CopyFieldId | null>(null);
  const downloadRootRef = useRef<HTMLDivElement>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<DocumentExportSuccessState | null>(null);

  useEffect(() => {
    document.body.classList.add("shipment-delivery-sheet-print-context");
    return () => {
      document.body.classList.remove("shipment-delivery-sheet-print-context");
    };
  }, []);

  useEffect(() => {
    const stamp = () => setPrintTime(new Date());
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  const view = useMemo(() => {
    if (!id) return null;
    const doc = shipmentRepository.getById(id);
    if (!doc) return null;
    const so = salesOrderRepository.getById(doc.salesOrderId);
    const customer = so ? customerRepository.getById(so.customerId) : undefined;
    const warehouse = warehouseRepository.getById(doc.warehouseId);
    const cid = doc.carrierId?.trim() ?? "";
    let carrierLabel = emDash;
    if (cid !== "") {
      const c = carrierRepository.getById(cid);
      if (!c) {
        carrierLabel = t("doc.shipment.unknownCarrier");
      } else {
        const inactive = !c.isActive ? ` (${t("doc.shipment.inactiveCarrierTag")})` : "";
        carrierLabel = `${c.name}${inactive}`;
      }
    }

    const lines = shipmentRepository.listLines(id).map((line) => {
      const item = itemRepository.getById(line.itemId);
      return {
        itemCode: item?.code ?? line.itemId,
        itemName: item?.name ?? line.itemId,
        qty: line.qty,
        uom: item?.uom?.trim() ? item.uom : emDash,
        markdownCode: line.markdownCode,
      };
    });

    const tn = doc.trackingNumber?.trim() ?? "";
    const addr = doc.deliveryAddress?.trim() ?? "";
    const phone = doc.recipientPhone?.trim() ?? "";

    return {
      doc,
      salesOrderNumber: so?.number ?? doc.salesOrderId,
      customerName: customer?.name ?? (so ? so.customerId : emDash),
      warehouseName: warehouse?.name ?? doc.warehouseId,
      carrierLabel,
      tracking: tn !== "" ? tn : emDash,
      trackingCopy: tn !== "" ? tn : null,
      recipientName: doc.recipientName?.trim() ? doc.recipientName.trim() : emDash,
      recipientPhone: phone !== "" ? phone : emDash,
      phoneCopy: phone !== "" ? phone : null,
      deliveryAddress: addr !== "" ? addr : emDash,
      addressCopy: addr !== "" ? addr : null,
      deliveryComment: doc.deliveryComment?.trim() ? doc.deliveryComment.trim() : emDash,
      documentComment: doc.comment?.trim() ? doc.comment.trim() : "",
      lines,
      statusDisplay: statusLabel(t, doc.status),
    };
  }, [id, emDash, t, locale]);

  const handlePrint = useCallback(() => {
    setPrintTime(new Date());
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  const snapshotDocNumber = view?.doc.number ?? "shipment";

  const handleDownload = useCallback(async () => {
    const root = downloadRootRef.current;
    if (!root) return;
    try {
      const result = await savePrintableDocumentPdf({
        root,
        defaultFilename: `delivery-sheet-${snapshotDocNumber}.pdf`,
        filterName: t("doc.page.documentPdfFilterName"),
      });
      if (result) setDownloadSuccess(result);
    } catch (err) {
      console.error("Delivery sheet PDF download failed", err);
      if (err instanceof PdfWriteFailedError) {
        window.alert(t("doc.page.documentPdfSaveFailed"));
      } else if (err instanceof PdfRasterExportBlockedError) {
        window.alert(t("doc.page.documentPdfSecurityBlocked"));
      } else {
        window.alert(t("doc.page.documentPdfGenerationFailed"));
      }
    }
  }, [snapshotDocNumber, t]);

  const copyToClipboard = useCallback(
    async (text: string, field: CopyFieldId) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        window.setTimeout(() => setCopiedField(null), 2000);
      } catch {
        setCopiedField(null);
      }
    },
    [],
  );

  if (!id) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("doc.notFound.shipment")}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("doc.notFound.shipment")}
      </div>
    );
  }

  const { doc } = view;
  const printedAt = formatHandoffDateTime(locale, printTime);

  return (
    <div className="delivery-sheet mx-auto w-full max-w-5xl px-5 py-6 text-foreground sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="delivery-sheet__toolbar mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to={`/shipments/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("doc.shipment.deliverySheetBack")}
          </Link>
        </Button>
        <DocumentExportSuccessStrip
          success={downloadSuccess}
          onDismiss={() => setDownloadSuccess(null)}
        />
        <Button type="button" size="sm" className="gap-1.5" onClick={handlePrint}>
          <Printer className="h-4 w-4" aria-hidden />
          {t("doc.shipment.deliverySheetPrint")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
          <Download className="h-4 w-4" aria-hidden />
          {t("doc.page.download")}
        </Button>
      </div>

      <div ref={downloadRootRef} className="delivery-sheet__download-snapshot w-full">
      <header className="delivery-sheet__header mb-6 border-b-2 border-border pb-5 print:border-black/30 print:pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1">
            <p className="delivery-sheet__kind text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90 print:text-black/58">
              {t("doc.shipment.deliverySheetKind")}
            </p>
            <div className="mt-2 border-l-2 border-primary/55 pl-3 print:border-black/35 print:pl-2.5">
              <h1 className="text-4xl font-bold tracking-tight text-foreground print:text-[22pt] print:text-black">
                {doc.number}
              </h1>
            </div>
            <p className="delivery-sheet__brand mt-3 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70 print:text-black/45">
              {t("app.name")}
            </p>
          </div>
          <div className="delivery-sheet__header-meta min-w-[11.5rem] shrink-0 rounded-md border border-border bg-muted/15 px-3.5 py-2 text-sm shadow-sm print:min-w-0 print:border-black/35 print:bg-white print:shadow-none">
            <div className="flex flex-col gap-1">
              <div>
                <div className="delivery-sheet__doc-label text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground print:text-black/55">
                  {t("doc.columns.date")}
                </div>
                <div className="mt-0.5 text-base font-bold tabular-nums text-foreground print:text-[11pt] print:text-black">
                  {doc.date}
                </div>
              </div>
              <div className="border-t border-border/60 pt-1 print:border-black/18">
                <div className="delivery-sheet__doc-label text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground print:text-black/55">
                  {t("doc.columns.status")}
                </div>
                <div className="mt-0.5 text-base font-bold text-foreground print:text-[11pt] print:text-black">
                  {view.statusDisplay}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="delivery-sheet__section delivery-sheet__section--references mb-6">
        <h2 className="delivery-sheet__section-title mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.shipment.deliverySheetSectionReferences")}
        </h2>
        <div className="rounded-lg border border-border bg-muted/12 px-3.5 py-2 print:border-black/22 print:bg-white">
          <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
                {t("doc.shipment.relatedSalesOrder")}
              </dt>
              <dd className="mt-px font-semibold leading-snug">{view.salesOrderNumber}</dd>
            </div>
            <div className="min-w-0">
              <dt className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
                {t("doc.columns.customer")}
              </dt>
              <dd className="mt-px font-semibold leading-snug">{view.customerName}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
                {t("doc.columns.warehouse")}
              </dt>
              <dd className="mt-px font-semibold leading-snug">{view.warehouseName}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="delivery-sheet__section delivery-sheet__section--delivery mb-6">
        <h2 className="delivery-sheet__section-title mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.shipment.deliverySheetSectionDelivery")}
        </h2>
        <div className="delivery-sheet__delivery-panel space-y-0 rounded-lg border border-border bg-muted/12 px-3.5 py-2 print:border-black/22 print:bg-white">
          <div className="delivery-sheet__field">
            <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
              {t("doc.shipment.carrier")}
            </div>
            <div className="mt-px text-sm font-semibold leading-snug">{view.carrierLabel}</div>
          </div>
          <div className="delivery-sheet__field border-t border-border/60 pt-1.5 print:border-black/12">
            <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
              {t("doc.shipment.trackingNumber")}
            </div>
            <div className="mt-px flex items-start gap-2">
              <span className="delivery-sheet__tracking-value min-w-0 flex-1 break-words font-mono text-sm font-semibold leading-snug">
                {view.tracking}
              </span>
              {view.trackingCopy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="print:hidden h-8 w-8 shrink-0 text-muted-foreground"
                  data-document-export-skip
                  aria-label={
                    copiedField === "tracking"
                      ? t("doc.shipment.deliverySheetCopied")
                      : t("doc.shipment.deliverySheetCopyTracking")
                  }
                  onClick={() => copyToClipboard(view.trackingCopy!, "tracking")}
                >
                  {copiedField === "tracking" ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-1.5 border-t border-border/60 pt-1.5 sm:grid-cols-2 print:border-black/12">
            <div className="delivery-sheet__field min-w-0">
              <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
                {t("doc.shipment.recipientName")}
              </div>
              <div className="mt-px text-sm font-semibold leading-snug">{view.recipientName}</div>
            </div>
            <div className="delivery-sheet__field min-w-0">
              <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
                {t("doc.shipment.recipientPhone")}
              </div>
              <div className="mt-px flex items-start gap-2">
                <span className="min-w-0 flex-1 font-mono text-sm font-semibold leading-snug">
                  {view.recipientPhone}
                </span>
                {view.phoneCopy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="print:hidden h-8 w-8 shrink-0 text-muted-foreground"
                  data-document-export-skip
                  aria-label={
                    copiedField === "phone"
                        ? t("doc.shipment.deliverySheetCopied")
                        : t("doc.shipment.deliverySheetCopyPhone")
                    }
                    onClick={() => copyToClipboard(view.phoneCopy!, "phone")}
                  >
                    {copiedField === "phone" ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="delivery-sheet__field border-t border-border/60 pt-1.5 print:border-black/12">
            <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
              {t("doc.shipment.deliveryAddress")}
            </div>
            <div className="mt-1 flex items-start gap-2">
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed">
                {view.deliveryAddress}
              </span>
              {view.addressCopy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="print:hidden h-8 w-8 shrink-0 text-muted-foreground"
                  data-document-export-skip
                  aria-label={
                    copiedField === "address"
                      ? t("doc.shipment.deliverySheetCopied")
                      : t("doc.shipment.deliverySheetCopyAddress")
                  }
                  onClick={() => copyToClipboard(view.addressCopy!, "address")}
                >
                  {copiedField === "address" ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </Button>
                ) : null}
            </div>
          </div>
          <div className="delivery-sheet__field border-t border-border/60 pt-1.5 print:border-black/12">
            <div className="delivery-sheet__field-label text-xs font-medium text-muted-foreground print:text-black/58">
              {t("doc.shipment.deliveryComment")}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed">
              {view.deliveryComment}
            </div>
          </div>
        </div>
      </section>

      {view.documentComment ? (
        <section className="delivery-sheet__section delivery-sheet__section--notes mb-6 text-sm">
          <h2 className="delivery-sheet__section-title mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
            {t("doc.columns.comment")}
          </h2>
          <div className="rounded-lg border border-border border-dashed bg-muted/10 px-4 py-2.5 print:border-black/22 print:bg-white">
            <p className="whitespace-pre-wrap leading-snug text-foreground/90 print:text-black">
              {view.documentComment}
            </p>
          </div>
        </section>
      ) : null}

      <section className="delivery-sheet__lines-section mb-8">
        <h2 className="delivery-sheet__section-title mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.shipment.deliverySheetSectionLines")}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border print:overflow-visible print:rounded-none">
          <table className="delivery-sheet__table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="delivery-sheet__th">{t("doc.columns.itemCode")}</th>
                <th className="delivery-sheet__th">{t("doc.columns.itemName")}</th>
                <th className="delivery-sheet__th delivery-sheet__th--numeric">
                  {t("doc.columns.qty")}
                </th>
                <th className="delivery-sheet__th delivery-sheet__th--uom">{t("doc.columns.uom")}</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="border-t border-border px-3 py-5 text-center text-muted-foreground print:border-black/15"
                  >
                    {t("doc.shipment.emptyLines")}
                  </td>
                </tr>
              ) : (
                view.lines.map((row, idx) => (
                  <tr key={`${row.itemCode}-${idx}`} className="delivery-sheet__tr">
                    <td className="delivery-sheet__td delivery-sheet__td--code font-mono text-xs">
                      {row.itemCode}
                      {row.markdownCode ? (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.markdownCode}</div>
                      ) : null}
                    </td>
                    <td className="delivery-sheet__td delivery-sheet__td--name">{row.itemName}</td>
                    <td className="delivery-sheet__td delivery-sheet__td--qty tabular-nums">
                      {row.qty}
                    </td>
                    <td className="delivery-sheet__td delivery-sheet__td--uom text-muted-foreground print:text-black/70">
                      {row.uom}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="delivery-sheet__meta mt-2 border-t border-border pt-3 text-sm text-muted-foreground print:border-black/25 print:text-black/55">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
          <span>
            <span className="font-medium text-foreground/80 print:text-black/75">
              {t("doc.shipment.deliverySheetPrintedAt")}
            </span>
            {": "}
            <span className="tabular-nums">{printedAt}</span>
          </span>
          <span className="hidden sm:inline print:hidden" aria-hidden>
            ·
          </span>
          <span>
            {t("doc.shipment.deliverySheetPreparedFrom", { number: doc.number })}
          </span>
        </div>
      </footer>
      </div>
    </div>
  );
}
