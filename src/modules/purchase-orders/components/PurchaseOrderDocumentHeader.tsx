import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DocumentIssueStrip } from "@/shared/ui/feedback/DocumentIssueStrip";
import { hasErrors, hasWarnings, type Issue } from "@/shared/issues";
import type { TFunction } from "@/shared/i18n/resolve";
import type { PurchaseOrder } from "../model";
import {
  ChevronDown,
  CircleCheck,
  File,
  FileSpreadsheet,
  FileX,
  FolderOpen,
  Save,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export type PurchaseOrderDocumentHeaderProps = {
  displayTitle: string;
  isNew: boolean;
  doc: PurchaseOrder | undefined;
  isEditable: boolean;
  isDraft: boolean;
  isConfirmed: boolean;
  combinedIssues: Issue[];
  healthIssues: Issue[];
  blockConfirmWhenPlanningHasBlockingErrors: boolean;
  onSave: () => void;
  onConfirm: () => void;
  onCreateReceipt: () => void;
  draftReceipt: { id: string } | undefined;
  latestReceipt: { id: string } | undefined;
  onOpenReceipt: (receiptId: string) => void;
  onCancelDocument: () => void;
  exportSuccess: { path: string; filename: string } | null;
  onExportSuccessDismiss: () => void;
  exportOpen: boolean;
  onExportOpenChange: (open: boolean) => void;
  onExportMain: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  exportSelectedDisabled: boolean;
  onCancel: () => void;
  t: TFunction;
};

/**
 * Purchase order document title row + action cluster (aligned with sales-order document density).
 */
export function PurchaseOrderDocumentHeader(props: PurchaseOrderDocumentHeaderProps) {
  const {
    displayTitle,
    isNew,
    doc,
    isEditable,
    isDraft,
    isConfirmed,
    combinedIssues,
    healthIssues,
    blockConfirmWhenPlanningHasBlockingErrors,
    onSave,
    onConfirm,
    onCreateReceipt,
    draftReceipt,
    latestReceipt,
    onOpenReceipt,
    onCancelDocument,
    exportSuccess,
    onExportSuccessDismiss,
    exportOpen,
    onExportOpenChange,
    onExportMain,
    onExportSelected,
    onExportAll,
    exportSelectedDisabled,
    onCancel,
    t,
  } = props;

  const confirmBlocked = blockConfirmWhenPlanningHasBlockingErrors && hasErrors(healthIssues);
  const confirmTitle = confirmBlocked ? t("doc.page.fixErrorsBeforeConfirm") : undefined;

  return (
    <div className="doc-header">
      <div className="doc-header__title-row">
        <h2 className="doc-header__title">{displayTitle}</h2>
        {!isNew && doc != null && (
          <Badge
            variant="outline"
            className="h-6 rounded-full border-border px-2.5 text-xs font-medium leading-none text-foreground"
          >
            {t(`status.labels.${doc.status}`)}
          </Badge>
        )}
      </div>
      <div className="doc-header__right">
        {isEditable && (hasErrors(combinedIssues) || hasWarnings(combinedIssues)) && (
          <DocumentIssueStrip issues={combinedIssues} />
        )}
        <div className="doc-header__actions items-center [&_button]:!text-xs [&_button]:!leading-tight [&_button_svg]:!h-3 [&_button_svg]:!w-3 [&_button_svg]:!max-h-3 [&_button_svg]:!max-w-3">
          {isEditable && (
            <Button type="button" className="h-[1.625rem] !gap-0.5 !px-1 !py-0" onClick={onSave} title={t("doc.page.saveTitle")}>
              <Save aria-hidden />
              {t("common.save")}
            </Button>
          )}
          {!isNew && isDraft && (
            <Button
              type="button"
              className="h-[1.625rem] !gap-0.5 !px-1 !py-0"
              onClick={onConfirm}
              disabled={confirmBlocked}
              title={confirmTitle}
            >
              <CircleCheck aria-hidden />
              {t("doc.page.confirm")}
            </Button>
          )}
          {!isNew && (
            <Button
              type="button"
              className="h-[1.625rem] !gap-0.5 !px-1 !py-0"
              onClick={onCreateReceipt}
              disabled={!isConfirmed}
              title={!isConfirmed ? t("issues.save.poReceiptConfirmedOnly") : undefined}
            >
              <span className="create-btn__plus">+</span> {t("doc.page.createReceipt")}
            </Button>
          )}
          {!isNew && draftReceipt != null && (
            <Button type="button" variant="outline" className="h-[1.625rem] !gap-0.5 !px-1 !py-0" onClick={() => onOpenReceipt(draftReceipt.id)}>
              {t("doc.po.openDraftReceipt")}
            </Button>
          )}
          {!isNew && draftReceipt == null && latestReceipt != null && (
            <Button type="button" variant="outline" className="h-[1.625rem] !gap-0.5 !px-1 !py-0" onClick={() => onOpenReceipt(latestReceipt.id)}>
              {t("doc.po.openLatestReceipt")}
            </Button>
          )}
          {!isNew && (isDraft || isConfirmed) && (
            <Button type="button" variant="outline" className="h-[1.625rem] !gap-0.5 !px-1 !py-0" onClick={onCancelDocument}>
              <FileX aria-hidden />
              {t("doc.page.cancelDocument")}
            </Button>
          )}
          {isEditable && (
            <>
              {exportSuccess != null && (
                <div className="h-8 w-max flex max-w-[min(100%,20rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
                  <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
                  <span className="max-w-[12rem] truncate text-xs font-medium" title={exportSuccess.filename}>
                    {exportSuccess.filename}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    title={t("doc.list.openFile")}
                    aria-label={t("doc.list.openFile")}
                    onClick={async () => {
                      const path = exportSuccess.path;
                      try {
                        await invoke("open_export_file", { path });
                        onExportSuccessDismiss();
                      } catch (err) {
                        console.error("Export failed", err);
                        onExportSuccessDismiss();
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
                      revealItemInDir(exportSuccess.path);
                      onExportSuccessDismiss();
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
                    onClick={onExportSuccessDismiss}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex shrink-0 items-stretch rounded-md border border-input">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-[1.625rem] rounded-r-none border-0 border-r border-input !gap-0.5 !px-1 !py-0"
                  onClick={onExportMain}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  {t("doc.page.export")}
                </Button>
                <Popover open={exportOpen} onOpenChange={onExportOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-[1.625rem] w-[1.625rem] shrink-0 rounded-l-none border-0 shadow-none"
                      aria-label={t("doc.list.exportOptionsAria")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="!w-max min-w-0 p-1.5" align="end" side="top">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={exportSelectedDisabled}
                        className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          exportSelectedDisabled
                            ? !isEditable
                              ? t("doc.list.exportSelectionEditModeOnly")
                              : t("doc.list.exportSelectLinesFirst")
                            : undefined
                        }
                        onClick={() => {
                          onExportOpenChange(false);
                          if (!exportSelectedDisabled) onExportSelected();
                        }}
                      >
                        {t("doc.list.exportSelectedRows")}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          onExportOpenChange(false);
                          onExportAll();
                        }}
                      >
                        {t("doc.list.exportAllLines")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
          {isEditable && (
            <Button type="button" variant="outline" className="h-[1.625rem] !gap-0.5 !px-1 !py-0" onClick={onCancel}>
              <X aria-hidden />
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
