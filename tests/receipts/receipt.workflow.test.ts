import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockFs } from "../support/tauriFsMock";

type WorkflowModules = Awaited<ReturnType<typeof loadWorkflow>>;

async function loadWorkflow() {
  resetMockFs();
  vi.resetModules();
  const poService = await import("../../src/modules/purchase-orders/service");
  const poRepositoryModule = await import("../../src/modules/purchase-orders/repository");
  const receiptServiceModule = await import("../../src/modules/receipts/service");
  const receiptRepositoryModule = await import("../../src/modules/receipts/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockMovementRepositoryModule = await import("../../src/modules/stock-movements/repository");
  const auditModule = await import("../../src/shared/audit/eventLogRepository");
  const fulfillmentModule = await import("../../src/shared/planningFulfillment");
  const itemRepositoryModule = await import("../../src/modules/items/repository");
  const warehouseRepositoryModule = await import("../../src/modules/warehouses/repository");

  return {
    confirmPurchaseOrder: poService.confirm,
    createReceiptFromPurchaseOrder: poService.createReceipt,
    purchaseOrderRepository: poRepositoryModule.purchaseOrderRepository,
    receiptService: receiptServiceModule,
    receiptRepository: receiptRepositoryModule.receiptRepository,
    stockBalanceRepository: stockBalanceRepositoryModule.stockBalanceRepository,
    stockMovementRepository: stockMovementRepositoryModule.stockMovementRepository,
    listAuditEventsForEntity: auditModule.listAuditEventsForEntity,
    computePurchaseOrderFulfillment: fulfillmentModule.computePurchaseOrderFulfillment,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
  };
}

function draftPurchaseOrderHeader() {
  return draftPurchaseOrderHeaderForWarehouse("1");
}

function draftPurchaseOrderHeaderForWarehouse(warehouseId: string) {
  return {
    date: "2026-03-30",
    supplierId: "1",
    warehouseId,
    status: "draft" as const,
    comment: "",
  };
}

let warehouseSeq = 1;
let itemSeq = 1;

function createActiveWarehouse(modules: WorkflowModules) {
  const seq = warehouseSeq++;
  return modules.warehouseRepository.create({
    code: `TEST-WH-${seq}`,
    name: `Test Warehouse ${seq}`,
    isActive: true,
  });
}

function createActiveItem(modules: WorkflowModules) {
  const seq = itemSeq++;
  return modules.itemRepository.create({
    code: `TEST-ITEM-${seq}`,
    name: `Test Item ${seq}`,
    uom: "EA",
    isActive: true,
  });
}

async function createConfirmedPurchaseOrder(
  modules: WorkflowModules,
  lines: Array<{ itemId: string; qty: number; unitPrice: number }>,
) {
  const warehouse = createActiveWarehouse(modules);
  const po = modules.purchaseOrderRepository.create(
    draftPurchaseOrderHeaderForWarehouse(warehouse.id),
    lines,
  );
  const confirmResult = modules.confirmPurchaseOrder(po.id);
  expect(confirmResult).toEqual({ success: true });
  return modules.purchaseOrderRepository.getById(po.id)!;
}

beforeEach(() => {
  resetMockFs();
  vi.clearAllMocks();
  warehouseSeq = 1;
  itemSeq = 1;
});

afterEach(async () => {
  const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
  await flushAllPendingPersistence();
});

describe.sequential("Receipt workflow", () => {
  it("creates a draft receipt from a confirmed purchase order using remaining quantities", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);

    modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "posted",
      },
      [{ itemId: "1", qty: 4 }],
    );

    const result = modules.createReceiptFromPurchaseOrder(po.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const receipt = modules.receiptRepository.getById(result.receiptId);
    expect(receipt).toMatchObject({
      purchaseOrderId: po.id,
      warehouseId: po.warehouseId,
      status: "draft",
    });
    expect(modules.receiptRepository.listLines(result.receiptId)).toEqual([
      expect.objectContaining({ itemId: "1", qty: 6 }),
    ]);

    const audit = modules.listAuditEventsForEntity("receipt", result.receiptId);
    expect(audit[0]).toMatchObject({
      eventType: "document_created",
      entityType: "receipt",
      entityId: result.receiptId,
    });
  });

  it("refuses receipt creation for invalid purchase order states", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);

    const draftPo = modules.purchaseOrderRepository.create(
      draftPurchaseOrderHeaderForWarehouse(warehouse.id),
      [{ itemId: "1", qty: 10, unitPrice: 1 }],
    );
    expect(modules.createReceiptFromPurchaseOrder(draftPo.id)).toEqual({
      success: false,
      error: "Only confirmed purchase orders can have a receipt created.",
    });

    const confirmedPo = await createConfirmedPurchaseOrder(modules, [
      { itemId: "1", qty: 10, unitPrice: 1 },
    ]);
    modules.receiptRepository.create(
      {
        date: confirmedPo.date,
        purchaseOrderId: confirmedPo.id,
        warehouseId: confirmedPo.warehouseId,
        status: "posted",
      },
      [{ itemId: "1", qty: 10 }],
    );

    expect(modules.createReceiptFromPurchaseOrder(confirmedPo.id)).toEqual({
      success: false,
      error: "Purchase order is already fully received (posted receipts).",
    });
  });

  it("posts only draft receipts and updates stock, purchase order status, and audit", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    const beforeBalance =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle("1", po.warehouseId, "GOOD")?.qtyOnHand ?? 0;

    const postResult = modules.receiptService.post(receiptId);
    expect(postResult).toEqual({ success: true });

    const receipt = modules.receiptRepository.getById(receiptId);
    expect(receipt?.status).toBe("posted");

    const afterBalance =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle("1", po.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    expect(afterBalance - beforeBalance).toBe(10);

    const movements = modules.stockMovementRepository
      .list()
      .filter((row) => row.sourceDocumentType === "receipt" && row.sourceDocumentId === receiptId);
    expect(movements).toEqual([
      expect.objectContaining({
        movementType: "receipt",
        itemId: "1",
        warehouseId: po.warehouseId,
        style: "GOOD",
        qtyDelta: 10,
      }),
    ]);

    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("closed");

    const audit = modules.listAuditEventsForEntity("receipt", receiptId);
    expect(audit.map((row) => row.eventType)).toContain("document_posted");

    const repostResult = modules.receiptService.post(receiptId);
    expect(repostResult.success).toBe(false);
    if (repostResult.success) return;
    expect(repostResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          i18nKey: "issues.receipt.onlyDraftPost",
          message: "Only draft receipts can be posted.",
        }),
      ]),
    );
  });

  it("cancels only draft receipts without inventory impact and writes audit", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    const balanceBefore = modules.stockBalanceRepository.list();
    const movementsBefore = modules.stockMovementRepository.list();

    const cancelResult = modules.receiptService.cancelDocument(receiptId, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "No longer needed",
    });
    expect(cancelResult).toEqual({ success: true });

    const receipt = modules.receiptRepository.getById(receiptId);
    expect(receipt).toMatchObject({
      status: "cancelled",
      cancelReasonCode: "OTHER",
      cancelReasonComment: "No longer needed",
    });
    expect(modules.stockBalanceRepository.list()).toEqual(balanceBefore);
    expect(modules.stockMovementRepository.list()).toEqual(movementsBefore);

    const audit = modules.listAuditEventsForEntity("receipt", receiptId);
    expect(audit.map((row) => row.eventType)).toContain("document_cancelled");

    const recancel = modules.receiptService.cancelDocument(receiptId, { cancelReasonCode: "OTHER" });
    expect(recancel).toEqual({
      success: false,
      error: "Only draft receipts can be cancelled.",
    });
  });

  it("reverses posted receipts with compensating movements and purchase order reopen", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    expect(modules.receiptService.post(receiptId)).toEqual({ success: true });
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("closed");

    const reverseResult = modules.receiptService.reverseDocument(receiptId, {
      reversalReasonCode: "OTHER",
      reversalReasonComment: "Undo inbound",
    });
    expect(reverseResult).toEqual({ success: true });

    const receipt = modules.receiptRepository.getById(receiptId);
    expect(receipt).toMatchObject({
      status: "reversed",
      reversalReasonCode: "OTHER",
      reversalReasonComment: "Undo inbound",
    });

    const balance =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle("1", po.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    expect(balance).toBe(0);

    const movements = modules.stockMovementRepository
      .list()
      .filter((row) => row.sourceDocumentId === receiptId)
      .map((row) => ({ movementType: row.movementType, qtyDelta: row.qtyDelta }));
    expect(movements).toEqual(
      expect.arrayContaining([
        { movementType: "receipt", qtyDelta: 10 },
        { movementType: "receipt_reversal", qtyDelta: -10 },
      ]),
    );

    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("confirmed");

    const audit = modules.listAuditEventsForEntity("receipt", receiptId);
    expect(audit.map((row) => row.eventType)).toContain("document_reversed");
  });

  it("fails reversal when on-hand stock is insufficient", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    expect(modules.receiptService.post(receiptId)).toEqual({ success: true });

    modules.stockBalanceRepository.adjustQty({
      itemId: "1",
      warehouseId: po.warehouseId,
      style: "GOOD",
      qtyDelta: -6,
    });

    const reverseResult = modules.receiptService.reverseDocument(receiptId, {
      reversalReasonCode: "OTHER",
      reversalReasonComment: "Undo inbound",
    });
    expect(reverseResult).toEqual({
      success: false,
      error: "Item ITEM-001: insufficient stock to reverse receipt (available 4, required 10).",
    });
    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("posted");
  });

  it("blocks over-receiving beyond ordered quantity", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);

    modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "posted",
      },
      [{ itemId: "1", qty: 8 }],
    );

    const draftReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [{ itemId: "1", qty: 3 }],
    );

    const issues = modules.receiptService.validateReceiptFull(draftReceipt.id);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          i18nKey: "issues.receipt.qtyExceedsRemaining",
        }),
      ]),
    );
  });

  it("blocks invalid qty, duplicate items, missing or inactive item, and invalid or inactive warehouse", async () => {
    const modules = await loadWorkflow();
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: "1", qty: 10, unitPrice: 1 }]);

    const invalidQtyReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [{ itemId: "1", qty: 0 }],
    );
    expect(modules.receiptService.validateReceiptFull(invalidQtyReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.qtyPositive" }),
      ]),
    );

    const duplicateReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [
        { itemId: "1", qty: 2 },
        { itemId: "1", qty: 1 },
      ],
    );
    expect(modules.receiptService.validateReceiptFull(duplicateReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.duplicateItems" }),
      ]),
    );

    const missingItemReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [{ itemId: "999999", qty: 1 }],
    );
    expect(modules.receiptService.validateReceiptFull(missingItemReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.lineNeedsItem" }),
      ]),
    );

    modules.itemRepository.update("1", { isActive: false });
    const inactiveItemReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [{ itemId: "1", qty: 1 }],
    );
    expect(modules.receiptService.validateReceiptFull(inactiveItemReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.itemInactive" }),
      ]),
    );

    const missingWarehouseReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: "999999",
        status: "draft",
      },
      [{ itemId: "1", qty: 1 }],
    );
    expect(modules.receiptService.validateReceiptFull(missingWarehouseReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.warehouseRequired" }),
      ]),
    );

    modules.warehouseRepository.update(po.warehouseId, { isActive: false });
    const inactiveWarehouseReceipt = modules.receiptRepository.create(
      {
        date: po.date,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        status: "draft",
      },
      [{ itemId: "1", qty: 1 }],
    );
    expect(modules.receiptService.validateReceiptFull(inactiveWarehouseReceipt.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.receipt.warehouseInactive" }),
      ]),
    );
  });

  it("counts only posted receipts toward purchase-order fulfillment", async () => {
    const modules = await loadWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);

    const draftCreate = modules.createReceiptFromPurchaseOrder(po.id);
    expect(draftCreate.success).toBe(true);
    if (!draftCreate.success) return;

    const draftFulfillment = modules.computePurchaseOrderFulfillment(po.id);
    expect(draftFulfillment.totalReceived).toBe(0);
    expect(draftFulfillment.postedReceiptCount).toBe(0);
    expect(draftFulfillment.state).toBe("not_started");

    expect(
      modules.receiptService.cancelDocument(draftCreate.receiptId, { cancelReasonCode: "OTHER" }),
    ).toEqual({ success: true });
    const cancelledFulfillment = modules.computePurchaseOrderFulfillment(po.id);
    expect(cancelledFulfillment.totalReceived).toBe(0);
    expect(cancelledFulfillment.postedReceiptCount).toBe(0);
    expect(cancelledFulfillment.state).toBe("not_started");

    const postedCreate = modules.createReceiptFromPurchaseOrder(po.id);
    expect(postedCreate.success).toBe(true);
    if (!postedCreate.success) return;

    expect(modules.receiptService.post(postedCreate.receiptId)).toEqual({ success: true });
    const postedFulfillment = modules.computePurchaseOrderFulfillment(po.id);
    expect(postedFulfillment.totalReceived).toBe(10);
    expect(postedFulfillment.postedReceiptCount).toBe(1);
    expect(postedFulfillment.state).toBe("complete");

    expect(
      modules.receiptService.reverseDocument(postedCreate.receiptId, { reversalReasonCode: "OTHER" }),
    ).toEqual({ success: true });
    const reversedFulfillment = modules.computePurchaseOrderFulfillment(po.id);
    expect(reversedFulfillment.totalReceived).toBe(0);
    expect(reversedFulfillment.postedReceiptCount).toBe(0);
    expect(reversedFulfillment.state).toBe("not_started");
  });
});
