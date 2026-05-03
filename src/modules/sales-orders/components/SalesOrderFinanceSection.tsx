import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "radix-ui";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { salesOrderPaymentRepository } from "../salesOrderPaymentRepository";
import {
  addSalesOrderPayment,
  deleteSalesOrderPayment,
  type PaymentServiceErrorCode,
} from "../salesOrderPaymentService";
import {
  deriveSalesOrderPaymentSummary,
  deriveSalesOrderPlannedProfitSummary,
  type SalesOrderPlannedProfitLineInput,
} from "../salesOrderFinance";
import { CUSTOMER_PAYMENT_METHOD_CODES } from "../salesOrderPaymentModel";
import type { CustomerPaymentMethod } from "../salesOrderPaymentModel";
import { getCommercialMoneyDecimalPlaces, roundMoney } from "@/shared/commercialMoney";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

function defaultDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Compact finance metrics: label stays near value on wide panels (capped width). */
const FINANCE_METRICS_DL = "w-full max-w-md space-y-1.5 text-sm";
const FINANCE_METRIC_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 [&_dt]:text-muted-foreground";

export type SalesOrderFinanceSectionProps = {
  salesOrderId: string;
  cancelled: boolean;
  orderTotalAmount: number;
  hasLines: boolean;
  /** YYYY-MM-DD — effective purchase prices for planned cost. */
  orderDateYmd: string;
  /** Lines used for planned profit (same basis as commercial revenue). */
  plannedProfitLines: ReadonlyArray<SalesOrderPlannedProfitLineInput>;
};

export function SalesOrderFinanceSection(props: SalesOrderFinanceSectionProps) {
  const { salesOrderId, cancelled, orderTotalAmount, hasLines, orderDateYmd, plannedProfitLines } = props;
  const { t, locale } = useTranslation();
  const { formatDateTime, formatMoney, formatNumber } = useAppDisplayFormatters();
  const moneyFractionDigits = getCommercialMoneyDecimalPlaces();
  const revision = useAppReadModelRevision();

  const payments = useMemo(
    () => salesOrderPaymentRepository.listBySalesOrderId(salesOrderId),
    [salesOrderId, revision],
  );

  const summary = useMemo(
    () => deriveSalesOrderPaymentSummary(orderTotalAmount, payments),
    [orderTotalAmount, payments],
  );

  const plannedProfit = useMemo(
    () => deriveSalesOrderPlannedProfitSummary(plannedProfitLines, orderDateYmd),
    [plannedProfitLines, orderDateYmd],
  );

  const plannedMarginLabel = useMemo(() => {
    if (plannedProfit.marginPercent === null) return "—";
    return `${formatNumber(plannedProfit.marginPercent, { minFractionDigits: 1, maxFractionDigits: 2 })}%`;
  }, [plannedProfit.marginPercent, formatNumber]);

  const plannedGrossProfitNegative = plannedProfit.plannedGrossProfit < 0;
  const plannedMarginNegative =
    plannedProfit.marginPercent !== null && plannedProfit.marginPercent < 0;

  const [amountStr, setAmountStr] = useState("");
  const [paidAtLocal, setPaidAtLocal] = useState(defaultDatetimeLocal);
  const [method, setMethod] = useState<CustomerPaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

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

  const resetPaymentForm = useCallback(() => {
    setAmountStr("");
    setPaidAtLocal(defaultDatetimeLocal());
    setMethod("bank_transfer");
    setReference("");
    setComment("");
    setFormError(null);
  }, []);

  const openRecordPaymentDialog = useCallback(() => {
    resetPaymentForm();
    setRecordPaymentOpen(true);
  }, [resetPaymentForm]);

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
    resetPaymentForm();
    setRecordPaymentOpen(false);
  }, [amountStr, paidAtLocal, method, reference, comment, salesOrderId, t, resetPaymentForm]);

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
    <Card className="w-full max-w-none border-0 bg-transparent shadow-none">
      <CardContent className="w-full p-2">
        <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
          <section
            className="min-w-0 w-full space-y-4 rounded-md border border-border p-3"
            aria-labelledby="so-finance-payment-section-title"
          >
            <h4
              id="so-finance-payment-section-title"
              className="mb-0 text-xs font-semibold uppercase tracking-wide leading-none text-muted-foreground"
            >
              {t("finance.paymentSectionTitle")}
            </h4>
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
              {canMutatePayments ? (
                <Button type="button" size="sm" className="gap-1.5" onClick={openRecordPaymentDialog}>
                  {t("finance.addPayment")}
                </Button>
              ) : null}
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
                <div className="rounded-sm bg-muted/25 px-3 py-2">
                  <dl className={FINANCE_METRICS_DL}>
                    <div className={FINANCE_METRIC_ROW}>
                      <dt>{t("common.status")}</dt>
                      <dd className="text-right font-medium">{paymentStatusLabel}</dd>
                    </div>
                    <div className={FINANCE_METRIC_ROW}>
                      <dt>{t("finance.orderTotal")}</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {formatMoney(roundMoney(summary.totalAmount), moneyFractionDigits)}
                      </dd>
                    </div>
                    <div className={FINANCE_METRIC_ROW}>
                      <dt>{t("finance.paidTotal")}</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {formatMoney(roundMoney(summary.paidAmount), moneyFractionDigits)}
                      </dd>
                    </div>
                    <div className={cn(FINANCE_METRIC_ROW, "[&_dt]:font-medium [&_dt]:text-foreground")}>
                      <dt>{t("finance.remaining")}</dt>
                      <dd className="text-right font-semibold tabular-nums text-foreground">
                        {formatMoney(roundMoney(summary.remainingAmount), moneyFractionDigits)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide leading-none text-muted-foreground">
                    {t("finance.paymentHistory")}
                  </h4>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("finance.noPayments")}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full border-collapse text-sm leading-tight">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="px-1 py-1 font-medium">{t("finance.paidAt")}</th>
                            <th className="px-1 py-1 font-medium">{t("finance.amount")}</th>
                            <th className="px-1 py-1 font-medium">{t("finance.method")}</th>
                            <th className="px-1 py-1 font-medium">{t("finance.reference")}</th>
                            <th className="px-1 py-1 font-medium">{t("finance.comment")}</th>
                            {canMutatePayments ? <th className="w-8 px-0 py-1" /> : null}
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {payments.map((p) => (
                            <tr key={p.id} className="border-b border-border/80 last:border-0">
                              <td className="px-1 py-px tabular-nums whitespace-nowrap align-middle">
                                {formatDateTime(p.paidAt)}
                              </td>
                              <td className="px-1 py-px tabular-nums align-middle">
                                {formatMoney(roundMoney(p.amount), moneyFractionDigits)}
                              </td>
                              <td className="px-1 py-px align-middle">{t(`finance.paymentMethod.${p.method}`)}</td>
                              <td className="max-w-[10rem] truncate px-1 py-px align-middle" title={p.reference ?? ""}>
                                {p.reference ?? "—"}
                              </td>
                              <td className="max-w-[12rem] truncate px-1 py-px align-middle" title={p.comment ?? ""}>
                                {p.comment ?? "—"}
                              </td>
                              <td className="p-0 align-middle">
                                {canMutatePayments ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    title={t("finance.deletePayment")}
                                    aria-label={t("finance.deletePayment")}
                                    onClick={() => handleDelete(p.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
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
              </>
            ) : null}
          </section>

          <section
            className="min-w-0 w-full space-y-3 rounded-md border border-border p-3"
            aria-labelledby="so-finance-planned-profit-section-title"
          >
            <h4
              id="so-finance-planned-profit-section-title"
              className="mb-0 text-xs font-semibold uppercase tracking-wide leading-none text-muted-foreground"
            >
              {t("finance.plannedProfitSectionTitle")}
            </h4>
            <div className="rounded-sm bg-muted/25 px-3 py-2">
              <dl className={FINANCE_METRICS_DL}>
                <div className={FINANCE_METRIC_ROW}>
                  <dt>{t("finance.revenue")}</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatMoney(roundMoney(plannedProfit.revenue), moneyFractionDigits)}
                  </dd>
                </div>
                <div className={FINANCE_METRIC_ROW}>
                  <dt>{t("finance.plannedCost")}</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatMoney(roundMoney(plannedProfit.plannedCost), moneyFractionDigits)}
                  </dd>
                </div>
                <div
                  className={cn(
                    FINANCE_METRIC_ROW,
                    "border-t border-border/60 pt-2.5 mt-0.5",
                  )}
                >
                  <dt>{t("finance.plannedGrossProfit")}</dt>
                  <dd
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      plannedGrossProfitNegative ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatMoney(roundMoney(plannedProfit.plannedGrossProfit), moneyFractionDigits)}
                  </dd>
                </div>
                <div className={FINANCE_METRIC_ROW}>
                  <dt>{t("finance.plannedMargin")}</dt>
                  <dd
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      plannedProfit.marginPercent === null
                        ? "text-foreground"
                        : plannedMarginNegative
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {plannedMarginLabel}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{t("finance.plannedProfitHint")}</p>
            {plannedProfit.missingCostLineCount > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500/90 leading-snug">
                {t("finance.plannedProfitMissingCostWarning", {
                  count: String(plannedProfit.missingCostLineCount),
                })}
              </p>
            ) : null}
          </section>
        </div>
      </CardContent>
      <Dialog.Root
        open={recordPaymentOpen}
        onOpenChange={(open) => {
          setRecordPaymentOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <Dialog.Title className="text-base font-semibold text-foreground">
              {t("finance.addPayment")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {t("finance.sectionHint")}
            </Dialog.Description>
            <div className="mt-4 space-y-3">
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
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
                <div className="flex flex-col gap-1">
                  <Label htmlFor="so-pay-at" className="text-xs">
                    {t("finance.paidAt")}
                  </Label>
                  <Input
                    id="so-pay-at"
                    type="datetime-local"
                    value={paidAtLocal}
                    onChange={(e) => setPaidAtLocal(e.target.value)}
                    className="h-8 text-sm [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
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
                <div className="flex flex-col gap-1 sm:col-span-2">
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
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="so-pay-comment" className="text-xs">
                    {t("finance.comment")}
                  </Label>
                  <Textarea
                    id="so-pay-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="min-h-[3rem] resize-y text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRecordPaymentOpen(false);
                    setFormError(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="button" onClick={handleAddPayment}>
                  {t("finance.addPayment")}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
