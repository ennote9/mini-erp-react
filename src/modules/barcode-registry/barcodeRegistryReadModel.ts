import { itemRepository } from "@/modules/items";
import type { ItemBarcodeSourceType, ItemBarcodeSymbology } from "@/modules/items";
import { markdownJournalRepository, markdownRepository } from "@/modules/markdown-journal";
import type { MarkdownStatus } from "@/modules/markdown-journal";
import { normalizeTrim } from "@/shared/validation";

export type BarcodeRegistryEntryType = "ITEM_BARCODE" | "MARKDOWN_CODE";

export type BarcodeRegistrySource =
  | ItemBarcodeSourceType
  | "MARKDOWN_JOURNAL";

export type BarcodeRegistryRow = {
  id: string;
  code: string;
  entryType: BarcodeRegistryEntryType;
  itemId: string;
  itemCode: string;
  itemName: string;
  isActive: boolean;
  source: BarcodeRegistrySource;
  createdAt?: string;
  symbology?: ItemBarcodeSymbology;
  markdownJournalId?: string;
  markdownJournalNumber?: string;
  markdownStatus?: MarkdownStatus;
  nativePath: string;
};

function normalizedCodeKey(value: string): string {
  return normalizeTrim(value).toLowerCase();
}

export function listBarcodeRegistryRows(): BarcodeRegistryRow[] {
  const rowsByCode = new Map<string, BarcodeRegistryRow>();

  for (const item of itemRepository.list()) {
    for (const barcode of item.barcodes ?? []) {
      const code = normalizeTrim(barcode.codeValue);
      if (code === "") continue;
      const key = normalizedCodeKey(code);
      if (rowsByCode.has(key)) {
        if (import.meta.env.DEV) {
          console.warn("[barcodeRegistry] duplicate barcode code skipped", {
            code,
            existing: rowsByCode.get(key),
            duplicateKind: "ITEM_BARCODE",
          });
        }
        continue;
      }
      rowsByCode.set(key, {
        id: `item-barcode:${barcode.id}`,
        code,
        entryType: "ITEM_BARCODE",
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        isActive: barcode.isActive,
        source: barcode.sourceType,
        symbology: barcode.symbology,
        nativePath: `/items/${item.id}`,
      });
    }
  }

  for (const record of markdownRepository.list()) {
    const code = normalizeTrim(record.markdownCode);
    if (code === "") continue;
    const key = normalizedCodeKey(code);
    if (rowsByCode.has(key)) {
      if (import.meta.env.DEV) {
        console.warn("[barcodeRegistry] duplicate barcode code skipped", {
          code,
          existing: rowsByCode.get(key),
          duplicateKind: "MARKDOWN_CODE",
        });
      }
      continue;
    }
    const item = itemRepository.getById(record.itemId);
    const journal = record.journalId ? markdownJournalRepository.getById(record.journalId) : undefined;
    rowsByCode.set(key, {
      id: `markdown-code:${record.id}`,
      code,
      entryType: "MARKDOWN_CODE",
      itemId: record.itemId,
      itemCode: item?.code ?? record.itemId,
      itemName: item?.name ?? record.itemId,
      isActive: record.status === "ACTIVE",
      source: "MARKDOWN_JOURNAL",
      createdAt: record.createdAt,
      markdownJournalId: journal?.id ?? record.journalId,
      markdownJournalNumber: record.journalNumber ?? journal?.number,
      markdownStatus: record.status,
      nativePath:
        journal?.id != null
          ? `/markdown-journal/journals/${journal.id}`
          : `/markdown-journal?view=codes&q=${encodeURIComponent(code)}`,
    });
  }

  return [...rowsByCode.values()].sort((a, b) => {
    const byCode = a.code.localeCompare(b.code, undefined, { sensitivity: "base" });
    if (byCode !== 0) return byCode;
    return a.id.localeCompare(b.id);
  });
}
