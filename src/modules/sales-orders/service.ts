import { salesOrderRepository } from "./repository";
import { shipmentRepository } from "../shipments/repository";
import { customerRepository } from "../customers/repository";
import { carrierRepository } from "../carriers/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { normalizeDateForSO, validateDateForSO } from "./dateUtils";
import {
  parseDocumentLineQty,
  normalizeDocumentComment,
  validatePlanningLineUnitPrices,
  validatePlanningLinesZeroPriceReasons,
} from "../../shared/documentValidation";
import { normalizeTrim, validatePhone } from "../../shared/validation";
import { parseCommercialUnitPrice } from "../../shared/commercialMoney";
import {
  computePlanningDueDate,
  parsePaymentTermsDaysToStore,
  validatePaymentTermsDaysForm,
} from "../../shared/planningCommercialDates";
import {
  resolveCancelDocumentReasonForService,
  zeroPriceReasonCodeForStore,
  type CancelDocumentReasonInput,
} from "../../shared/reasonCodes";
import { getAppSettings } from "../../shared/settings/store";
import { appendAuditEvent } from "../../shared/audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "../../shared/audit/eventLogTypes";
import { auditShipmentDocumentCreated } from "../../shared/audit/factualDocumentAudit";
import {
  appendPlanningLineChangeAudit,
  planningHeaderChangedFields,
} from "../../shared/audit/planningLineAudit";
import {
  computeSalesOrderFulfillment,
  isSalesOrderShipmentFulfillmentComplete,
} from "../../shared/planningFulfillment";
import { stockReservationRepository } from "../stock-reservations/repository";
import { stockBalanceRepository } from "../stock-balances/repository";
import { reconcileSalesOrderReservations } from "../../shared/soReservationReconcile";
import type { SalesOrder } from "./model";
import { computeSalesOrderAllocationView } from "../../shared/soAllocation";
import { markdownRepository } from "../markdown-journal/repository";

export { reconcileSalesOrderReservations };
export type {
  ReconcileSalesOrderReservationsReason,
  ReconcileSalesOrderReservationsResult,
} from "../../shared/soReservationReconcile";

export type ConfirmResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

export type CreateShipmentResult =
  | { success: true; shipmentId: string }
  | { success: false; error: string };

export type SaveDraftInput = {
  date: string;
  customerId: string;
  warehouseId: string;
  preliminaryShipmentDate?: string;
  actualShipmentDate?: string;
  /** Empty / whitespace normalized to undefined on save. */
  carrierId?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  deliveryComment?: string;
  paymentTermsDays?: string;
  comment?: string;
  lines: Array<{
    itemId: string;
    qty: number;
    unitPrice?: number;
    markdownCode?: string;
    zeroPriceReasonCode?: string;
  }>;
};
export type SaveDraftResult =
  | { success: true; id: string }
  | { success: false; error: string };

function normalizeOptionalSODate(value: string | undefined): string | undefined {
  const trimmed = normalizeTrim(value);
  if (trimmed === "") return undefined;
  return normalizeDateForSO(trimmed);
}

export type AllocateStockResult =
  | { success: true; linesTouched: number }
  | { success: false; error: string };

function collectPostedShipmentMarkdownCodes(): Set<string> {
  const used = new Set<string>();
  for (const sh of shipmentRepository.list()) {
    if (sh.status !== "posted") continue;
    for (const line of shipmentRepository.listLines(sh.id)) {
      const code = normalizeTrim(line.markdownCode);
      if (code !== "") used.add(code.toUpperCase());
    }
  }
  return used;
}

function validateSalesOrderLines(
  lines: Array<{ itemId: string; qty: number; markdownCode?: string }>,
  warehouseId: string,
): string | null {
  if (!lines || lines.length === 0) return "At least one line is required.";
  const usedPostedMarkdownCodes = collectPostedShipmentMarkdownCodes();
  const seenMarkdownCodes = new Set<string>();
  const seenRegularItems = new Set<string>();
  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    if (itemIdTrimmed === "") return "Each line must have an item.";
    const qty = parseDocumentLineQty(line.qty);
    if (qty === null) return "Quantity must be greater than zero.";
    const item = itemRepository.getById(itemIdTrimmed);
    if (!item) return "Each line must have an item.";
    if (!item.isActive) return "Selected item is inactive.";

    const markdownCode = normalizeTrim(line.markdownCode).toUpperCase();
    if (markdownCode === "") {
      if (seenRegularItems.has(itemIdTrimmed))
        return "Duplicate items are not allowed in the same document.";
      seenRegularItems.add(itemIdTrimmed);
      continue;
    }

    if (qty !== 1) return "Markdown unit quantity must be 1.";
    if (seenMarkdownCodes.has(markdownCode))
      return "Duplicate markdown units are not allowed in the same document.";
    if (usedPostedMarkdownCodes.has(markdownCode))
      return "Selected markdown unit is already shipped.";

    const mdRecord = markdownRepository.getByCode(markdownCode);
    if (!mdRecord) return "Selected markdown unit does not exist.";
    if (mdRecord.status !== "ACTIVE")
      return "Only active markdown units can be selected.";
    if (mdRecord.itemId !== itemIdTrimmed)
      return "Selected markdown unit does not match the line item.";
    if (normalizeTrim(mdRecord.warehouseId) !== normalizeTrim(warehouseId))
      return "Selected markdown unit belongs to another warehouse.";

    seenMarkdownCodes.add(markdownCode);
  }
  return null;
}

function validateSaveDraft(data: SaveDraftInput): string | null {
  const dateErr = validateDateForSO(data.date);
  if (dateErr) return dateErr;
  const preliminaryShipmentDate = normalizeTrim(data.preliminaryShipmentDate);
  if (preliminaryShipmentDate !== "") {
    const preliminaryDateErr = validateDateForSO(preliminaryShipmentDate);
    if (preliminaryDateErr) return preliminaryDateErr.replace(/^Date\b/, "Preliminary shipment date");
  }
  const actualShipmentDate = normalizeTrim(data.actualShipmentDate);
  if (actualShipmentDate !== "") {
    const actualDateErr = validateDateForSO(actualShipmentDate);
    if (actualDateErr) return actualDateErr.replace(/^Date\b/, "Actual shipment date");
  }
  const customerIdTrimmed = normalizeTrim(data.customerId);
  if (customerIdTrimmed === "") return "Customer is required.";
  const warehouseIdTrimmed = normalizeTrim(data.warehouseId);
  if (warehouseIdTrimmed === "") return "Warehouse is required.";
  const customer = customerRepository.getById(customerIdTrimmed);
  if (!customer) return "Customer is required.";
  if (!customer.isActive) return "Selected customer is inactive.";
  const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
  if (!warehouse) return "Warehouse is required.";
  if (!warehouse.isActive) return "Selected warehouse is inactive.";
  const lineErr = validateSalesOrderLines(data.lines, warehouseIdTrimmed);
  if (lineErr) return lineErr;
  const priceErr = validatePlanningLineUnitPrices(data.lines);
  if (priceErr) return priceErr;
  const zpErr = validatePlanningLinesZeroPriceReasons(data.lines);
  if (zpErr) return zpErr;
  const termsErr = validatePaymentTermsDaysForm(data.paymentTermsDays);
  if (termsErr) return termsErr;
  const phoneErr = validatePhone(data.recipientPhone);
  if (phoneErr) return phoneErr;
  return null;
}

function normalizeSOLines(
  lines: Array<{
    itemId: string;
    qty: number;
    unitPrice?: number;
    markdownCode?: string;
    zeroPriceReasonCode?: string;
  }>,
): Array<{
  itemId: string;
  qty: number;
  unitPrice: number;
  markdownCode?: string;
  zeroPriceReasonCode?: string;
}> | null {
  const out: Array<{
    itemId: string;
    qty: number;
    unitPrice: number;
    markdownCode?: string;
    zeroPriceReasonCode?: string;
  }> = [];
  for (const l of lines) {
    const qty = parseDocumentLineQty(l.qty);
    if (qty === null) return null;
    const unitPrice = parseCommercialUnitPrice(l.unitPrice);
    if (unitPrice === null) return null;
    const zpr = zeroPriceReasonCodeForStore(unitPrice, l.zeroPriceReasonCode);
    const row: {
      itemId: string;
      qty: number;
      unitPrice: number;
      markdownCode?: string;
      zeroPriceReasonCode?: string;
    } = {
      itemId: normalizeTrim(l.itemId),
      qty,
      unitPrice,
    };
    const markdownCode = normalizeTrim(l.markdownCode);
    if (markdownCode !== "") row.markdownCode = markdownCode.toUpperCase();
    if (zpr !== undefined) row.zeroPriceReasonCode = zpr;
    out.push(row);
  }
  return out;
}

function itemCodeForAudit(itemId: string): string {
  return itemRepository.getById(itemId)?.code ?? itemId;
}

function soHeaderFlat(so: SalesOrder) {
  return {
    date: so.date,
    customerId: so.customerId,
    warehouseId: so.warehouseId,
    preliminaryShipmentDate: so.preliminaryShipmentDate ?? "",
    actualShipmentDate: so.actualShipmentDate ?? "",
    carrierId: so.carrierId ?? "",
    recipientName: so.recipientName ?? "",
    recipientPhone: so.recipientPhone ?? "",
    deliveryAddress: so.deliveryAddress ?? "",
    deliveryComment: so.deliveryComment ?? "",
    comment: so.comment ?? "",
    paymentTermsDays: so.paymentTermsDays ?? null,
    dueDate: so.dueDate ?? null,
  };
}

export function saveDraft(
  data: SaveDraftInput,
  existingId?: string,
): SaveDraftResult {
  const err = validateSaveDraft(data);
  if (err) return { success: false, error: err };

  const date = normalizeDateForSO(data.date);
  const customerId = normalizeTrim(data.customerId);
  const warehouseId = normalizeTrim(data.warehouseId);
  const preliminaryShipmentDate = normalizeOptionalSODate(data.preliminaryShipmentDate);
  const actualShipmentDate = normalizeOptionalSODate(data.actualShipmentDate);
  const comment = normalizeDocumentComment(data.comment);
  const paymentTermsDays = parsePaymentTermsDaysToStore(data.paymentTermsDays);
  const dueDate = computePlanningDueDate(date, paymentTermsDays);
  const lines = normalizeSOLines(data.lines);
  if (lines === null)
    return { success: false, error: "Each line must have a valid unit price (number ≥ 0)." };

  const carrierRaw = data.carrierId != null ? normalizeTrim(data.carrierId) : "";
  const carrierId = carrierRaw === "" ? undefined : carrierRaw;

  const recipientNameRaw = data.recipientName != null ? normalizeTrim(data.recipientName) : "";
  const recipientName = recipientNameRaw === "" ? undefined : recipientNameRaw;

  const recipientPhoneRaw = data.recipientPhone != null ? normalizeTrim(data.recipientPhone) : "";
  const recipientPhone = recipientPhoneRaw === "" ? undefined : recipientPhoneRaw;

  const deliveryAddressRaw = data.deliveryAddress != null ? normalizeTrim(data.deliveryAddress) : "";
  const deliveryAddress = deliveryAddressRaw === "" ? undefined : deliveryAddressRaw;

  const deliveryCommentRaw =
    data.deliveryComment != null ? normalizeTrim(data.deliveryComment) : "";
  const deliveryComment = deliveryCommentRaw === "" ? undefined : deliveryCommentRaw;

  const header = {
    date,
    customerId,
    warehouseId,
    status: "draft" as const,
    ...(preliminaryShipmentDate ? { preliminaryShipmentDate } : {}),
    ...(actualShipmentDate ? { actualShipmentDate } : {}),
    comment: comment ?? "",
    paymentTermsDays,
    dueDate,
    carrierId,
    recipientName,
    recipientPhone,
    deliveryAddress,
    deliveryComment,
  };
  if (existingId) {
    const so = salesOrderRepository.getById(existingId);
    if (!so) return { success: false, error: "Sales order not found." };
    if (so.status !== "draft")
      return { success: false, error: "Only draft sales orders can be saved." };
    const oldLines = salesOrderRepository.listLines(existingId);
    const beforeHeader = soHeaderFlat(so);
    salesOrderRepository.update(existingId, header);
    salesOrderRepository.replaceLines(existingId, lines);
    const soAfter = salesOrderRepository.getById(existingId)!;
    const newLines = salesOrderRepository.listLines(existingId);
    const afterHeader = soHeaderFlat(soAfter);
    const changedFields = planningHeaderChangedFields(
      beforeHeader as unknown as Record<string, unknown>,
      afterHeader as unknown as Record<string, unknown>,
      [
        "date",
        "customerId",
        "warehouseId",
        "preliminaryShipmentDate",
        "actualShipmentDate",
        "carrierId",
        "recipientName",
        "recipientPhone",
        "deliveryAddress",
        "deliveryComment",
        "comment",
        "paymentTermsDays",
        "dueDate",
      ],
    );
    if (changedFields.length > 0) {
      appendAuditEvent({
        entityType: "sales_order",
        entityId: existingId,
        eventType: "document_saved",
        actor: AUDIT_ACTOR_LOCAL_USER,
        payload: {
          documentNumber: soAfter.number,
          changedFields,
        },
      });
    }
    appendPlanningLineChangeAudit({
      entityType: "sales_order",
      entityId: existingId,
      documentNumber: soAfter.number,
      oldLines,
      newLinesFromDb: newLines,
      itemCode: itemCodeForAudit,
    });
    if (getAppSettings().inventory.reconcileReservationsOnSalesOrderSaveConfirm) {
      reconcileSalesOrderReservations(existingId, { reason: "save_draft" });
    }
    return { success: true, id: existingId };
  }
  const created = salesOrderRepository.create(header, lines);
  const doc = salesOrderRepository.getById(created.id)!;
  const createdLines = salesOrderRepository.listLines(created.id);
  appendAuditEvent({
    entityType: "sales_order",
    entityId: created.id,
    eventType: "document_created",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: doc.number,
      status: doc.status,
      lineCount: createdLines.length,
      lines: createdLines.map((l) => ({
        lineId: l.id,
        itemId: l.itemId,
        itemCode: itemCodeForAudit(l.itemId),
        qty: l.qty,
        unitPrice: l.unitPrice,
        ...(l.markdownCode ? { markdownCode: l.markdownCode } : {}),
        ...(l.zeroPriceReasonCode ? { zeroPriceReasonCode: l.zeroPriceReasonCode } : {}),
      })),
    },
  });
  return { success: true, id: created.id };
}

function validateConfirm(soId: string): string | null {
  const so = salesOrderRepository.getById(soId);
  if (!so) return "Sales order not found.";
  if (so.status !== "draft")
    return "Only draft sales orders can be confirmed.";

  if (!so.date?.trim()) return "Date is required.";
  if (!so.customerId?.trim()) return "Customer is required.";
  if (!so.warehouseId?.trim()) return "Warehouse is required.";

  const customer = customerRepository.getById(so.customerId);
  if (!customer?.isActive) return "Selected customer is inactive.";
  const warehouse = warehouseRepository.getById(so.warehouseId);
  if (!warehouse?.isActive) return "Selected warehouse is inactive.";

  const soCarrierTrim = normalizeTrim(so.carrierId ?? "");
  if (soCarrierTrim !== "") {
    const car = carrierRepository.getById(soCarrierTrim);
    if (!car) return "Selected carrier is not valid.";
  }

  const lines = salesOrderRepository.listLines(soId);
  const lineErr = validateSalesOrderLines(lines, so.warehouseId);
  if (lineErr) return lineErr;
  const priceErr = validatePlanningLineUnitPrices(lines);
  if (priceErr) return priceErr;
  const zpErr = validatePlanningLinesZeroPriceReasons(lines);
  if (zpErr) return zpErr;
  const phoneErr = validatePhone(so.recipientPhone);
  if (phoneErr) return phoneErr;
  return null;
}

export function confirm(soId: string): ConfirmResult {
  const err = validateConfirm(soId);
  if (err) return { success: false, error: err };
  const so = salesOrderRepository.getById(soId)!;
  salesOrderRepository.update(soId, { status: "confirmed" });
  if (getAppSettings().inventory.reconcileReservationsOnSalesOrderSaveConfirm) {
    reconcileSalesOrderReservations(soId, { reason: "confirm" });
  }
  appendAuditEvent({
    entityType: "sales_order",
    entityId: soId,
    eventType: "document_confirmed",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: so.number,
      previousStatus: so.status,
      newStatus: "confirmed" as const,
    },
  });
  return { success: true };
}

export function allocateStock(soId: string): AllocateStockResult {
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "confirmed") {
    return { success: false, error: "Only confirmed sales orders can allocate stock." };
  }
  const warehouseId = normalizeTrim(so.warehouseId);
  if (warehouseId === "") return { success: false, error: "Warehouse is required." };

  reconcileSalesOrderReservations(soId, { reason: "allocate_stock" });

  const fulfillment = computeSalesOrderFulfillment(soId);
  let linesTouched = 0;

  for (const line of fulfillment.lines) {
    const R = stockReservationRepository.getActiveQtyForSalesOrderLine(soId, line.lineId);
    if (line.remainingQty <= 0) {
      if (R > 0) linesTouched++;
      stockReservationRepository.upsertActiveForSalesOrderLine({
        salesOrderId: soId,
        salesOrderLineId: line.lineId,
        warehouseId,
        itemId: line.itemId,
        qty: 0,
      });
      continue;
    }
    const T = stockReservationRepository.sumActiveQtyForWarehouseItem(warehouseId, line.itemId);
    const onHand =
      stockBalanceRepository.getByItemAndWarehouse(line.itemId, warehouseId)?.qtyOnHand ?? 0;
    const cap = Math.min(line.remainingQty, Math.max(0, onHand - (T - R)));
    if (cap !== R) linesTouched++;
    stockReservationRepository.upsertActiveForSalesOrderLine({
      salesOrderId: soId,
      salesOrderLineId: line.lineId,
      warehouseId,
      itemId: line.itemId,
      qty: cap,
    });
  }

  appendAuditEvent({
    entityType: "sales_order",
    entityId: soId,
    eventType: "stock_allocated",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: so.number,
      linesTouched,
    },
  });
  return { success: true, linesTouched };
}

export function cancelDocument(
  soId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const resolved = resolveCancelDocumentReasonForService(
    input,
    getAppSettings().documents.requireCancelReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "draft" && so.status !== "confirmed")
    return {
      success: false,
      error: "Only draft or confirmed sales orders can be cancelled.",
    };
  const code = resolved.code;
  const comment = resolved.comment;
  const prevStatus = so.status;
  const reservationsReleased = getAppSettings().inventory.releaseReservationsOnSalesOrderCancel
    ? stockReservationRepository.releaseAllActiveForSalesOrder(soId)
    : 0;
  salesOrderRepository.update(soId, {
    status: "cancelled",
    cancelReasonCode: code,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  appendAuditEvent({
    entityType: "sales_order",
    entityId: soId,
    eventType: "document_cancelled",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: so.number,
      previousStatus: prevStatus,
      newStatus: "cancelled" as const,
      cancelReasonCode: code,
      cancelReasonComment: comment ?? null,
    },
  });
  if (reservationsReleased > 0) {
    appendAuditEvent({
      entityType: "sales_order",
      entityId: soId,
      eventType: "reservation_released",
      actor: AUDIT_ACTOR_LOCAL_USER,
      payload: {
        documentNumber: so.number,
        reservationsReleased,
        reason: "sales_order_cancelled",
      },
    });
  }
  return { success: true };
}

function hasDraftShipmentForSo(soId: string): boolean {
  return shipmentRepository
    .list()
    .some((s) => s.salesOrderId === soId && s.status === "draft");
}

export function createShipment(soId: string): CreateShipmentResult {
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "confirmed")
    return {
      success: false,
      error: "Only confirmed sales orders can have a shipment created.",
    };
  if (isSalesOrderShipmentFulfillmentComplete(soId)) {
    return {
      success: false,
      error: "Sales order is already fully shipped (posted shipments).",
    };
  }
  if (
    getAppSettings().documents.singleDraftShipmentPerSalesOrder &&
    hasDraftShipmentForSo(soId)
  ) {
    return {
      success: false,
      error: "A draft shipment already exists for this sales order.",
    };
  }

  if (getAppSettings().inventory.requireReservationBeforeShipment) {
    const alloc = computeSalesOrderAllocationView(soId);
    const unreserved = alloc.lines.some(
      (l) => l.remainingQty > 0 && l.reservedQty < l.remainingQty,
    );
    if (unreserved) {
      return {
        success: false,
        error:
          "Each open line must be fully reserved before creating a shipment. Use Allocate stock on the sales order.",
      };
    }
  }

  const soLines = salesOrderRepository.listLines(soId);
  const postedShipments = shipmentRepository
    .list()
    .filter((s) => s.salesOrderId === soId && s.status === "posted");
  const shippedRegularByItem = new Map<string, number>();
  const shippedMarkdownCodes = new Set<string>();
  for (const sh of postedShipments) {
    for (const line of shipmentRepository.listLines(sh.id)) {
      const markdownCode = normalizeTrim(line.markdownCode).toUpperCase();
      if (markdownCode !== "") {
        shippedMarkdownCodes.add(markdownCode);
        continue;
      }
      shippedRegularByItem.set(line.itemId, (shippedRegularByItem.get(line.itemId) ?? 0) + line.qty);
    }
  }
  const shipmentLines = soLines.flatMap((line) => {
    const markdownCode = normalizeTrim(line.markdownCode).toUpperCase();
    if (markdownCode !== "") {
      if (shippedMarkdownCodes.has(markdownCode)) return [];
      return [{ itemId: line.itemId, qty: 1, markdownCode }];
    }
    const remainingQty = Math.max(0, line.qty - (shippedRegularByItem.get(line.itemId) ?? 0));
    if (remainingQty < 1) return [];
    return [{ itemId: line.itemId, qty: remainingQty }];
  });
  if (shipmentLines.length === 0) {
    return {
      success: false,
      error: "Nothing remaining to ship for this sales order.",
    };
  }

  let defaultCarrierId: string | undefined;
  const soCarrierTrim = normalizeTrim(so.carrierId ?? "");
  if (soCarrierTrim !== "") {
    const soCar = carrierRepository.getById(soCarrierTrim);
    if (soCar) {
      defaultCarrierId = soCar.id;
    } else if (import.meta.env.DEV) {
      console.warn(
        "[createShipment] sales order carrier id not found, falling back to customer preferred:",
        soCarrierTrim,
      );
    }
  }
  if (defaultCarrierId === undefined) {
    const custId = normalizeTrim(so.customerId);
    if (custId !== "") {
      const customer = customerRepository.getById(custId);
      const pref = customer?.preferredCarrierId?.trim() ?? "";
      if (pref !== "") {
        const carrier = carrierRepository.getById(pref);
        if (carrier) {
          defaultCarrierId = carrier.id;
        } else if (import.meta.env.DEV) {
          console.warn(
            "[createShipment] customer preferred carrier id not found, skipping default:",
            pref,
          );
        }
      }
    }
  }

  const shipment = shipmentRepository.create(
    {
      date: so.date,
      salesOrderId: soId,
      warehouseId: so.warehouseId,
      status: "draft",
      ...(defaultCarrierId !== undefined ? { carrierId: defaultCarrierId } : {}),
      ...(so.recipientName !== undefined && so.recipientName !== ""
        ? { recipientName: so.recipientName }
        : {}),
      ...(so.recipientPhone !== undefined && so.recipientPhone !== ""
        ? { recipientPhone: so.recipientPhone }
        : {}),
      ...(so.deliveryAddress !== undefined && so.deliveryAddress !== ""
        ? { deliveryAddress: so.deliveryAddress }
        : {}),
      ...(so.deliveryComment !== undefined && so.deliveryComment !== ""
        ? { deliveryComment: so.deliveryComment }
        : {}),
    },
    shipmentLines,
  );
  auditShipmentDocumentCreated(shipment);
  return { success: true, shipmentId: shipment.id };
}

export const salesOrderService = {
  confirm,
  cancelDocument,
  createShipment,
  saveDraft,
  allocateStock,
  reconcileSalesOrderReservations,
};
