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
import { Printer, ArrowLeft, Download } from "lucide-react";
import { PdfRasterExportBlockedError } from "@/shared/document/renderElementToPdf";
import { savePrintableDocumentPdf } from "@/shared/document/savePrintableDocumentPdf";
import { PdfWriteFailedError } from "@/shared/document/savePdfFile";
import {
  DocumentExportSuccessStrip,
  type DocumentExportSuccessState,
} from "@/shared/ui/object/DocumentExportSuccessStrip";
import "@/shared/print/customerDocumentPrint.css";

function formatHandoffDateTime(locale: AppLocaleId, d: Date): string {
  const tag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
}

function factualStatusLabel(t: (key: string) => string, status: string): string {
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

export function ShipmentCustomerDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const emDash = t("domain.audit.summary.emDash");
  const [printTime, setPrintTime] = useState(() => new Date());
  const downloadRootRef = useRef<HTMLDivElement>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<DocumentExportSuccessState | null>(null);

  useEffect(() => {
    document.body.classList.add("customer-document-print-context");
    return () => {
      document.body.classList.remove("customer-document-print-context");
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
    if (doc.status !== "posted") return { unavailable: true as const, doc };

    const so = salesOrderRepository.getById(doc.salesOrderId);
    const customer = so ? customerRepository.getById(so.customerId) : undefined;
    const warehouse = warehouseRepository.getById(doc.warehouseId);
    const cid = doc.carrierId?.trim() ?? "";
    let carrierLabel = emDash;
    if (cid !== "") {
      const c = carrierRepository.getById(cid);
      carrierLabel = c ? c.name : t("doc.shipment.unknownCarrier");
    }

    const tn = doc.trackingNumber?.trim() ?? "";
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

    return {
      unavailable: false as const,
      doc,
      salesOrderNumber: so?.number ?? doc.salesOrderId,
      customerName: customer?.name ?? (so ? so.customerId : emDash),
      warehouseName: warehouse?.name ?? doc.warehouseId,
      carrierLabel,
      tracking: tn !== "" ? tn : emDash,
      recipientName: doc.recipientName?.trim() ? doc.recipientName.trim() : emDash,
      recipientPhone: doc.recipientPhone?.trim() ? doc.recipientPhone.trim() : emDash,
      deliveryAddress: doc.deliveryAddress?.trim() ? doc.deliveryAddress.trim() : emDash,
      deliveryComment: doc.deliveryComment?.trim() ? doc.deliveryComment.trim() : emDash,
      documentComment: doc.comment?.trim() ? doc.comment.trim() : "",
      lines,
      statusDisplay: factualStatusLabel(t, doc.status),
    };
  }, [id, emDash, t, locale]);

  const snapshotDocNumber = view?.doc.number ?? "document";

  const handlePrint = useCallback(() => {
    setPrintTime(new Date());
    requestAnimationFrame(() => window.print());
  }, []);

  const handleDownload = useCallback(async () => {
    const root = downloadRootRef.current;
    if (!root) return;
    try {
      const result = await savePrintableDocumentPdf({
        root,
        defaultFilename: `final-customer-document-${snapshotDocNumber}.pdf`,
        filterName: t("doc.page.documentPdfFilterName"),
      });
      if (result) setDownloadSuccess(result);
    } catch (err) {
      console.error("Final customer document PDF download failed", err);
      if (err instanceof PdfWriteFailedError) {
        window.alert(t("doc.page.documentPdfSaveFailed"));
      } else if (err instanceof PdfRasterExportBlockedError) {
        window.alert(t("doc.page.documentPdfSecurityBlocked"));
      } else {
        window.alert(t("doc.page.documentPdfGenerationFailed"));
      }
    }
  }, [snapshotDocNumber, t]);

  if (!id) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("doc.notFound.shipment")}</div>
    );
  }

  if (!view) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("doc.notFound.shipment")}</div>
    );
  }

  if (view.unavailable) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">{t("doc.customerDocument.finalUnavailable")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/shipments/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("doc.customerDocument.backToShipment")}
          </Link>
        </Button>
      </div>
    );
  }

  const { doc } = view;
  const printedAt = formatHandoffDateTime(locale, printTime);

  return (
    <div className="customer-doc mx-auto w-full max-w-5xl px-5 py-6 text-foreground sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="customer-doc__toolbar mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to={`/shipments/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("doc.customerDocument.backToShipment")}
          </Link>
        </Button>
        <DocumentExportSuccessStrip
          success={downloadSuccess}
          onDismiss={() => setDownloadSuccess(null)}
        />
        <Button type="button" size="sm" className="gap-1.5" onClick={handlePrint}>
          <Printer className="h-4 w-4" aria-hidden />
          {t("doc.customerDocument.print")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
          <Download className="h-4 w-4" aria-hidden />
          {t("doc.page.download")}
        </Button>
      </div>

      <div ref={downloadRootRef} className="customer-doc__download-snapshot w-full">
      <header className="mb-5 border-b-2 border-border pb-4 print:border-black/30">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground print:text-black/60">
          {t("doc.customerDocument.finalTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight print:text-[20pt] print:text-black">{doc.number}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground print:text-black/70">
          <span>
            <span className="font-medium text-foreground/85 print:text-black">{t("doc.columns.date")}:</span>{" "}
            <span className="tabular-nums">{doc.date}</span>
          </span>
          <span>
            <span className="font-medium text-foreground/85 print:text-black">{t("doc.columns.status")}:</span>{" "}
            {view.statusDisplay}
          </span>
        </div>
        <p className="mt-4 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm leading-snug text-muted-foreground print:border-black/20 print:bg-transparent print:text-black/75">
          {t("doc.customerDocument.finalOperationalNote")}
        </p>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.customerDocument.sectionReferences")}
        </h2>
        <div className="rounded-lg border border-border bg-muted/10 px-3.5 py-2 text-sm print:border-black/22 print:bg-white">
          <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.relatedSalesOrder")}</dt>
              <dd className="font-semibold leading-snug">{view.salesOrderNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.columns.customer")}</dt>
              <dd className="font-semibold leading-snug">{view.customerName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.columns.warehouse")}</dt>
              <dd className="font-semibold leading-snug">{view.warehouseName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.so.carrier")}</dt>
              <dd className="font-semibold leading-snug">{view.carrierLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.trackingNumber")}</dt>
              <dd className="font-mono text-sm font-semibold break-all">{view.tracking}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.customerDocument.sectionDelivery")}
        </h2>
        <div className="rounded-lg border border-border bg-muted/10 px-3.5 py-2 text-sm print:border-black/22 print:bg-white">
          <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.recipientName")}</dt>
              <dd className="font-semibold leading-snug">{view.recipientName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.recipientPhone")}</dt>
              <dd className="font-mono text-sm font-semibold">{view.recipientPhone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.deliveryAddress")}</dt>
              <dd className="whitespace-pre-wrap font-semibold leading-snug">{view.deliveryAddress}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.deliveryComment")}</dt>
              <dd className="whitespace-pre-wrap font-semibold leading-snug">{view.deliveryComment}</dd>
            </div>
          </dl>
        </div>
      </section>

      {view.documentComment ? (
        <section className="mb-5 text-sm">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
            {t("doc.columns.comment")}
          </h2>
          <p className="whitespace-pre-wrap rounded-md border border-dashed border-border px-3 py-2 text-foreground/90 print:border-black/25 print:text-black">
            {view.documentComment}
          </p>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.customerDocument.sectionShippedLines")}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border print:overflow-visible">
          <table className="customer-doc__table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="customer-doc__th">{t("doc.columns.itemCode")}</th>
                <th className="customer-doc__th">{t("doc.columns.itemName")}</th>
                <th className="customer-doc__th customer-doc__th--numeric">{t("doc.columns.qty")}</th>
                <th className="customer-doc__th">{t("doc.columns.uom")}</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="customer-doc__td py-4 text-center text-muted-foreground">
                    {t("doc.shipment.emptyLines")}
                  </td>
                </tr>
              ) : (
                view.lines.map((row, idx) => (
                  <tr key={`${row.itemCode}-${idx}`} className="customer-doc__tr">
                    <td className="customer-doc__td font-mono text-xs">
                      {row.itemCode}
                      {row.markdownCode ? (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.markdownCode}</div>
                      ) : null}
                    </td>
                    <td className="customer-doc__td">{row.itemName}</td>
                    <td className="customer-doc__td customer-doc__td--numeric">{row.qty}</td>
                    <td className="customer-doc__td text-muted-foreground print:text-black/75">{row.uom}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="customer-doc__meta text-sm text-muted-foreground print:text-black/55">
        <span className="font-medium text-foreground/80 print:text-black/70">{t("doc.customerDocument.printedAt")}</span>
        {": "}
        <span className="tabular-nums">{printedAt}</span>
        <span className="mx-2 print:hidden">·</span>
        <span className="block sm:inline print:block">
          {t("doc.customerDocument.preparedFromShipment", { number: doc.number })}
        </span>
      </footer>
      </div>
    </div>
  );
}
