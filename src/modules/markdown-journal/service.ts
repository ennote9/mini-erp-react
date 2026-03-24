import { itemRepository } from "../items/repository";
import { markdownRepository } from "./repository";
import type { MarkdownReasonCode, MarkdownRecord } from "./model";
import {
  assertMarkdownTransitionAllowed,
  isFinalMarkdownStatus,
  type MarkdownDirectTerminalTransition,
} from "./markdownLifecycle";

export type CreateMarkdownBatchInput = {
  itemId: string;
  markdownPrice: number;
  reasonCode: MarkdownReasonCode;
  warehouseId: string;
  locationId?: string;
  quantity: number;
  comment?: string;
  createdBy?: string;
};

function newBatchId(): string {
  return `MB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMarkdownBatch(
  input: CreateMarkdownBatchInput,
): { success: true; records: MarkdownRecord[] } | { success: false; error: string } {
  const item = itemRepository.getById(input.itemId);
  if (!item) return { success: false, error: "Item not found." };
  if (item.itemKind === "TESTER") return { success: false, error: "Markdown creation expects a sellable item." };
  if (!(input.markdownPrice > 0)) return { success: false, error: "Markdown price must be greater than zero." };
  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const createdAt = new Date().toISOString();
  const createdBy = (input.createdBy ?? "system").trim() || "system";
  const records: MarkdownRecord[] = [];
  const batchId = newBatchId();
  for (let i = 0; i < qty; i++) {
    records.push(
      markdownRepository.create({
        batchId,
        batchSequenceIndex: i + 1,
        batchSequenceTotal: qty,
        itemId: item.id,
        markdownPrice: input.markdownPrice,
        reasonCode: input.reasonCode,
        status: "ACTIVE",
        createdAt,
        createdBy,
        warehouseId: input.warehouseId,
        locationId: input.locationId || undefined,
        originalBarcode: item.barcode,
        comment: input.comment || undefined,
        basePriceAtMarkdown: item.salePrice,
        quantity: 1,
      }),
    );
  }
  return { success: true, records };
}

export type TransitionMarkdownInput = {
  recordId: string;
  transition: MarkdownDirectTerminalTransition;
  actorId: string;
};

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
    locationId: old.locationId,
    originalBarcode: old.originalBarcode ?? item.barcode,
    comment: old.comment,
    basePriceAtMarkdown: old.basePriceAtMarkdown ?? item.salePrice,
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
