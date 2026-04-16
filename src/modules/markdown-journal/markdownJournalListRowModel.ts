import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import type { TFunction } from "@/shared/i18n";
import { markdownJournalLineRepository } from "./journalLineRepository";
import { markdownJournalRepository } from "./journalRepository";
import { markdownRepository } from "./repository";
import type { MarkdownJournalStatus, MarkdownRecord } from "./model";

export type JournalRow = {
  id: string;
  number: string;
  status: MarkdownJournalStatus;
  sourceWarehouseLabel: string;
  targetWarehouseLabel: string;
  lineCount: number;
  totalQty: number;
  createdAt: string;
  postedAt: string;
  comment: string;
};

export type MarkdownCodeRow = {
  id: string;
  journalId: string;
  journalNumber: string;
  itemId: string;
  markdownCode: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  warehouseLabel: string;
  statusLabel: string;
  reasonLabel: string;
  postedAt: string;
};

function warehouseLabelFor(id: string): string {
  const warehouse = warehouseRepository.getById(id);
  return warehouse ? `${warehouse.code} — ${warehouse.name}` : id;
}

export function buildJournalRows(t: TFunction): JournalRow[] {
  return markdownJournalRepository
    .list()
    .map((journal) => {
      const lines = markdownJournalLineRepository.listByJournalId(journal.id);
      return {
        id: journal.id,
        number: journal.number,
        status: journal.status,
        sourceWarehouseLabel: warehouseLabelFor(journal.sourceWarehouseId),
        targetWarehouseLabel: warehouseLabelFor(journal.targetWarehouseId),
        lineCount: lines.length,
        totalQty: lines.reduce((sum, line) => sum + line.quantity, 0),
        createdAt: journal.createdAt,
        postedAt: journal.postedAt ?? t("domain.audit.summary.emDash"),
        comment: journal.comment ?? "",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildMarkdownCodeRows(t: TFunction): MarkdownCodeRow[] {
  return markdownJournalRepository
    .list()
    .filter((journal) => journal.status === "posted")
    .flatMap((journal) => {
      return markdownRepository
        .list()
        .filter((record: MarkdownRecord) => {
          if (record.journalId === journal.id) return true;
          if (!journal.legacySourceIds || journal.legacySourceIds.length === 0) return false;
          const batchId = record.batchId?.trim();
          return (
            journal.legacySourceIds.includes(record.id) ||
            (!!batchId && journal.legacySourceIds.includes(batchId))
          );
        })
        .map((record) => {
          const item = itemRepository.getById(record.itemId);
          return {
            id: record.id,
            journalId: journal.id,
            journalNumber: record.journalNumber ?? journal.number,
            itemId: record.itemId,
            markdownCode: record.markdownCode,
            itemCode: item?.code ?? record.itemId,
            itemName: item?.name ?? record.itemId,
            quantity: 1,
            markdownPrice: record.markdownPrice,
            warehouseLabel: warehouseLabelFor(record.warehouseId),
            statusLabel: t(`markdown.status.${record.status}`),
            reasonLabel: t(`markdown.reason.${record.reasonCode}`),
            postedAt: journal.postedAt ?? record.createdAt,
          };
        });
    })
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt) || b.journalNumber.localeCompare(a.journalNumber));
}
