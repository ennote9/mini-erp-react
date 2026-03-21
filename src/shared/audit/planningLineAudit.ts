import type { AuditEntityType, AuditEventInput } from "./eventLogTypes";
import { appendAuditEvents } from "./eventLogRepository";

type LineSnap = {
  lineId: string;
  itemId: string;
  itemCode: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode?: string;
};

function byItemId(lines: LineSnap[]): Map<string, LineSnap> {
  const m = new Map<string, LineSnap>();
  for (const l of lines) m.set(l.itemId, l);
  return m;
}

/**
 * After repository replace, emit line-level audit events. Call with old lines (with ids) and new normalized lines, then pass fresh lines from DB for new ids.
 */
export function appendPlanningLineChangeAudit(params: {
  entityType: Extract<AuditEntityType, "purchase_order" | "sales_order">;
  entityId: string;
  documentNumber: string;
  oldLines: Array<{
    id: string;
    itemId: string;
    qty: number;
    unitPrice: number;
    zeroPriceReasonCode?: string;
  }>;
  newLinesFromDb: Array<{
    id: string;
    itemId: string;
    qty: number;
    unitPrice: number;
    zeroPriceReasonCode?: string;
  }>;
  itemCode: (itemId: string) => string;
}): void {
  const { entityType, entityId, documentNumber, oldLines, newLinesFromDb, itemCode } = params;

  const oldSnaps: LineSnap[] = oldLines.map((l) => ({
    lineId: l.id,
    itemId: l.itemId,
    itemCode: itemCode(l.itemId),
    qty: l.qty,
    unitPrice: l.unitPrice,
    zeroPriceReasonCode: l.zeroPriceReasonCode,
  }));

  const newSnaps: LineSnap[] = newLinesFromDb.map((l) => ({
    lineId: l.id,
    itemId: l.itemId,
    itemCode: itemCode(l.itemId),
    qty: l.qty,
    unitPrice: l.unitPrice,
    zeroPriceReasonCode: l.zeroPriceReasonCode,
  }));

  const oldM = byItemId(oldSnaps);
  const newM = byItemId(newSnaps);

  const events: AuditEventInput[] = [];

  for (const old of oldSnaps) {
    if (!newM.has(old.itemId)) {
      events.push({
        entityType,
        entityId,
        eventType: "line_removed",
        actor: "local-user",
        payload: {
          documentNumber,
          lineId: old.lineId,
          itemId: old.itemId,
          itemCode: old.itemCode,
          qty: old.qty,
          unitPrice: old.unitPrice,
        },
      });
    }
  }

  for (const neu of newSnaps) {
    if (!oldM.has(neu.itemId)) {
      events.push({
        entityType,
        entityId,
        eventType: "line_added",
        actor: "local-user",
        payload: {
          documentNumber,
          lineId: neu.lineId,
          itemId: neu.itemId,
          itemCode: neu.itemCode,
          qty: neu.qty,
          unitPrice: neu.unitPrice,
          ...(neu.zeroPriceReasonCode
            ? { zeroPriceReasonCode: neu.zeroPriceReasonCode }
            : {}),
        },
      });
    }
  }

  for (const neu of newSnaps) {
    const old = oldM.get(neu.itemId);
    if (!old) continue;

    if (old.qty !== neu.qty) {
      events.push({
        entityType,
        entityId,
        eventType: "line_qty_changed",
        actor: "local-user",
        payload: {
          documentNumber,
          lineId: neu.lineId,
          itemId: neu.itemId,
          itemCode: neu.itemCode,
          previousQty: old.qty,
          newQty: neu.qty,
        },
      });
    }

    if (old.unitPrice !== neu.unitPrice) {
      events.push({
        entityType,
        entityId,
        eventType: "line_unit_price_changed",
        actor: "local-user",
        payload: {
          documentNumber,
          lineId: neu.lineId,
          itemId: neu.itemId,
          itemCode: neu.itemCode,
          previousUnitPrice: old.unitPrice,
          newUnitPrice: neu.unitPrice,
        },
      });
    }

    const prevZ = old.zeroPriceReasonCode ?? "";
    const nextZ = neu.zeroPriceReasonCode ?? "";
    if (prevZ !== nextZ) {
      events.push({
        entityType,
        entityId,
        eventType: "zero_price_reason_changed",
        actor: "local-user",
        payload: {
          documentNumber,
          lineId: neu.lineId,
          itemId: neu.itemId,
          itemCode: neu.itemCode,
          previousReason: prevZ || null,
          newReason: nextZ || null,
        },
      });
    }
  }

  if (events.length > 0) appendAuditEvents(events);
}

/** Header field names for PO/SO save audit. */
export function planningHeaderChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): string[] {
  const changed: string[] = [];
  for (const k of keys) {
    if (before[k] !== after[k]) changed.push(k);
  }
  return changed;
}
