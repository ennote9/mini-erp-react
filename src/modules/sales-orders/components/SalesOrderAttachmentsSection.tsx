import { useCallback, useMemo } from "react";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  DocumentAttachmentsSection,
  type DocumentAttachmentInput,
} from "@/shared/ui/object/DocumentAttachmentsSection";
import { salesOrderRepository } from "../repository";

export type SalesOrderAttachmentsSectionProps = {
  salesOrderId: string;
  canMutate: boolean;
};

export function SalesOrderAttachmentsSection(props: SalesOrderAttachmentsSectionProps) {
  const { salesOrderId, canMutate } = props;
  const { t, locale } = useTranslation();
  const revision = useAppReadModelRevision();

  const attachments = useMemo(
    () => salesOrderRepository.listAttachments(salesOrderId),
    [salesOrderId, revision],
  );

  const handleAddAttachments = useCallback(
    (nextAttachments: DocumentAttachmentInput[]) => {
      salesOrderRepository.addAttachments(salesOrderId, nextAttachments);
    },
    [salesOrderId],
  );

  const handleDeleteAttachment = useCallback(
    (attachmentId: string) => {
      salesOrderRepository.deleteAttachment(salesOrderId, attachmentId);
    },
    [salesOrderId],
  );

  return (
    <DocumentAttachmentsSection
      attachments={attachments}
      canMutate={canMutate}
      locale={locale}
      labels={{
        sectionTitle: t("doc.so.attachments.sectionTitle"),
        sectionHint: t("doc.so.attachments.sectionHint"),
        add: t("doc.so.attachments.add"),
        empty: t("doc.so.attachments.empty"),
        fileName: t("doc.so.attachments.fileName"),
        fileSize: t("doc.so.attachments.fileSize"),
        addedAt: t("doc.so.attachments.addedAt"),
        actions: t("common.actions"),
        download: t("doc.so.attachments.download"),
        remove: t("doc.so.attachments.remove"),
        deleteConfirm: t("doc.so.attachments.deleteConfirm"),
        readFailed: t("doc.so.attachments.readFailed"),
      }}
      onAddAttachments={handleAddAttachments}
      onDeleteAttachment={handleDeleteAttachment}
    />
  );
}
