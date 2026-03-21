import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import {
  CANCEL_DOCUMENT_REASON_CODES,
  type CancelDocumentReasonCode,
  isCancelDocumentReasonCode,
  validateCancelDocumentReasonForm,
} from "../../reasonCodes";
import { useSettings } from "../../settings/SettingsContext";
import { useTranslation, translateCancelReason } from "@/shared/i18n";
import { cn } from "@/lib/utils";

export type CancelDocumentReasonPayload = {
  cancelReasonCode: CancelDocumentReasonCode;
  cancelReasonComment?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "purchase order", "receipt" */
  documentKindLabel: string;
  onConfirm: (payload: CancelDocumentReasonPayload) => void;
};

export function CancelDocumentReasonDialog({
  open,
  onOpenChange,
  documentKindLabel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const requireReason = settings.documents.requireCancelReason;
  const reasonOptions = useMemo(
    () =>
      CANCEL_DOCUMENT_REASON_CODES.map((code) => ({
        value: code,
        label: translateCancelReason(t, code),
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
    let effectiveCode: CancelDocumentReasonCode;
    if (requireReason) {
      const err = validateCancelDocumentReasonForm(reasonCode);
      if (err) {
        setSubmitError(
          err === "A cancel reason is required."
            ? t("validation.cancelReasonRequired")
            : err === "Select a valid cancel reason."
              ? t("validation.selectValidCancelReason")
              : err,
        );
        return;
      }
      effectiveCode = reasonCode as CancelDocumentReasonCode;
    } else {
      effectiveCode =
        reasonCode !== "" && isCancelDocumentReasonCode(reasonCode) ? reasonCode : "OTHER";
    }
    setSubmitError(null);
    const c = comment.trim();
    onConfirm({
      cancelReasonCode: effectiveCode,
      cancelReasonComment: c === "" ? undefined : c.length > 500 ? c.slice(0, 500) : c,
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
            {t("doc.cancelDialog.title", { kind: documentKindLabel })}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {requireReason ? t("doc.cancelDialog.descriptionRequired") : t("doc.cancelDialog.descriptionOptional")}
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cancel-reason-code" className="text-sm">
                {t("doc.cancelDialog.reasonLabel")}{" "}
                {requireReason ? <span className="text-destructive">*</span> : null}
              </Label>
              <SelectField
                id="cancel-reason-code"
                value={reasonCode}
                onChange={setReasonCode}
                options={reasonOptions}
                placeholder={t("doc.cancelDialog.selectPlaceholder")}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cancel-reason-comment" className="text-sm">
                {t("doc.cancelDialog.commentLabel")} ({t("doc.cancelDialog.commentOptional")})
              </Label>
              <Input
                id="cancel-reason-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("doc.cancelDialog.notePlaceholder")}
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
              {t("doc.cancelDialog.back")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              title={t("doc.cancelDialog.confirmTitle")}
            >
              {t("doc.cancelDialog.confirm")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
