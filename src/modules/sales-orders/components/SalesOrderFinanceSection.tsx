import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/shared/i18n/context";
import type { AppLocaleId } from "@/shared/i18n/locales";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { salesOrderPaymentRepository } from "../salesOrderPaymentRepository";
import {
  addSalesOrderPayment,
  deleteSalesOrderPayment,
  type PaymentServiceErrorCode,
} from "../salesOrderPaymentService";
import { deriveSalesOrderPaymentSummary } from "../salesOrderFinance";
import { CUSTOMER_PAYMENT_METHOD_CODES } from "../salesOrderPaymentModel";
import type { CustomerPaymentMethod } from "../salesOrderPaymentModel";
import { getCommercialMoneyDecimalPlaces, roundMoney } from "@/shared/commercialMoney";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { ExternalLink, Trash2 } from "lucide-react";

const ERROR_KEY: Record<PaymentServiceErrorCode, string> = {
  SO_NOT_FOUND: "finance.errors.soNotFound",
  SO_CANCELLED: "finance.errors.soCancelled",
  AMOUNT_INVALID: "finance.errors.amountInvalid",
  PAID_AT_REQUIRED: "finance.errors.paidAtRequired",
  PAID_AT_INVALID: "finance.errors.paidAtInvalid",
  PAYMENT_NOT_FOUND: "finance.errors.paymentNotFound",
  PAYMENT_WRONG_ORDER: "finance.errors.paymentWrongOrder",
  DELETE_FAILED: "finance.errors.deleteFailed",
};

function formatMoney(n: number): string {
  const dp = getCommercialMoneyDecimalPlaces();
  return roundMoney(n).toFixed(dp);
}

function defaultDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPaidAtDisplay(locale: AppLocaleId, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
}

export type SalesOrderFinanceSectionProps = {
  salesOrderId: string;
  cancelled: boolean;
  orderTotalAmount: number;
  hasLines: boolean;
};

export function SalesOrderFinanceSection(props: SalesOrderFinanceSectionProps) {
  const { salesOrderId, cancelled, orderTotalAmount, hasLines } = props;
  const { t, locale } = useTranslation();
  const revision = useAppReadModelRevision();

  const payments = useMemo(
    () => salesOrderPaymentRepository.listBySalesOrderId(salesOrderId),
    [salesOrderId, revision],
  );

  const summary = useMemo(
    () => deriveSalesOrderPaymentSummary(orderTotalAmount, payments),
    [orderTotalAmount, payments],
  );

  const [amountStr, setAmountStr] = useState("");
  const [paidAtLocal, setPaidAtLocal] = useState(defaultDatetimeLocal);
  const [method, setMethod] = useState<CustomerPaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const paymentStatusLabel = useMemo(() => {
    const key = `finance.paymentStatus.${summary.status}` as const;
    return t(key);
  }, [summary.status, t, locale]);

  const methodOptions = useMemo(
    () =>
      CUSTOMER_PAYMENT_METHOD_CODES.map((code) => ({
        value: code,
        label: t(`finance.paymentMethod.${code}`),
      })),
    [t, locale],
  );

  const canOpenInvoice = !cancelled && hasLines;
  const canMutatePayments = !cancelled && hasLines;
  const showAmountsAndPayments = hasLines || payments.length > 0;
  const invoiceTo = `/sales-orders/${salesOrderId}/customer-invoice`;

  const handleAddPayment = useCallback(() => {
    setFormError(null);
    const raw = amountStr.replace(",", ".").trim();
    const amount = Number(raw);
    const result = addSalesOrderPayment(salesOrderId, {
      amount,
      paidAt: paidAtLocal,
      method,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    if (!result.success) {
      setFormError(t(ERROR_KEY[result.code]));
      return;
    }
    setAmountStr("");
    setPaidAtLocal(defaultDatetimeLocal());
    setReference("");
    setComment("");
  }, [amountStr, paidAtLocal, method, reference, comment, salesOrderId, t]);

  const handleDelete = useCallback(
    (paymentId: string) => {
      setFormError(null);
      if (!window.confirm(t("finance.deletePaymentConfirm"))) return;
      const result = deleteSalesOrderPayment(paymentId, salesOrderId);
      if (!result.success) {
        setFormError(t(ERROR_KEY[result.code]));
      }
    },
    [salesOrderId, t],
  );

  return (
    <Card className="max-w-4xl border-border/80 shadow-none">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">{t("finance.sectionTitle")}</CardTitle>
        <CardDescription className="text-xs leading-snug">{t("finance.sectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {canOpenInvoice ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={invoiceTo}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t("finance.openCustomerInvoice")}
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled>
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t("finance.openCustomerInvoice")}
            </Button>
          )}
        </div>

        {!hasLines && payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(cancelled ? "finance.invoiceUnavailable" : "finance.invoiceNeedsLines")}
          </p>
        ) : null}
        {cancelled && hasLines ? (
          <p className="text-sm text-muted-foreground">{t("finance.readOnlyCancelled")}</p>
        ) : null}

        {showAmountsAndPayments ? (
          <>
            <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-muted-foreground">{t("common.status")}: </span>
                  <span className="font-medium">{paymentStatusLabel}</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-muted-foreground">{t("finance.orderTotal")}: </span>
                  {formatMoney(summary.totalAmount)}
                </span>
                <span className="tabular-nums">
                  <span className="text-muted-foreground">{t("finance.paidTotal")}: </span>
                  {formatMoney(summary.paidAmount)}
                </span>
                <span className="tabular-nums">
                  <span className="text-muted-foreground">{t("finance.remaining")}: </span>
                  {formatMoney(summary.remainingAmount)}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("finance.paymentHistory")}
              </h4>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("finance.noPayments")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-1.5 font-medium">{t("finance.paidAt")}</th>
                        <th className="px-2 py-1.5 font-medium">{t("finance.amount")}</th>
                        <th className="px-2 py-1.5 font-medium">{t("finance.method")}</th>
                        <th className="px-2 py-1.5 font-medium">{t("finance.reference")}</th>
                        <th className="px-2 py-1.5 font-medium">{t("finance.comment")}</th>
                        {canMutatePayments ? <th className="px-2 py-1.5 w-10" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-border/80 last:border-0">
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                            {formatPaidAtDisplay(locale, p.paidAt)}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums">{formatMoney(p.amount)}</td>
                          <td className="px-2 py-1.5">{t(`finance.paymentMethod.${p.method}`)}</td>
                          <td className="px-2 py-1.5 max-w-[10rem] truncate" title={p.reference ?? ""}>
                            {p.reference ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 max-w-[12rem] truncate" title={p.comment ?? ""}>
                            {p.comment ?? "—"}
                          </td>
                          <td className="px-1 py-1">
                            {canMutatePayments ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title={t("finance.deletePayment")}
                                aria-label={t("finance.deletePayment")}
                                onClick={() => handleDelete(p.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {canMutatePayments ? (
            <div className="rounded-md border border-dashed border-border/80 p-3 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("finance.addPayment")}
              </h4>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="so-pay-amount" className="text-xs">
                    {t("finance.amount")}
                  </Label>
                  <Input
                    id="so-pay-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="h-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="so-pay-at" className="text-xs">
                    {t("finance.paidAt")}
                  </Label>
                  <Input
                    id="so-pay-at"
                    type="datetime-local"
                    value={paidAtLocal}
                    onChange={(e) => setPaidAtLocal(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="so-pay-method" className="text-xs">
                    {t("finance.method")}
                  </Label>
                  <SelectField
                    id="so-pay-method"
                    value={method}
                    onChange={(v) => setMethod(v as CustomerPaymentMethod)}
                    options={methodOptions}
                    placeholder={t("common.select")}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <Label htmlFor="so-pay-ref" className="text-xs">
                    {t("finance.reference")}
                  </Label>
                  <Input
                    id="so-pay-ref"
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="h-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <Label htmlFor="so-pay-comment" className="text-xs">
                    {t("finance.comment")}
                  </Label>
                  <Textarea
                    id="so-pay-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="min-h-[2.5rem] resize-y text-sm"
                  />
                </div>
              </div>
              <Button type="button" size="sm" onClick={handleAddPayment}>
                {t("finance.addPayment")}
              </Button>
            </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
