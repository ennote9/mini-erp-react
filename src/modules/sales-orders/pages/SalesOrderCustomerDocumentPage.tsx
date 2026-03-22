import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "@/shared/i18n/context";
import type { AppLocaleId } from "@/shared/i18n/locales";
import { salesOrderRepository } from "../repository";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { carrierRepository } from "../../carriers/repository";
import { itemRepository } from "../../items/repository";
import {
  getCommercialMoneyDecimalPlaces,
  lineAmountMoney,
  roundMoney,
  sumPlanningDocumentLineAmounts,
} from "@/shared/commercialMoney";
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

function formatMoneyAmount(n: number): string {
  const dp = getCommercialMoneyDecimalPlaces();
  return roundMoney(n).toFixed(dp);
}

function planningStatusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case "draft":
      return t("status.planning.draft");
    case "confirmed":
      return t("status.planning.confirmed");
    case "closed":
      return t("status.planning.closed");
    case "cancelled":
      return t("status.planning.cancelled");
    default:
      return status;
  }
}

export function SalesOrderCustomerDocumentPage() {
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
    const doc = salesOrderRepository.getById(id);
    if (!doc) return null;
    const rawLines = salesOrderRepository.listLines(id);
    if (doc.status === "cancelled" || rawLines.length === 0) return { unavailable: true as const, doc };

    const customer = customerRepository.getById(doc.customerId);
    const warehouse = warehouseRepository.getById(doc.warehouseId);
    const cid = doc.carrierId?.trim() ?? "";
    let carrierLabel = emDash;
    if (cid !== "") {
      const c = carrierRepository.getById(cid);
      carrierLabel = c ? c.name : t("doc.shipment.unknownCarrier");
    }

    const lines = rawLines.map((line) => {
      const item = itemRepository.getById(line.itemId);
      const qty = typeof line.qty === "number" && Number.isFinite(line.qty) ? line.qty : 0;
      const unitPrice =
        typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice) && line.unitPrice >= 0
          ? roundMoney(line.unitPrice)
          : 0;
      const lineTotal = lineAmountMoney(qty, unitPrice);
      return {
        itemCode: item?.code ?? line.itemId,
        itemName: item?.name ?? line.itemId,
        qty,
        unitPrice,
        lineTotal,
      };
    });

    const grandTotal = sumPlanningDocumentLineAmounts(
      lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })),
    );

    return {
      unavailable: false as const,
      doc,
      customerName: customer?.name ?? doc.customerId,
      warehouseName: warehouse?.name ?? doc.warehouseId,
      carrierLabel,
      recipientName: doc.recipientName?.trim() ? doc.recipientName.trim() : emDash,
      recipientPhone: doc.recipientPhone?.trim() ? doc.recipientPhone.trim() : emDash,
      deliveryAddress: doc.deliveryAddress?.trim() ? doc.deliveryAddress.trim() : emDash,
      deliveryComment: doc.deliveryComment?.trim() ? doc.deliveryComment.trim() : emDash,
      documentComment: doc.comment?.trim() ? doc.comment.trim() : "",
      lines,
      grandTotal,
      statusDisplay: planningStatusLabel(t, doc.status),
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
        defaultFilename: `preliminary-customer-document-${snapshotDocNumber}.pdf`,
        filterName: t("doc.page.documentPdfFilterName"),
      });
      if (result) setDownloadSuccess(result);
    } catch (err) {
      console.error("Preliminary customer document PDF download failed", err);
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
      <div className="p-6 text-sm text-muted-foreground">{t("doc.notFound.salesOrder")}</div>
    );
  }

  if (!view) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("doc.notFound.salesOrder")}</div>
    );
  }

  if (view.unavailable) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">{t("doc.customerDocument.preliminaryUnavailable")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/sales-orders/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("doc.customerDocument.backToSalesOrder")}
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
          <Link to={`/sales-orders/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("doc.customerDocument.backToSalesOrder")}
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
          {t("doc.customerDocument.preliminaryTitle")}
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
        <p className="customer-doc__disclaimer mt-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm leading-snug text-foreground/90 print:border-black/20 print:bg-transparent print:text-black">
          {t("doc.customerDocument.preliminaryDisclaimer")}
        </p>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/65">
          {t("doc.customerDocument.sectionParties")}
        </h2>
        <div className="rounded-lg border border-border bg-muted/10 px-3.5 py-2 text-sm print:border-black/22 print:bg-white">
          <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.columns.customer")}</dt>
              <dd className="font-semibold leading-snug">{view.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.columns.warehouse")}</dt>
              <dd className="font-semibold leading-snug">{view.warehouseName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.shipment.recipientName")}</dt>
              <dd className="font-semibold leading-snug">{view.recipientName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.columns.phone")}</dt>
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
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground print:text-black/55">{t("doc.so.carrier")}</dt>
              <dd className="font-semibold leading-snug">{view.carrierLabel}</dd>
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
          {t("doc.customerDocument.sectionCommercial")}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border print:overflow-visible">
          <table className="customer-doc__table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="customer-doc__th">{t("doc.columns.itemCode")}</th>
                <th className="customer-doc__th">{t("doc.columns.itemName")}</th>
                <th className="customer-doc__th customer-doc__th--numeric">{t("doc.columns.qty")}</th>
                <th className="customer-doc__th customer-doc__th--numeric">{t("doc.columns.unitPrice")}</th>
                <th className="customer-doc__th customer-doc__th--numeric">{t("doc.columns.lineAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.map((row, idx) => (
                <tr key={`${row.itemCode}-${idx}`} className="customer-doc__tr">
                  <td className="customer-doc__td font-mono text-xs">{row.itemCode}</td>
                  <td className="customer-doc__td">{row.itemName}</td>
                  <td className="customer-doc__td customer-doc__td--numeric">{row.qty}</td>
                  <td className="customer-doc__td customer-doc__td--numeric">{formatMoneyAmount(row.unitPrice)}</td>
                  <td className="customer-doc__td customer-doc__td--numeric">{formatMoneyAmount(row.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end border-t border-border pt-2 text-sm print:border-black/20">
          <span className="font-semibold">
            {t("doc.page.totalAmount")}:{" "}
            <span className="tabular-nums">{formatMoneyAmount(view.grandTotal)}</span>
          </span>
        </div>
      </section>

      <footer className="customer-doc__meta text-sm text-muted-foreground print:text-black/55">
        <span className="font-medium text-foreground/80 print:text-black/70">{t("doc.customerDocument.printedAt")}</span>
        {": "}
        <span className="tabular-nums">{printedAt}</span>
        <span className="mx-2 print:hidden">·</span>
        <span className="block sm:inline print:block">
          {t("doc.customerDocument.preparedFromOrder", { number: doc.number })}
        </span>
      </footer>
      </div>
    </div>
  );
}
