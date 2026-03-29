import { useCallback, useMemo } from "react";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  DocumentAttachmentsSection,
  type DocumentAttachmentInput,
} from "@/shared/ui/object/DocumentAttachmentsSection";
import { purchaseOrderRepository } from "../repository";

export type PurchaseOrderAttachmentsSectionProps = {
  purchaseOrderId: string;
  canMutate: boolean;
};

export function PurchaseOrderAttachmentsSection(props: PurchaseOrderAttachmentsSectionProps) {
  const { purchaseOrderId, canMutate } = props;
  const { t, locale } = useTranslation();
  const revision = useAppReadModelRevision();

  const attachments = useMemo(
    () => purchaseOrderRepository.listAttachments(purchaseOrderId),
    [purchaseOrderId, revision],
  );

  const handleAddAttachments = useCallback(
    (nextAttachments: DocumentAttachmentInput[]) => {
      purchaseOrderRepository.addAttachments(purchaseOrderId, nextAttachments);
    },
    [purchaseOrderId],
  );

  const handleDeleteAttachment = useCallback(
    (attachmentId: string) => {
      purchaseOrderRepository.deleteAttachment(purchaseOrderId, attachmentId);
    },
    [purchaseOrderId],
  );

  return (
    <DocumentAttachmentsSection
      attachments={attachments}
      canMutate={canMutate}
      locale={locale}
      labels={{
        sectionTitle: t("doc.po.attachments.sectionTitle"),
        sectionHint: t("doc.po.attachments.sectionHint"),
        add: t("doc.po.attachments.add"),
        empty: t("doc.po.attachments.empty"),
        fileName: t("doc.po.attachments.fileName"),
        fileSize: t("doc.po.attachments.fileSize"),
        addedAt: t("doc.po.attachments.addedAt"),
        actions: t("common.actions"),
        download: t("doc.po.attachments.download"),
        remove: t("doc.po.attachments.remove"),
        deleteConfirm: t("doc.po.attachments.deleteConfirm"),
        readFailed: t("doc.po.attachments.readFailed"),
      }}
      onAddAttachments={handleAddAttachments}
      onDeleteAttachment={handleDeleteAttachment}
    />
  );
}
