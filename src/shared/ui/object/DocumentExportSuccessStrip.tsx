import { Button } from "@/components/ui/button";
import { File, FolderOpen, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";

export type DocumentExportSuccessState = { path: string; filename: string };

type Props = {
  success: DocumentExportSuccessState | null;
  onDismiss: () => void;
};

/**
 * Compact post-export bar matching list/document Excel export flows (open file / folder / dismiss).
 */
export function DocumentExportSuccessStrip({ success, onDismiss }: Props) {
  const { t } = useTranslation();
  if (!success) return null;

  return (
    <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
      <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
      <span
        className="font-medium text-xs truncate max-w-[12rem]"
        title={success.filename}
      >
        {success.filename}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={t("doc.list.openFile")}
        aria-label={t("doc.list.openFile")}
        onClick={async () => {
          try {
            await invoke("open_export_file", { path: success.path });
            onDismiss();
          } catch (err) {
            console.error("Open file failed", err);
            onDismiss();
          }
        }}
      >
        <File className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={t("doc.list.openFolder")}
        aria-label={t("doc.list.openFolder")}
        onClick={() => {
          revealItemInDir(success.path);
          onDismiss();
        }}
      >
        <FolderOpen className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
        title={t("doc.list.dismiss")}
        aria-label={t("doc.list.dismiss")}
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
