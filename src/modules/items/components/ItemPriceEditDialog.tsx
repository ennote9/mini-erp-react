import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import type { ItemPriceReasonCode, ItemPriceType } from "../model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/shared/i18n/context";
import { compareYmd, todayYmdLocal } from "../lib/itemPriceHistory";

const REASONS: ItemPriceReasonCode[] = [
  "manual_update",
  "supplier_change",
  "commercial_review",
  "correction",
  "other",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, price type is fixed (from toolbar button). */
  fixedPriceType?: ItemPriceType;
  onSubmit: (data: {
    priceType: ItemPriceType;
    amount: number;
    validFromYmd: string;
    reasonCode: ItemPriceReasonCode;
    comment?: string;
  }) => void;
  busy?: boolean;
};

export function ItemPriceEditDialog({
  open,
  onOpenChange,
  fixedPriceType,
  onSubmit,
  busy,
}: Props) {
  const { t } = useTranslation();
  const [priceType, setPriceType] = useState<ItemPriceType>(fixedPriceType ?? "purchase");
  const [amountStr, setAmountStr] = useState("");
  const [validFrom, setValidFrom] = useState(() => todayYmdLocal());
  const [reasonCode, setReasonCode] = useState<ItemPriceReasonCode>("manual_update");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (fixedPriceType) setPriceType(fixedPriceType);
    setValidFrom(todayYmdLocal());
    setAmountStr("");
    setReasonCode("manual_update");
    setComment("");
  }, [open, fixedPriceType]);

  const today = todayYmdLocal();
  const isFuture = useMemo(() => compareYmd(validFrom, today) > 0, [validFrom, today]);

  const hint = isFuture ? t("master.item.prices.hintScheduled") : t("master.item.prices.hintEffectiveToday");

  const handleSubmit = () => {
    setError(null);
    const trimmed = amountStr.trim();
    if (trimmed === "") {
      setError(t("master.item.prices.validationAmountRequired"));
      return;
    }
    const amount = Number(trimmed);
    if (Number.isNaN(amount) || amount < 0) {
      setError(t("master.item.prices.validationNegative"));
      return;
    }
    if (compareYmd(validFrom, today) < 0) {
      setError(t("master.item.prices.validationPastDate"));
      return;
    }
    if (!reasonCode) {
      setError(t("master.item.prices.validationReason"));
      return;
    }
    onSubmit({
      priceType: fixedPriceType ?? priceType,
      amount,
      validFromYmd: validFrom,
      reasonCode,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[131] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-3 shadow-lg outline-none"
          onPointerDownOutside={(e) => busy && e.preventDefault()}
        >
          <Dialog.Title className="text-sm font-semibold text-foreground">{t("master.item.prices.dialogTitle")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("master.item.prices.dialogTitle")}</Dialog.Description>
          <div className="mt-2 space-y-2">
            {!fixedPriceType && (
              <div className="space-y-0.5">
                <Label className="text-xs">{t("master.item.prices.colType")}</Label>
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as ItemPriceType)}
                  disabled={!!busy}
                  className="flex h-7 w-full rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="purchase">{t("master.item.prices.typePurchase")}</option>
                  <option value="sale">{t("master.item.prices.typeSale")}</option>
                </select>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-xs">{t("master.item.prices.dialogPrice")}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={!!busy}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">{t("master.item.prices.dialogValidFrom")}</Label>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                disabled={!!busy}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">{t("master.item.prices.dialogReason")}</Label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ItemPriceReasonCode)}
                disabled={!!busy}
                className="flex h-7 w-full rounded border border-input bg-background px-2 text-xs"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`master.item.prices.reason_${r}` as const)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">{t("master.item.prices.dialogComment")}</Label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!!busy}
                className="h-7 text-xs"
              />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </div>
          <div className="mt-3 flex justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("master.item.prices.dialogClose")}
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={busy}>
              {t("master.item.prices.dialogSubmit")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
