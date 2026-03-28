import { useCallback, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { useTranslation } from "@/shared/i18n/context";
import type { AppLocaleId } from "@/shared/i18n/locales";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { purchaseOrderPaymentRepository } from "../purchaseOrderPaymentRepository";
import {
  addPurchaseOrderPayment,
  deletePurchaseOrderPayment,
  type PurchaseOrderPaymentServiceErrorCode,
} from "../purchaseOrderPaymentService";
import { derivePurchaseOrderPaymentSummary } from "../purchaseOrderFinance";
import {
  SUPPLIER_PAYMENT_METHOD_CODES,
  type SupplierPaymentMethod,
} from "../purchaseOrderPaymentModel";
import { getCommercialMoneyDecimalPlaces, roundMoney } from "@/shared/commercialMoney";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ERROR_KEY: Record<PurchaseOrderPaymentServiceErrorCode, string> = {
  PO_NOT_FOUND: "doc.po.payments.errors.poNotFound",
  PO_CANCELLED: "doc.po.payments.errors.poCancelled",
  AMOUNT_INVALID: "finance.errors.amountInvalid",
  PAID_AT_REQUIRED: "finance.errors.paidAtRequired",
  PAID_AT_INVALID: "finance.errors.paidAtInvalid",
  PAYMENT_NOT_FOUND: "doc.po.payments.errors.paymentNotFound",
  PAYMENT_WRONG_ORDER: "doc.po.payments.errors.paymentWrongOrder",
  DELETE_FAILED: "finance.errors.deleteFailed",
};

function formatMoney(n: number): string {
  return roundMoney(n).toFixed(getCommercialMoneyDecimalPlaces());
}

function defaultDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function formatPaidAtDisplay(locale: AppLocaleId, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
}

export type PurchaseOrderFinanceSectionProps = {
  purchaseOrderId: string;
  cancelled: boolean;
  orderTotalAmount: number;
  hasLines: boolean;
};

export function PurchaseOrderFinanceSection(props: PurchaseOrderFinanceSectionProps) {
  const { purchaseOrderId, cancelled, orderTotalAmount, hasLines } = props;
  const { t, locale } = useTranslation();
  const revision = useAppReadModelRevision();

  const payments = useMemo(
    () => purchaseOrderPaymentRepository.listByPurchaseOrderId(purchaseOrderId),
    [purchaseOrderId, revision],
  );

  const summary = useMemo(
    () => derivePurchaseOrderPaymentSummary(orderTotalAmount, payments),
    [orderTotalAmount, payments],
  );

  const [amountStr, setAmountStr] = useState("");
  const [paidAtLocal, setPaidAtLocal] = useState(defaultDatetimeLocal);
  const [method, setMethod] = useState<SupplierPaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  const paymentStatusLabel = useMemo(
    () => t(`finance.paymentStatus.${summary.status}` as const),
    [summary.status, t, locale],
  );

  const methodOptions = useMemo(
    () =>
      SUPPLIER_PAYMENT_METHOD_CODES.map((code) => ({
        value: code,
        label: t(`finance.paymentMethod.${code}`),
      })),
    [t, locale],
  );

  const canMutatePayments = !cancelled && hasLines;

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
    const result = addPurchaseOrderPayment(purchaseOrderId, {
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
  }, [amountStr, paidAtLocal, method, reference, comment, purchaseOrderId, resetPaymentForm, t]);

  const handleDelete = useCallback(
    (paymentId: string) => {
      setFormError(null);
      if (!window.confirm(t("finance.deletePaymentConfirm"))) return;
      const result = deletePurchaseOrderPayment(paymentId, purchaseOrderId);
      if (!result.success) {
        setFormError(t(ERROR_KEY[result.code]));
      }
    },
    [purchaseOrderId, t],
  );

  return (
    <Card className="max-w-4xl border-0 bg-transparent shadow-none">
      <CardContent className="space-y-4 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{t("doc.po.payments.sectionTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("doc.po.payments.sectionHint")}</p>
          </div>
          {canMutatePayments ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={openRecordPaymentDialog}>
              {t("finance.addPayment")}
            </Button>
          ) : null}
        </div>

        {!hasLines ? (
          <p className="text-sm text-muted-foreground">{t("doc.po.payments.noLinesHint")}</p>
        ) : null}
        {cancelled && hasLines ? (
          <p className="text-sm text-muted-foreground">{t("doc.po.payments.readOnlyCancelled")}</p>
        ) : null}

        {hasLines ? (
          <>
            <div className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-muted-foreground">{t("finance.paymentStatusLabel")}: </span>
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
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-border/80 last:border-0">
                          <td className="px-1 py-px tabular-nums whitespace-nowrap align-middle">
                            {formatPaidAtDisplay(locale, payment.paidAt)}
                          </td>
                          <td className="px-1 py-px tabular-nums align-middle">
                            {formatMoney(payment.amount)}
                          </td>
                          <td className="px-1 py-px align-middle">
                            {t(`finance.paymentMethod.${payment.method}`)}
                          </td>
                          <td
                            className="max-w-[10rem] truncate px-1 py-px align-middle"
                            title={payment.reference ?? ""}
                          >
                            {payment.reference ?? "—"}
                          </td>
                          <td
                            className="max-w-[12rem] truncate px-1 py-px align-middle"
                            title={payment.comment ?? ""}
                          >
                            {payment.comment ?? "—"}
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
                                onClick={() => handleDelete(payment.id)}
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
              {t("doc.po.payments.modalHint")}
            </Dialog.Description>
            <div className="mt-4 space-y-3">
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="po-pay-amount" className="text-xs">
                    {t("finance.amount")}
                  </Label>
                  <Input
                    id="po-pay-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="h-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="po-pay-at" className="text-xs">
                    {t("finance.paidAt")}
                  </Label>
                  <Input
                    id="po-pay-at"
                    type="datetime-local"
                    value={paidAtLocal}
                    onChange={(e) => setPaidAtLocal(e.target.value)}
                    className="h-8 text-sm [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="po-pay-method" className="text-xs">
                    {t("finance.method")}
                  </Label>
                  <SelectField
                    id="po-pay-method"
                    value={method}
                    onChange={(value) => setMethod(value as SupplierPaymentMethod)}
                    options={methodOptions}
                    placeholder={t("common.select")}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="po-pay-ref" className="text-xs">
                    {t("finance.reference")}
                  </Label>
                  <Input
                    id="po-pay-ref"
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="h-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="po-pay-comment" className="text-xs">
                    {t("finance.comment")}
                  </Label>
                  <Textarea
                    id="po-pay-comment"
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
