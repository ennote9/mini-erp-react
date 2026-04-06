import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  entityAttachmentRepository,
  flushPendingEntityAttachmentPersist,
} from "@/shared/entityAttachments/repository";
import type { EntityAttachment } from "@/shared/entityAttachments/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Trash2, Upload } from "lucide-react";

type Props = {
  customerId: string;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : "";
      if (base64 === "") {
        reject(new Error("Could not read attachment."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read attachment."));
    reader.readAsDataURL(file);
  });
}

function blobFromBase64(contentBase64: string, mimeType?: string): Blob {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function formatFileSize(
  attachment: EntityAttachment,
  formatNumber: (
    value: number | null | undefined,
    options?: { minFractionDigits?: number; maxFractionDigits?: number; empty?: string },
  ) => string,
): string {
  if (!attachment.fileSize || attachment.fileSize <= 0) return "—";
  const sizeBytes = attachment.fileSize;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${formatNumber(sizeBytes / 1024, { maxFractionDigits: 1, empty: "0" })} KB`;
  }
  return `${formatNumber(sizeBytes / (1024 * 1024), { maxFractionDigits: 1, empty: "0" })} MB`;
}

export function CustomerAttachmentsSection({ customerId }: Props) {
  const { t } = useTranslation();
  const { formatDateTime, formatNumber } = useAppDisplayFormatters();
  const revision = useAppReadModelRevision();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachments = useMemo(
    () => entityAttachmentRepository.listByEntity("customer", customerId),
    [customerId, revision],
  );

  const handleOpenPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;

      setBusy(true);
      setError(null);
      try {
        const payload = await Promise.all(
          files.map(async (file) => ({
            entityType: "customer" as const,
            entityId: customerId,
            fileName: file.name,
            storageRef: await readFileAsBase64(file),
            fileSize: file.size,
            mimeType: file.type || undefined,
            comment: commentDraft.trim() || undefined,
          })),
        );
        entityAttachmentRepository.addMany(payload);
        await flushPendingEntityAttachmentPersist();
        setCommentDraft("");
      } catch (e) {
        setError(e instanceof Error ? e.message : t("master.customer.attachments.readFailed"));
      } finally {
        setBusy(false);
      }
    },
    [commentDraft, customerId, t],
  );

  const handleDelete = useCallback(
    (attachmentId: string) => {
      if (!window.confirm(t("master.customer.attachments.deleteConfirm"))) return;
      entityAttachmentRepository.delete(attachmentId);
    },
    [t],
  );

  const handleDownload = useCallback((attachment: EntityAttachment) => {
    const blob = blobFromBase64(attachment.storageRef, attachment.mimeType);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Card className="w-full border-0 bg-transparent shadow-none">
      <CardContent className="space-y-3 p-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("master.customer.attachments.sectionTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("master.customer.attachments.sectionHint")}</p>
        </div>

        <div className="rounded-md border border-border/80 bg-card/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <Label htmlFor="customer-attachment-comment" className="text-sm">
                {t("master.customer.attachments.commentLabel")}
              </Label>
              <Textarea
                id="customer-attachment-comment"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={2}
                className="mt-1 min-h-[3.5rem] text-sm"
                placeholder={t("common.optional")}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleOpenPicker}
              disabled={busy}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {t("master.customer.attachments.add")}
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {attachments.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/80 bg-card/20 px-3 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{t("master.customer.attachments.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("master.customer.attachments.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm leading-tight">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">{t("master.customer.attachments.fileName")}</th>
                  <th className="px-2 py-2 font-medium">{t("master.customer.attachments.uploadedAt")}</th>
                  <th className="px-2 py-2 font-medium">{t("doc.columns.comment")}</th>
                  <th className="w-[4rem] px-2 py-2 text-right font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((attachment) => (
                  <tr key={attachment.id} className="border-b border-border/80 transition-colors hover:bg-accent/20 last:border-0">
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left text-foreground hover:text-primary"
                        onClick={() => handleDownload(attachment)}
                        title={t("master.customer.attachments.download")}
                        aria-label={`${t("master.customer.attachments.download")}: ${attachment.fileName}`}
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate text-sm font-medium underline-offset-2 hover:underline" title={attachment.fileName}>
                          {attachment.fileName}
                        </span>
                      </button>
                      <div className="mt-0.5 pl-5 text-[11px] text-muted-foreground">
                        {formatFileSize(attachment, formatNumber)}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">
                      {formatDateTime(attachment.uploadedAt)}
                    </td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">
                      {attachment.comment ?? t("master.common.selectEmpty")}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title={t("master.customer.attachments.remove")}
                          aria-label={t("master.customer.attachments.remove")}
                          onClick={() => handleDelete(attachment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
