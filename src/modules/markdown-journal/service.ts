import { itemRepository } from "../items/repository";
import { warehouseRepository } from "../warehouses/repository";
import { markdownRepository } from "./repository";
import { markdownJournalRepository } from "./journalRepository";
import { markdownJournalLineRepository } from "./journalLineRepository";
import { stockBalanceRepository } from "../stock-balances/repository";
import type {
  MarkdownJournal,
  MarkdownJournalLine,
  MarkdownReasonCode,
  MarkdownRecord,
} from "./model";
import {
  DEFAULT_STOCK_STYLE,
  warehouseStylePolicyAllowsStyle,
} from "@/shared/inventoryStyle";
import {
  assertMarkdownTransitionAllowed,
  isFinalMarkdownStatus,
  type MarkdownDirectTerminalTransition,
} from "./markdownLifecycle";

export type MarkdownJournalDraftLineInput = {
  itemId: string;
  markdownPrice: number;
  reasonCode: MarkdownReasonCode;
  quantity: number;
};

export type SaveMarkdownJournalDraftInput = {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  comment?: string;
  lines: MarkdownJournalDraftLineInput[];
  actorId?: string;
};

function newBatchId(): string {
  return `MB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeActor(actorId: string | undefined): string {
  return (actorId ?? "system").trim() || "system";
}

export type TransitionMarkdownInput = {
  recordId: string;
  transition: MarkdownDirectTerminalTransition;
  actorId: string;
};

export type ResolveMarkdownJournalPrintInput = {
  recordIds?: string[];
};

function validateJournalLine(
  line: MarkdownJournalDraftLineInput,
): { success: true; line: MarkdownJournalDraftLineInput } | { success: false; error: string } {
  const item = itemRepository.getById(line.itemId);
  if (!item) return { success: false, error: "Item not found." };
  if (item.itemKind === "TESTER") {
    return { success: false, error: "Markdown journal expects sellable items only." };
  }
  if (!item.isActive) {
    return { success: false, error: "Inactive items cannot be added." };
  }
  if (!(line.markdownPrice > 0)) {
    return { success: false, error: "Markdown price must be greater than zero." };
  }
  if (!(line.quantity > 0)) {
    return { success: false, error: "Quantity must be greater than zero." };
  }
  return {
    success: true,
    line: {
      ...line,
      quantity: Math.max(1, Math.floor(line.quantity)),
    },
  };
}

function buildJournalLineEntities(
  journalId: string,
  lines: MarkdownJournalDraftLineInput[],
): { success: true; lines: Omit<MarkdownJournalLine, "id">[] } | { success: false; error: string } {
  if (lines.length === 0) {
    return { success: false, error: "Add at least one markdown line." };
  }

  const normalized: Omit<MarkdownJournalLine, "id">[] = [];
  for (let index = 0; index < lines.length; index++) {
    const validated = validateJournalLine(lines[index]);
    if (!validated.success) return validated;
    normalized.push({
      journalId,
      sortOrder: index + 1,
      itemId: validated.line.itemId,
      markdownPrice: validated.line.markdownPrice,
      quantity: validated.line.quantity,
      reasonCode: validated.line.reasonCode,
    });
  }
  return { success: true, lines: normalized };
}

function validateWarehouseSelection(
  sourceWarehouseId: string,
  targetWarehouseId: string,
): { success: true } | { success: false; error: string } {
  if (!sourceWarehouseId.trim()) {
    return { success: false, error: "Source warehouse is required." };
  }
  if (!targetWarehouseId.trim()) {
    return { success: false, error: "Target warehouse is required." };
  }
  if (!warehouseRepository.getById(sourceWarehouseId)) {
    return { success: false, error: "Source warehouse not found." };
  }
  if (!warehouseRepository.getById(targetWarehouseId)) {
    return { success: false, error: "Target warehouse not found." };
  }
  return { success: true };
}

export function createMarkdownJournalDraft(
  input: SaveMarkdownJournalDraftInput,
): { success: true; journal: MarkdownJournal } | { success: false; error: string } {
  const warehouseSelection = validateWarehouseSelection(
    input.sourceWarehouseId,
    input.targetWarehouseId,
  );
  if (!warehouseSelection.success) return warehouseSelection;

  const createdAt = new Date().toISOString();
  const actor = normalizeActor(input.actorId);
  const journal = markdownJournalRepository.create({
    status: "draft",
    sourceWarehouseId: input.sourceWarehouseId.trim(),
    targetWarehouseId: input.targetWarehouseId.trim(),
    comment: input.comment?.trim() || undefined,
    createdAt,
    createdBy: actor,
  });

  const builtLines = buildJournalLineEntities(journal.id, input.lines);
  if (!builtLines.success) return builtLines;
  markdownJournalLineRepository.replaceForJournal(journal.id, builtLines.lines);
  return { success: true, journal };
}

export function updateMarkdownJournalDraft(
  journalId: string,
  input: SaveMarkdownJournalDraftInput,
): { success: true; journal: MarkdownJournal } | { success: false; error: string } {
  const journal = markdownJournalRepository.getById(journalId);
  if (!journal) return { success: false, error: "Markdown journal not found." };
  if (journal.status !== "draft") {
    return { success: false, error: "Only draft journals can be edited." };
  }
  const warehouseSelection = validateWarehouseSelection(
    input.sourceWarehouseId,
    input.targetWarehouseId,
  );
  if (!warehouseSelection.success) return warehouseSelection;

  const builtLines = buildJournalLineEntities(journal.id, input.lines);
  if (!builtLines.success) return builtLines;

  markdownJournalLineRepository.replaceForJournal(journal.id, builtLines.lines);
  const updated = markdownJournalRepository.update(journal.id, {
    sourceWarehouseId: input.sourceWarehouseId.trim(),
    targetWarehouseId: input.targetWarehouseId.trim(),
    comment: input.comment?.trim() || undefined,
  });
  if (!updated) return { success: false, error: "Failed to save draft journal." };
  return { success: true, journal: updated };
}

export function cancelMarkdownJournalDraft(
  journalId: string,
  actorId?: string,
): { success: true; journal: MarkdownJournal } | { success: false; error: string } {
  const journal = markdownJournalRepository.getById(journalId);
  if (!journal) return { success: false, error: "Markdown journal not found." };
  if (journal.status !== "draft") {
    return { success: false, error: "Only draft journals can be cancelled." };
  }

  const cancelledAt = new Date().toISOString();
  const cancelledBy = normalizeActor(actorId);
  const updated = markdownJournalRepository.update(journalId, {
    status: "cancelled",
    cancelledAt,
    cancelledBy,
  });
  if (!updated) return { success: false, error: "Failed to cancel draft journal." };
  return { success: true, journal: updated };
}

export function listMarkdownLinesForJournal(journalId: string): MarkdownJournalLine[] {
  return markdownJournalLineRepository.listByJournalId(journalId);
}

export function listMarkdownUnitsForJournal(journalId: string): MarkdownRecord[] {
  const journal = markdownJournalRepository.getById(journalId);
  if (!journal) return [];
  return markdownRepository.list().filter((record) => {
    if (record.journalId === journalId) return true;
    if (!journal.legacySourceIds || journal.legacySourceIds.length === 0) return false;
    const batchId = record.batchId?.trim();
    return journal.legacySourceIds.includes(record.id) || (!!batchId && journal.legacySourceIds.includes(batchId));
  });
}

export function postMarkdownJournal(
  journalId: string,
  actorId: string,
): { success: true; journal: MarkdownJournal; records: MarkdownRecord[] } | { success: false; error: string } {
  const journal = markdownJournalRepository.getById(journalId);
  if (!journal) return { success: false, error: "Markdown journal not found." };
  if (journal.status !== "draft") {
    return { success: false, error: "Only draft journals can be posted." };
  }

  const lines = markdownJournalLineRepository.listByJournalId(journalId);
  if (lines.length === 0) {
    return { success: false, error: "Add at least one markdown line before posting." };
  }

  const actor = normalizeActor(actorId);
  const postedAt = new Date().toISOString();
  const records: MarkdownRecord[] = [];
  const sourceWarehouse = warehouseRepository.getById(journal.sourceWarehouseId);
  if (!sourceWarehouse) {
    return { success: false, error: "Source warehouse not found." };
  }
  const targetWarehouse = warehouseRepository.getById(journal.targetWarehouseId);
  if (!targetWarehouse) {
    return { success: false, error: "Target warehouse not found." };
  }
  if (!warehouseStylePolicyAllowsStyle(sourceWarehouse.stylePolicy, DEFAULT_STOCK_STYLE)) {
    return {
      success: false,
      error: `Warehouse ${sourceWarehouse.code}: source warehouse style policy does not allow GOOD stock for markdown posting.`,
    };
  }
  if (!warehouseStylePolicyAllowsStyle(targetWarehouse.stylePolicy, "MARKDOWN")) {
    return {
      success: false,
      error: `Warehouse ${targetWarehouse.code}: target warehouse style policy does not allow MARKDOWN stock.`,
    };
  }
  const requiredGoodByItem = new Map<string, number>();

  for (const line of lines) {
    requiredGoodByItem.set(
      line.itemId,
      (requiredGoodByItem.get(line.itemId) ?? 0) + line.quantity,
    );
  }

  for (const [itemId, requiredQty] of requiredGoodByItem) {
    const goodBalance = stockBalanceRepository.getByItemAndWarehouse(
      itemId,
      journal.sourceWarehouseId,
    );
    const available = goodBalance?.qtyOnHand ?? 0;
    if (available < requiredQty) {
      const item = itemRepository.getById(itemId);
      const code = item?.code ?? itemId;
      return {
        success: false,
        error: `Item ${code}: insufficient GOOD stock to post markdown journal (available ${available}, required ${requiredQty}).`,
      };
    }
  }

  for (const line of lines) {
    const item = itemRepository.getById(line.itemId);
    if (!item) return { success: false, error: "Item not found." };
    if (item.itemKind === "TESTER") return { success: false, error: "Markdown journal expects sellable items only." };
    const batchId = newBatchId();
    for (let index = 0; index < line.quantity; index++) {
      records.push(
        markdownRepository.create({
          journalId: journal.id,
          journalNumber: journal.number,
          journalLineId: line.id,
          batchId,
          batchSequenceIndex: index + 1,
          batchSequenceTotal: line.quantity,
          itemId: line.itemId,
        markdownPrice: line.markdownPrice,
        reasonCode: line.reasonCode,
        status: "ACTIVE",
        createdAt: postedAt,
        createdBy: actor,
        warehouseId: journal.targetWarehouseId,
        style: "MARKDOWN",
        originalBarcode: item.barcode,
        comment: journal.comment,
        basePriceAtMarkdown: item.salePrice,
        printCount: 0,
        quantity: 1,
      }),
      );
    }
    stockBalanceRepository.adjustQty({
      itemId: line.itemId,
      warehouseId: journal.sourceWarehouseId,
      style: DEFAULT_STOCK_STYLE,
      qtyDelta: -line.quantity,
    });
    stockBalanceRepository.adjustQty({
      itemId: line.itemId,
      warehouseId: journal.targetWarehouseId,
      style: "MARKDOWN",
      qtyDelta: line.quantity,
    });
  }

  const updated = markdownJournalRepository.update(journal.id, {
    status: "posted",
    postedAt,
    postedBy: actor,
  });
  if (!updated) return { success: false, error: "Failed to post markdown journal." };
  return { success: true, journal: updated, records };
}

export function resolveMarkdownJournalPrintRecords(
  journalId: string,
  input?: ResolveMarkdownJournalPrintInput,
): { success: true; journal: MarkdownJournal; records: MarkdownRecord[] } | { success: false; error: string } {
  const journal = markdownJournalRepository.getById(journalId);
  if (!journal) return { success: false, error: "Markdown journal not found." };
  if (journal.status !== "posted") return { success: false, error: "Print is available only for posted journals." };
  const records = listMarkdownUnitsForJournal(journalId);
  if (records.length === 0) {
    return { success: false, error: "No generated markdown units available for printing." };
  }
  const selectedIds = input?.recordIds?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (!input?.recordIds) {
    return { success: true, journal, records };
  }
  if (selectedIds.length === 0) {
    return { success: false, error: "Select at least one generated markdown code to print." };
  }
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const selectedRecords: MarkdownRecord[] = [];
  for (const recordId of selectedIds) {
    const record = recordMap.get(recordId);
    if (!record) {
      return { success: false, error: "Selected markdown codes must belong to the current journal." };
    }
    selectedRecords.push(record);
  }
  return { success: true, journal, records: selectedRecords };
}

export function recordMarkdownPrintAudit(
  recordIds: string[],
): { success: true; records: MarkdownRecord[] } | { success: false; error: string } {
  const normalizedIds = recordIds.map((value) => value.trim()).filter(Boolean);
  if (normalizedIds.length === 0) {
    return { success: false, error: "Select at least one generated markdown code to print." };
  }
  const printedAt = new Date().toISOString();
  const updatedRecords: MarkdownRecord[] = [];
  for (const recordId of normalizedIds) {
    const record = markdownRepository.getById(recordId);
    if (!record) return { success: false, error: "Selected markdown codes could not be resolved." };
    const updated = markdownRepository.update(recordId, {
      printCount: record.printCount + 1,
      printedAt,
    });
    if (!updated) return { success: false, error: "Failed to save markdown print audit." };
    updatedRecords.push(updated);
  }
  return { success: true, records: updatedRecords };
}

export function transitionMarkdownRecord(
  input: TransitionMarkdownInput,
): { success: true; record: MarkdownRecord } | { success: false; error: string } {
  const rec = markdownRepository.getById(input.recordId);
  if (!rec) return { success: false, error: "Markdown record not found." };
  if (rec.status !== "ACTIVE") {
    return { success: false, error: "Only ACTIVE markdown units can be changed this way." };
  }
  try {
    assertMarkdownTransitionAllowed(rec.status, input.transition);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
  const now = new Date().toISOString();
  const actor = input.actorId.trim() || "system";
  const updated = markdownRepository.update(rec.id, {
    status: input.transition,
    closedAt: now,
    closedBy: actor,
  });
  if (!updated) return { success: false, error: "Update failed." };
  stockBalanceRepository.adjustQty({
    itemId: rec.itemId,
    warehouseId: rec.warehouseId,
    style: "MARKDOWN",
    qtyDelta: -1,
  });
  return { success: true, record: updated };
}

export function supersedeMarkdownRecord(
  recordId: string,
  actorId: string,
): { success: true; oldRecord: MarkdownRecord; newRecord: MarkdownRecord } | { success: false; error: string } {
  const old = markdownRepository.getById(recordId);
  if (!old) return { success: false, error: "Markdown record not found." };
  if (old.status !== "ACTIVE") {
    return { success: false, error: "Only ACTIVE markdown units can be superseded." };
  }
  const item = itemRepository.getById(old.itemId);
  if (!item) return { success: false, error: "Base item not found." };
  if (item.itemKind === "TESTER") return { success: false, error: "Markdown supersede expects a sellable item." };

  const now = new Date().toISOString();
  const actor = actorId.trim() || "system";
  const batchId = newBatchId();

  const newRecord = markdownRepository.create({
    journalId: old.journalId,
    journalNumber: old.journalNumber,
    journalLineId: old.journalLineId,
    batchId,
    batchSequenceIndex: 1,
    batchSequenceTotal: 1,
    itemId: old.itemId,
    markdownPrice: old.markdownPrice,
    reasonCode: old.reasonCode,
    status: "ACTIVE",
    createdAt: now,
    createdBy: actor,
    warehouseId: old.warehouseId,
    style: "MARKDOWN",
    originalBarcode: old.originalBarcode ?? item.barcode,
    comment: old.comment,
    basePriceAtMarkdown: old.basePriceAtMarkdown ?? item.salePrice,
    printCount: 0,
    supersedesMarkdownId: old.id,
    quantity: 1,
  });

  const closed = markdownRepository.update(old.id, {
    status: "SUPERSEDED",
    closedAt: now,
    closedBy: actor,
    supersededByMarkdownId: newRecord.id,
  });
  if (!closed) {
    return { success: false, error: "Failed to close superseded record." };
  }
  return { success: true, oldRecord: closed, newRecord };
}

export { isFinalMarkdownStatus };
