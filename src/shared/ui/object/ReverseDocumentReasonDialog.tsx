import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import {
  REVERSAL_DOCUMENT_REASON_CODES,
  type ReversalDocumentReasonCode,
  isReversalDocumentReasonCode,
  validateReversalDocumentReasonForm,
} from "../../reasonCodes";
import { useSettings } from "../../settings/SettingsContext";
import { useTranslation, translateReversalReason } from "@/shared/i18n";
import { cn } from "@/lib/utils";

export type ReverseDocumentReasonPayload = {
  reversalReasonCode: ReversalDocumentReasonCode;
  reversalReasonComment?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "receipt", "shipment" */
  documentKindLabel: string;
  onConfirm: (payload: ReverseDocumentReasonPayload) => void;
};

export function ReverseDocumentReasonDialog({
  open,
  onOpenChange,
  documentKindLabel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const requireReason = settings.documents.requireReversalReason;
  const reasonOptions = useMemo(
    () =>
      REVERSAL_DOCUMENT_REASON_CODES.map((code) => ({
        value: code,
        label: translateReversalReason(t, code),
      })),
    [t],
  );
  const [reasonCode, setReasonCode] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReasonCode("");
    setComment("");
    setSubmitError(null);
  }, [open]);

  const handleConfirm = () => {
    let effectiveCode: ReversalDocumentReasonCode;
    if (requireReason) {
      const err = validateReversalDocumentReasonForm(reasonCode);
      if (err) {
        setSubmitError(
          err === "A reversal reason is required."
            ? t("domain.validation.reversalReasonRequired")
            : err === "Select a valid reversal reason."
              ? t("domain.validation.selectValidReversalReason")
              : err,
        );
        return;
      }
      effectiveCode = reasonCode as ReversalDocumentReasonCode;
    } else {
      effectiveCode =
        reasonCode !== "" && isReversalDocumentReasonCode(reasonCode) ? reasonCode : "OTHER";
    }
    setSubmitError(null);
    const c = comment.trim();
    onConfirm({
      reversalReasonCode: effectiveCode,
      reversalReasonComment: c === "" ? undefined : c.length > 500 ? c.slice(0, 500) : c,
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(100vw-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background p-4 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleConfirm();
            }
          }}
        >
          <Dialog.Title className="text-base font-semibold text-foreground">
            {t("doc.reverseDialog.title", { kind: documentKindLabel })}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {requireReason
              ? t("doc.reverseDialog.descriptionRequired")
              : t("doc.reverseDialog.descriptionOptional")}
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="reversal-reason-code" className="text-sm">
                {t("doc.reverseDialog.reasonLabel")}{" "}
                {requireReason ? <span className="text-destructive">*</span> : null}
              </Label>
              <SelectField
                id="reversal-reason-code"
                value={reasonCode}
                onChange={setReasonCode}
                options={reasonOptions}
                placeholder={t("doc.reverseDialog.selectPlaceholder")}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="reversal-reason-comment" className="text-sm">
                {t("doc.reverseDialog.commentLabel")} ({t("doc.reverseDialog.commentOptional")})
              </Label>
              <Input
                id="reversal-reason-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("doc.reverseDialog.notePlaceholder")}
                className="h-8 text-sm"
                maxLength={500}
              />
            </div>
            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("doc.reverseDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              title={t("doc.reverseDialog.confirmTitle")}
            >
              {t("doc.reverseDialog.confirm")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
