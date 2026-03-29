import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

export type DocumentAttachmentRecord = {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  contentBase64: string;
  addedAt: string;
};

export type DocumentAttachmentInput = Omit<DocumentAttachmentRecord, "id" | "addedAt">;

export type DocumentAttachmentsLabels = {
  sectionTitle: string;
  sectionHint: string;
  add: string;
  empty: string;
  fileName: string;
  fileSize: string;
  addedAt: string;
  actions: string;
  download: string;
  remove: string;
  deleteConfirm: string;
  readFailed: string;
};

export type DocumentAttachmentsSectionProps = {
  attachments: DocumentAttachmentRecord[];
  canMutate: boolean;
  locale: string;
  labels: DocumentAttachmentsLabels;
  onAddAttachments: (attachments: DocumentAttachmentInput[]) => void;
  onDeleteAttachment: (attachmentId: string) => void;
};

function formatSize(sizeBytes: number, locale: string): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(sizeBytes / 1024)} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    sizeBytes / (1024 * 1024),
  )} MB`;
}

function blobFromBase64(contentBase64: string, mimeType?: string): Blob {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

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

export function DocumentAttachmentsSection(props: DocumentAttachmentsSectionProps) {
  const { attachments, canMutate, locale, labels, onAddAttachments, onDeleteAttachment } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localeTag = useMemo(
    () => (locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US"),
    [locale],
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
        const nextAttachments = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            mimeType: file.type || undefined,
            sizeBytes: file.size,
            contentBase64: await readFileAsBase64(file),
          })),
        );
        onAddAttachments(nextAttachments);
      } catch (attachmentError) {
        setError(attachmentError instanceof Error ? attachmentError.message : labels.readFailed);
      } finally {
        setBusy(false);
      }
    },
    [labels.readFailed, onAddAttachments],
  );

  const handleDownload = useCallback((attachment: DocumentAttachmentRecord) => {
    const blob = blobFromBase64(attachment.contentBase64, attachment.mimeType);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDelete = useCallback(
    (attachmentId: string) => {
      if (!window.confirm(labels.deleteConfirm)) return;
      onDeleteAttachment(attachmentId);
    },
    [labels.deleteConfirm, onDeleteAttachment],
  );

  return (
    <Card className="max-w-4xl border-0 bg-transparent shadow-none">
      <CardContent className="space-y-4 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{labels.sectionTitle}</h3>
            <p className="text-sm text-muted-foreground">{labels.sectionHint}</p>
          </div>
          {canMutate ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={handleOpenPicker} disabled={busy}>
              <Upload className="h-4 w-4" aria-hidden />
              {labels.add}
            </Button>
          ) : null}
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
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm leading-tight">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">{labels.fileName}</th>
                  <th className="px-2 py-2 font-medium">{labels.fileSize}</th>
                  <th className="px-2 py-2 font-medium">{labels.addedAt}</th>
                  <th className="w-[7rem] px-2 py-2 font-medium">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((attachment) => (
                  <tr key={attachment.id} className="border-b border-border/80 last:border-0">
                    <td className="px-2 py-2 align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate" title={attachment.name}>
                          {attachment.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle tabular-nums text-muted-foreground">
                      {formatSize(attachment.sizeBytes, locale)}
                    </td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">
                      {new Date(attachment.addedAt).toLocaleString(localeTag, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={labels.download}
                          aria-label={labels.download}
                          onClick={() => handleDownload(attachment)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canMutate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title={labels.remove}
                            aria-label={labels.remove}
                            onClick={() => handleDelete(attachment.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
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
