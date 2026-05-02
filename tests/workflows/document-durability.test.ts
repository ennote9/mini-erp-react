import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMockFsFailures,
  resetMockFs,
} from "../support/tauriFsMock";

type ReceiptModules = Awaited<ReturnType<typeof loadReceiptWorkflow>>;
type ShipmentModules = Awaited<ReturnType<typeof loadShipmentWorkflow>>;

async function loadReceiptWorkflow() {
  resetMockFs();
  vi.resetModules();
  const mockFsModule = await import("../support/tauriFsMock");
  const poService = await import("../../src/modules/purchase-orders/service");
  const poRepositoryModule = await import("../../src/modules/purchase-orders/repository");
  const receiptServiceModule = await import("../../src/modules/receipts/service");
  const receiptRepositoryModule = await import("../../src/modules/receipts/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockMovementRepositoryModule = await import("../../src/modules/stock-movements/repository");
  const auditModule = await import("../../src/shared/audit/eventLogRepository");
  const itemRepositoryModule = await import("../../src/modules/items/repository");
  const warehouseRepositoryModule = await import("../../src/modules/warehouses/repository");
  const persistenceCoordinator = await import("../../src/shared/persistenceCoordinator");

  return {
    confirmPurchaseOrder: poService.confirm,
    createReceiptFromPurchaseOrder: poService.createReceipt,
    purchaseOrderRepository: poRepositoryModule.purchaseOrderRepository,
    receiptService: receiptServiceModule,
    receiptRepository: receiptRepositoryModule.receiptRepository,
    stockBalanceRepository: stockBalanceRepositoryModule.stockBalanceRepository,
    stockMovementRepository: stockMovementRepositoryModule.stockMovementRepository,
    listAuditEventsForEntity: auditModule.listAuditEventsForEntity,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
    flushAllPendingPersistence: persistenceCoordinator.flushAllPendingPersistence,
    mockFs: mockFsModule,
  };
}

async function loadShipmentWorkflow() {
  resetMockFs();
  vi.resetModules();
  const mockFsModule = await import("../support/tauriFsMock");
  const soService = await import("../../src/modules/sales-orders/service");
  const soRepositoryModule = await import("../../src/modules/sales-orders/repository");
  const shipmentServiceModule = await import("../../src/modules/shipments/service");
  const shipmentRepositoryModule = await import("../../src/modules/shipments/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockMovementRepositoryModule = await import("../../src/modules/stock-movements/repository");
  const stockReservationRepositoryModule = await import("../../src/modules/stock-reservations/repository");
  const auditModule = await import("../../src/shared/audit/eventLogRepository");
  const itemRepositoryModule = await import("../../src/modules/items/repository");
  const warehouseRepositoryModule = await import("../../src/modules/warehouses/repository");
  const customerRepositoryModule = await import("../../src/modules/customers/repository");
  const markdownRepositoryModule = await import("../../src/modules/markdown-journal/repository");
  const persistenceCoordinator = await import("../../src/shared/persistenceCoordinator");

  return {
    confirmSalesOrder: soService.confirm,
    allocateSalesOrderStock: soService.allocateStock,
    cancelSalesOrderDocument: soService.cancelDocument,
    createShipmentFromSalesOrder: soService.createShipment,
    salesOrderRepository: soRepositoryModule.salesOrderRepository,
    shipmentService: shipmentServiceModule,
    shipmentRepository: shipmentRepositoryModule.shipmentRepository,
    stockBalanceRepository: stockBalanceRepositoryModule.stockBalanceRepository,
    stockMovementRepository: stockMovementRepositoryModule.stockMovementRepository,
    stockReservationRepository: stockReservationRepositoryModule.stockReservationRepository,
    listAuditEventsForEntity: auditModule.listAuditEventsForEntity,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
    customerRepository: customerRepositoryModule.customerRepository,
    markdownRepository: markdownRepositoryModule.markdownRepository,
    flushAllPendingPersistence: persistenceCoordinator.flushAllPendingPersistence,
    mockFs: mockFsModule,
  };
}

let warehouseSeq = 1;
let itemSeq = 1;
let customerSeq = 1;

function createActiveWarehouse(
  modules: ReceiptModules | ShipmentModules,
  patch?: Record<string, unknown>,
) {
  const seq = warehouseSeq++;
  return modules.warehouseRepository.create({
    code: `TEST-WH-${seq}`,
    name: `Test Warehouse ${seq}`,
    isActive: true,
    ...patch,
  });
}

function createActiveItem(
  modules: ReceiptModules | ShipmentModules,
  patch?: Record<string, unknown>,
) {
  const seq = itemSeq++;
  return modules.itemRepository.create({
    code: `TEST-ITEM-${seq}`,
    name: `Test Item ${seq}`,
    uom: "EA",
    isActive: true,
    ...patch,
  });
}

function createActiveCustomer(modules: ShipmentModules, patch?: Record<string, unknown>) {
  const seq = customerSeq++;
  return modules.customerRepository.create({
    code: `TEST-CUS-${seq}`,
    name: `Test Customer ${seq}`,
    isActive: true,
    ...patch,
  });
}

function seedGoodStock(
  modules: ReceiptModules | ShipmentModules,
  itemId: string,
  warehouseId: string,
  qtyOnHand: number,
) {
  modules.stockBalanceRepository.upsert({
    itemId,
    warehouseId,
    qtyOnHand,
  });
}

/** Stable ordering for comparing reservation rows belonging to one sales order. */
function listReservationsForSalesOrderSorted(modules: ShipmentModules, salesOrderId: string) {
  return modules.stockReservationRepository
    .list()
    .filter((r) => r.salesOrderId === salesOrderId)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function createConfirmedPurchaseOrder(
  modules: ReceiptModules,
  lines: Array<{ itemId: string; qty: number; unitPrice: number }>,
) {
  const warehouse = createActiveWarehouse(modules);
  const po = modules.purchaseOrderRepository.create(
    {
      date: "2026-03-30",
      supplierId: "1",
      warehouseId: warehouse.id,
      status: "draft",
      comment: "",
    },
    lines,
  );
  expect(modules.confirmPurchaseOrder(po.id)).toEqual({ success: true });
  return modules.purchaseOrderRepository.getById(po.id)!;
}

async function createConfirmedSalesOrder(
  modules: ShipmentModules,
  lines: Array<{ itemId: string; qty: number; unitPrice: number }>,
) {
  const warehouse = createActiveWarehouse(modules);
  const customer = createActiveCustomer(modules);
  const so = modules.salesOrderRepository.create(
    {
      date: "2026-03-30",
      customerId: customer.id,
      warehouseId: warehouse.id,
      status: "draft",
      comment: "",
    },
    lines,
  );
  expect(await modules.confirmSalesOrder(so.id)).toEqual({ success: true });
  return modules.salesOrderRepository.getById(so.id)!;
}

beforeEach(() => {
  resetMockFs();
  clearMockFsFailures();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  warehouseSeq = 1;
  itemSeq = 1;
  customerSeq = 1;
});

afterEach(async () => {
  clearMockFsFailures();
  try {
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    await flushAllPendingPersistence();
  } catch {
    // Some tests intentionally inject persistence failure; next test resets modules/fs state.
  }
});

describe.sequential("Receipt and Shipment durability failure paths", () => {
  it("receipt post rolls back fully when a later repository update throws", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    const originalPoUpdate = modules.purchaseOrderRepository.update.bind(
      modules.purchaseOrderRepository,
    );
    let isFirstPurchaseOrderUpdate = true;
    const poUpdateSpy = vi
      .spyOn(modules.purchaseOrderRepository, "update")
      .mockImplementation((id, patch) => {
        if (isFirstPurchaseOrderUpdate) {
          isFirstPurchaseOrderUpdate = false;
          throw new Error("purchase order update exploded");
        }
        return originalPoUpdate(id, patch);
      });

    const postResult = await modules.receiptService.post(receiptId);
    expect(postResult.success).toBe(false);
    expect(poUpdateSpy).toHaveBeenCalled();
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Receipt post failed: purchase order update exploded"),
        }),
      ]),
    );

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("draft");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(0);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === receiptId),
    ).toEqual([]);
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("confirmed");
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((row) => row.eventType),
    ).not.toContain("document_posted");
  });

  it("receipt reverse rolls back fully when a compensating balance adjustment throws", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const receiptId = createResult.receiptId;
    expect(await modules.receiptService.post(receiptId)).toEqual({ success: true });

    const originalAdjustQty = modules.stockBalanceRepository.adjustQty.bind(
      modules.stockBalanceRepository,
    );
    let isFirstBalanceAdjustForReverse = true;
    vi.spyOn(modules.stockBalanceRepository, "adjustQty").mockImplementation((input) => {
      if (isFirstBalanceAdjustForReverse) {
        isFirstBalanceAdjustForReverse = false;
        throw new Error("stock balance reversal exploded");
      }
      return originalAdjustQty(input);
    });

    expect(
      await modules.receiptService.reverseDocument(receiptId, { reversalReasonCode: "OTHER" }),
    ).toEqual({
      success: false,
      error: "Receipt reverse failed: stock balance reversal exploded",
    });

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("posted");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(10);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === receiptId),
    ).toEqual([
      expect.objectContaining({ movementType: "receipt", qtyDelta: 10 }),
    ]);
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("closed");
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
  });

  it("receipt reverse rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const receiptId = createResult.receiptId;
    expect(await modules.receiptService.post(receiptId)).toEqual({ success: true });

    await modules.flushAllPendingPersistence();

    const receiptSnapshot = modules.receiptRepository.getById(receiptId)!;
    const poStatusBeforeReverse = modules.purchaseOrderRepository.getById(po.id)?.status;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const receiptReversalCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "receipt_reversal" && m.sourceDocumentId === receiptId).length;
    const inboundReceiptMovementCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "receipt" && m.sourceDocumentType === "receipt" && m.sourceDocumentId === receiptId)
      .length;
    const receiptAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("receipt", receiptId).map((e) => e.id),
    ].sort();
    const poAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("purchase_order", po.id).map((e) => e.id),
    ].sort();

    modules.mockFs.injectWriteFileFailure("inventory/stock-balances.json", {
      times: 1,
      message: "Injected balance persist failure on receipt reverse finalize",
    });

    const revResult = await modules.receiptService.reverseDocument(receiptId, { reversalReasonCode: "OTHER" });
    expect(revResult.success).toBe(false);
    if (revResult.success) return;
    expect(revResult.error).toContain("Injected balance persist failure on receipt reverse finalize");

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe(receiptSnapshot.status);
    expect(modules.receiptRepository.getById(receiptId)?.reversalReasonCode).toBe(
      receiptSnapshot.reversalReasonCode,
    );
    expect(modules.receiptRepository.getById(receiptId)?.reversalReasonComment).toBe(
      receiptSnapshot.reversalReasonComment,
    );
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe(poStatusBeforeReverse);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "receipt_reversal" && m.sourceDocumentId === receiptId),
    ).toHaveLength(receiptReversalCountBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "receipt" && m.sourceDocumentType === "receipt" && m.sourceDocumentId === receiptId),
    ).toHaveLength(inboundReceiptMovementCountBefore);
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((e) => e.eventType),
    ).not.toContain("document_reversed");
    expect([...modules.listAuditEventsForEntity("receipt", receiptId).map((e) => e.id)].sort()).toEqual(
      receiptAuditIdsBeforeReverse,
    );
    expect([...modules.listAuditEventsForEntity("purchase_order", po.id).map((e) => e.id)].sort()).toEqual(
      poAuditIdsBeforeReverse,
    );

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(
      await modules.receiptService.reverseDocument(receiptId, { reversalReasonCode: "OTHER" }),
    ).toEqual({ success: true });

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("reversed");
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("confirmed");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(0);
    expect(
      modules.stockMovementRepository.list().filter((m) => m.sourceDocumentId === receiptId),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ movementType: "receipt", qtyDelta: 10 }),
        expect.objectContaining({ movementType: "receipt_reversal", qtyDelta: -10 }),
      ]),
    );
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((e) => e.eventType),
    ).toContain("document_reversed");
  });

  it("allocate stock rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    await modules.flushAllPendingPersistence();

    const reservationsBefore = listReservationsForSalesOrderSorted(modules, so.id);
    const soAuditIdsBefore = [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort();

    modules.mockFs.injectWriteFileFailure("inventory/stock-reservations.json", {
      times: 1,
      message: "Injected stock reservations persist failure on allocate finalize",
    });

    const allocResult = await modules.allocateSalesOrderStock(so.id);
    expect(allocResult.success).toBe(false);
    if (allocResult.success) return;
    expect(allocResult.error).toContain("Injected stock reservations persist failure on allocate finalize");

    expect(listReservationsForSalesOrderSorted(modules, so.id)).toEqual(reservationsBefore);
    expect([...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort()).toEqual(
      soAuditIdsBefore,
    );
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).not.toContain("stock_allocated");

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(10);
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).toContain("stock_allocated");
  });

  it("sales order cancel rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const { patchAppSettings } = await import("../../src/shared/settings/store");
    patchAppSettings({ inventory: { releaseReservationsOnSalesOrderCancel: true } });

    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 20);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    await modules.flushAllPendingPersistence();

    const soSnapshot = modules.salesOrderRepository.getById(so.id)!;
    const reservationsBefore = listReservationsForSalesOrderSorted(modules, so.id);
    const soAuditIdsBefore = [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort();

    modules.mockFs.injectWriteFileFailure("documents/sales-orders.json.tmp", {
      times: 1,
      message: "Injected sales order persist failure on cancel finalize",
    });

    const cancelResult = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Should fail persist",
    });
    expect(cancelResult.success).toBe(false);
    if (cancelResult.success) return;
    expect(cancelResult.error).toContain("Injected sales order persist failure on cancel finalize");

    const soAfter = modules.salesOrderRepository.getById(so.id)!;
    expect(soAfter.status).toBe(soSnapshot.status);
    expect(soAfter.cancelReasonCode).toBe(soSnapshot.cancelReasonCode);
    expect(soAfter.cancelReasonComment).toBe(soSnapshot.cancelReasonComment);

    expect(listReservationsForSalesOrderSorted(modules, so.id)).toEqual(reservationsBefore);
    expect([...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort()).toEqual(
      soAuditIdsBefore,
    );
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).not.toContain("document_cancelled");
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).not.toContain("reservation_released");

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    const retry = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Retry ok",
    });
    expect(retry).toEqual({ success: true });
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("cancelled");
    expect(modules.stockReservationRepository.listActiveForSalesOrder(so.id)).toEqual([]);
    const types = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType);
    expect(types).toContain("document_cancelled");
    expect(types).toContain("reservation_released");
  });

  it("sales order confirm rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const so = modules.salesOrderRepository.create(
      {
        date: "2026-03-30",
        customerId: customer.id,
        warehouseId: warehouse.id,
        status: "draft",
        comment: "",
      },
      [{ itemId: item.id, qty: 10, unitPrice: 5 }],
    );
    const firstLine = modules.salesOrderRepository.listLines(so.id)[0]!;
    const otherWarehouse = createActiveWarehouse(modules);
    modules.stockReservationRepository.upsertActiveForSalesOrderLine({
      salesOrderId: so.id,
      salesOrderLineId: firstLine.id,
      warehouseId: otherWarehouse.id,
      itemId: item.id,
      qty: 3,
    });
    await modules.flushAllPendingPersistence();

    const statusBefore = modules.salesOrderRepository.getById(so.id)!.status;
    const reservationsBefore = listReservationsForSalesOrderSorted(modules, so.id);
    const soAuditIdsBefore = [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort();

    modules.mockFs.injectWriteFileFailure("documents/sales-orders.json.tmp", {
      times: 1,
      message: "Injected sales order persist failure on confirm finalize",
    });

    const confirmResult = await modules.confirmSalesOrder(so.id);
    expect(confirmResult.success).toBe(false);
    if (confirmResult.success) return;
    expect(confirmResult.error).toContain("Injected sales order persist failure on confirm finalize");

    expect(modules.salesOrderRepository.getById(so.id)!.status).toBe(statusBefore);
    expect(listReservationsForSalesOrderSorted(modules, so.id)).toEqual(reservationsBefore);
    expect([...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort()).toEqual(
      soAuditIdsBefore,
    );
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).not.toContain("document_confirmed");
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType),
    ).not.toContain("reservation_reconciled");

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(await modules.confirmSalesOrder(so.id)).toEqual({ success: true });
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("confirmed");
    const typesAfter = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType);
    expect(typesAfter).toContain("document_confirmed");
    expect(typesAfter).toContain("reservation_reconciled");
  });

  it("create receipt rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    await modules.flushAllPendingPersistence();

    const receiptIdsBefore = new Set(modules.receiptRepository.list().map((r) => r.id));

    modules.mockFs.injectWriteFileFailure("documents/receipts.json.tmp", {
      times: 1,
      message: "Injected receipt persist failure on create receipt finalize",
    });

    const createResult = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(false);
    if (createResult.success) return;
    expect(createResult.error).toContain("Injected receipt persist failure on create receipt finalize");

    expect(new Set(modules.receiptRepository.list().map((r) => r.id))).toEqual(receiptIdsBefore);
    expect(modules.receiptRepository.list().filter((r) => r.purchaseOrderId === po.id)).toEqual([]);

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    const retry = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(retry.success).toBe(true);
    if (!retry.success) return;
    expect(modules.receiptRepository.getById(retry.receiptId)?.status).toBe("draft");
    expect(
      modules.listAuditEventsForEntity("receipt", retry.receiptId).some((e) => e.eventType === "document_created"),
    ).toBe(true);
  });

  it("create shipment rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    await modules.flushAllPendingPersistence();

    const shipmentIdsBefore = new Set(modules.shipmentRepository.list().map((s) => s.id));

    modules.mockFs.injectWriteFileFailure("documents/shipments.json.tmp", {
      times: 1,
      message: "Injected shipment persist failure on create shipment finalize",
    });

    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(false);
    if (createResult.success) return;
    expect(createResult.error).toContain("Injected shipment persist failure on create shipment finalize");

    expect(new Set(modules.shipmentRepository.list().map((s) => s.id))).toEqual(shipmentIdsBefore);

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    const retry = await modules.createShipmentFromSalesOrder(so.id);
    expect(retry.success).toBe(true);
    if (!retry.success) return;
    expect(modules.shipmentRepository.getById(retry.shipmentId)?.status).toBe("draft");
  });

  it("shipment post rolls back fully when a later sales-order update throws", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });

    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;

    const soStatusBefore = modules.salesOrderRepository.getById(so.id)?.status;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const outboundShipmentMovementsBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment").length;

    const originalSoUpdate = modules.salesOrderRepository.update.bind(modules.salesOrderRepository);
    let isFirstSalesOrderUpdate = true;
    const soUpdateSpy = vi
      .spyOn(modules.salesOrderRepository, "update")
      .mockImplementation((id, patch) => {
        if (isFirstSalesOrderUpdate) {
          isFirstSalesOrderUpdate = false;
          throw new Error("sales order update exploded");
        }
        return originalSoUpdate(id, patch);
      });

    const postResult = await modules.shipmentService.post(shipmentId);
    expect(postResult.success).toBe(false);
    expect(soUpdateSpy).toHaveBeenCalled();
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Shipment post failed: sales order update exploded"),
        }),
      ]),
    );

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("draft");
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe(soStatusBefore);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter(
          (row) => row.sourceDocumentType === "shipment" && row.sourceDocumentId === shipmentId,
        ),
    ).toEqual([]);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBefore);
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).some((row) => row.eventType === "reservation_consumed"),
    ).toBe(false);
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_posted");
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment"),
    ).toHaveLength(outboundShipmentMovementsBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .some((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId),
    ).toBe(false);
  });

  it("shipment post rolls back MARKDOWN-style stock when SO update throws after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);
    const md = modules.markdownRepository.create({
      itemId: item.id,
      markdownPrice: 5,
      reasonCode: "OTHER",
      status: "ACTIVE",
      createdAt: "2026-03-30T00:00:00.000Z",
      createdBy: "test",
      warehouseId: warehouse.id,
      style: "MARKDOWN",
      printCount: 0,
    });
    const so = modules.salesOrderRepository.create(
      {
        date: "2026-03-30",
        customerId: customer.id,
        warehouseId: warehouse.id,
        status: "draft",
        comment: "",
      },
      [{ itemId: item.id, qty: 1, unitPrice: 15, markdownCode: md.markdownCode }],
    );
    expect(await modules.confirmSalesOrder(so.id)).toEqual({ success: true });
    const confirmedSo = modules.salesOrderRepository.getById(so.id)!;
    seedGoodStock(modules, item.id, warehouse.id, 1);
    modules.stockBalanceRepository.upsert({
      itemId: item.id,
      warehouseId: warehouse.id,
      style: "MARKDOWN",
      qtyOnHand: 1,
    });
    const allocResult = await modules.allocateSalesOrderStock(confirmedSo.id);
    expect(allocResult.success).toBe(true);
    const createResult = await modules.createShipmentFromSalesOrder(confirmedSo.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;

    const markdownBalanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "MARKDOWN")
        ?.qtyOnHand ?? 0;
    expect(markdownBalanceBefore).toBe(1);

    const originalSoUpdate = modules.salesOrderRepository.update.bind(modules.salesOrderRepository);
    let isFirstSalesOrderUpdate = true;
    vi.spyOn(modules.salesOrderRepository, "update").mockImplementation((id, patch) => {
      if (isFirstSalesOrderUpdate) {
        isFirstSalesOrderUpdate = false;
        throw new Error("sales order update exploded (markdown line)");
      }
      return originalSoUpdate(id, patch);
    });

    const postResult = await modules.shipmentService.post(shipmentId);
    expect(postResult.success).toBe(false);
    if (postResult.success) return;

    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "MARKDOWN")
        ?.qtyOnHand ?? 0,
    ).toBe(markdownBalanceBefore);
    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("draft");
  });

  it("shipment post rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;

    await modules.flushAllPendingPersistence();

    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const outboundMovementCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment").length;

    modules.mockFs.injectWriteFileFailure("inventory/stock-balances.json", {
      times: 1,
      message: "Injected balance persist failure on finalize",
    });

    const postResult = await modules.shipmentService.post(shipmentId);
    expect(postResult.success).toBe(false);
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Injected balance persist failure on finalize"),
        }),
      ]),
    );

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("draft");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter(
          (m) =>
            m.sourceDocumentType === "shipment" &&
            m.sourceDocumentId === shipmentId &&
            m.movementType === "shipment",
        ),
    ).toEqual([]);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment"),
    ).toHaveLength(outboundMovementCountBefore);
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).some((e) => e.eventType === "document_posted"),
    ).toBe(false);
    expect(
      modules.listAuditEventsForEntity("sales_order", so.id).some((e) => e.eventType === "reservation_consumed"),
    ).toBe(false);

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });
  });

  it("shipment post rolls back earlier reservation consumption when a later line cannot consume reservations", async () => {
    const modules = await loadShipmentWorkflow();
    const itemA = createActiveItem(modules);
    const itemB = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [
      { itemId: itemA.id, qty: 5, unitPrice: 5 },
      { itemId: itemB.id, qty: 5, unitPrice: 5 },
    ]);
    seedGoodStock(modules, itemA.id, so.warehouseId, 10);
    seedGoodStock(modules, itemB.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 2 });

    const reservedA0 = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      itemA.id,
      so.warehouseId,
    );
    const reservedB0 = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      itemB.id,
      so.warehouseId,
    );
    expect(reservedA0).toBe(5);
    expect(reservedB0).toBe(5);

    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;

    const origTry =
      modules.stockReservationRepository.tryConsumeActiveForSalesOrderItem.bind(
        modules.stockReservationRepository,
      );
    let consumeCalls = 0;
    vi.spyOn(modules.stockReservationRepository, "tryConsumeActiveForSalesOrderItem").mockImplementation(
      (salesOrderId, itemId, shipQty, warehouseId) => {
        consumeCalls += 1;
        if (consumeCalls >= 2) return false;
        return origTry(salesOrderId, itemId, shipQty, warehouseId);
      },
    );

    const balanceA0 =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(itemA.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const balanceB0 =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(itemB.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;

    const postResult = await modules.shipmentService.post(shipmentId);
    expect(postResult.success).toBe(false);
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.reservationConsumeFailed" }),
      ]),
    );

    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, itemA.id, so.warehouseId),
    ).toBe(reservedA0);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, itemB.id, so.warehouseId),
    ).toBe(reservedB0);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(itemA.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceA0);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(itemB.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceB0);
    expect(
      modules.stockMovementRepository
        .list()
        .filter(
          (row) => row.sourceDocumentType === "shipment" && row.sourceDocumentId === shipmentId,
        ),
    ).toEqual([]);
    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("draft");
  });

  it("shipment reverse rolls back fully when a compensating balance adjustment throws", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    const shipmentBefore = modules.shipmentRepository.getById(shipmentId)!;
    const soStatusBefore = modules.salesOrderRepository.getById(so.id)?.status;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const outboundReversalCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId).length;
    const outboundShipmentMovementCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment").length;
    const receiptMovementCountBefore = modules.stockMovementRepository.list().filter((m) => m.movementType === "receipt")
      .length;
    const receiptReversalMovementCountBefore = modules.stockMovementRepository.list()
      .filter((m) => m.movementType === "receipt_reversal").length;
    const soAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id),
    ].sort();

    const originalAdjustQty = modules.stockBalanceRepository.adjustQty.bind(modules.stockBalanceRepository);
    let isFirstAdjustAfterPost = true;
    vi.spyOn(modules.stockBalanceRepository, "adjustQty").mockImplementation((input) => {
      if (isFirstAdjustAfterPost) {
        isFirstAdjustAfterPost = false;
        throw new Error("shipment reversal balance exploded");
      }
      return originalAdjustQty(input);
    });

    expect(
      await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" }),
    ).toEqual({
      success: false,
      error: "Shipment reverse failed: shipment reversal balance exploded",
    });

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");
    expect(modules.shipmentRepository.getById(shipmentId)?.reversalReasonCode).toBe(
      shipmentBefore.reversalReasonCode,
    );
    expect(modules.shipmentRepository.getById(shipmentId)?.reversalReasonComment).toBe(
      shipmentBefore.reversalReasonComment,
    );
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe(soStatusBefore);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBefore);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === shipmentId),
    ).toEqual([expect.objectContaining({ movementType: "shipment", qtyDelta: -10 })]);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId),
    ).toHaveLength(outboundReversalCountBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment"),
    ).toHaveLength(outboundShipmentMovementCountBefore);
    expect(modules.stockMovementRepository.list().filter((m) => m.movementType === "receipt")).toHaveLength(
      receiptMovementCountBefore,
    );
    expect(modules.stockMovementRepository.list().filter((m) => m.movementType === "receipt_reversal")).toHaveLength(
      receiptReversalMovementCountBefore,
    );
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
    expect(
      [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort(),
    ).toEqual(soAuditIdsBeforeReverse);
  });

  it("shipment reverse rolls back when final persistence flush fails after mutations", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    await modules.flushAllPendingPersistence();

    const shipmentSnapshot = modules.shipmentRepository.getById(shipmentId)!;
    const soStatusBefore = modules.salesOrderRepository.getById(so.id)?.status;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const reversalCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId).length;
    const outboundShipmentMovementCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment").length;
    const receiptReversalMovementCountBefore = modules.stockMovementRepository.list()
      .filter((m) => m.movementType === "receipt_reversal").length;
    const soAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id),
    ].sort();

    modules.mockFs.injectWriteFileFailure("inventory/stock-balances.json", {
      times: 1,
      message: "Injected balance persist failure on reverse finalize",
    });

    const revResult = await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" });
    expect(revResult.success).toBe(false);
    if (revResult.success) return;
    expect(revResult.error).toContain("Injected balance persist failure on reverse finalize");

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe(shipmentSnapshot.status);
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe(soStatusBefore);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBefore);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId),
    ).toHaveLength(reversalCountBefore);
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((e) => e.eventType),
    ).not.toContain("document_reversed");
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment"),
    ).toHaveLength(outboundShipmentMovementCountBefore);
    expect(
      [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort(),
    ).toEqual(soAuditIdsBeforeReverse);
    expect(modules.stockMovementRepository.list().filter((m) => m.movementType === "receipt_reversal")).toHaveLength(
      receiptReversalMovementCountBefore,
    );

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(
      await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" }),
    ).toEqual({ success: true });
  });

  it("shipment reverse rolls back when sales order update throws after shipment is marked reversed", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    const shipmentBefore = modules.shipmentRepository.getById(shipmentId)!;
    const soStatusBefore = modules.salesOrderRepository.getById(so.id)?.status;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const soAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id),
    ].sort();
    const outboundShipmentMovementCountBefore = modules.stockMovementRepository
      .list()
      .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment").length;
    const receiptReversalMovementCountBefore = modules.stockMovementRepository.list()
      .filter((m) => m.movementType === "receipt_reversal").length;

    const originalSoUpdate = modules.salesOrderRepository.update.bind(modules.salesOrderRepository);
    let confirmedSoUpdateAttempt = 0;
    vi.spyOn(modules.salesOrderRepository, "update").mockImplementation((id, patch) => {
      if (
        id === so.id &&
        patch &&
        typeof patch === "object" &&
        "status" in patch &&
        patch.status === "confirmed"
      ) {
        confirmedSoUpdateAttempt += 1;
        if (confirmedSoUpdateAttempt === 1) {
          throw new Error("sales order update exploded during reverse");
        }
      }
      return originalSoUpdate(id, patch);
    });

    const revResult = await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" });
    expect(revResult.success).toBe(false);
    if (revResult.success) return;
    expect(revResult.error).toContain("Shipment reverse failed: sales order update exploded during reverse");

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe(shipmentBefore.status);
    expect(modules.shipmentRepository.getById(shipmentId)?.reversalReasonCode).toBe(
      shipmentBefore.reversalReasonCode,
    );
    expect(modules.shipmentRepository.getById(shipmentId)?.reversalReasonComment).toBe(
      shipmentBefore.reversalReasonComment,
    );
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe(soStatusBefore);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(balanceBefore);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBefore);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === shipmentId),
    ).toEqual([expect.objectContaining({ movementType: "shipment", qtyDelta: -10 })]);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment_reversal" && m.sourceDocumentId === shipmentId),
    ).toHaveLength(0);
    expect(
      modules.stockMovementRepository
        .list()
        .filter((m) => m.movementType === "shipment" && m.sourceDocumentType === "shipment"),
    ).toHaveLength(outboundShipmentMovementCountBefore);
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
    expect(
      [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort(),
    ).toEqual(soAuditIdsBeforeReverse);
    expect(modules.stockMovementRepository.list().filter((m) => m.movementType === "receipt_reversal")).toHaveLength(
      receiptReversalMovementCountBefore,
    );
  });

  it("shipment reverse rolls back when document_reversed audit append throws after reconcile", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    const auditModule = await import("../../src/shared/audit/eventLogRepository");
    const origAppend = auditModule.appendAuditEvent;
    vi.spyOn(auditModule, "appendAuditEvent").mockImplementation((input) => {
      if (input.entityType === "shipment" && input.eventType === "document_reversed") {
        throw new Error("document_reversed audit append failed");
      }
      return origAppend(input);
    });

    const reservedBeforeReverse = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      so.warehouseId,
    );
    const soAuditIdsBeforeReverse = [
      ...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id),
    ].sort();

    const revResult = await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" });
    expect(revResult.success).toBe(false);
    if (revResult.success) return;
    expect(revResult.error).toContain("document_reversed audit append failed");

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(reservedBeforeReverse);
    expect(
      [...modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id)].sort(),
    ).toEqual(soAuditIdsBeforeReverse);
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
  });

  it("shipment reverse reports combined error when rollback flush also fails", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    await modules.flushAllPendingPersistence();

    modules.mockFs.injectWriteFileFailure("inventory/stock-balances.json", {
      times: 2,
      message: "Injected balance persist failure",
    });

    const revResult = await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" });
    expect(revResult.success).toBe(false);
    if (revResult.success) return;
    expect(revResult.error).toContain("Shipment reverse was rolled back but saving the rolled-back state failed");
    expect(revResult.error).toContain("Shipment reverse failed");
    expect(revResult.error).toContain("|");

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
  });

  it("shipment reverse rolls back MARKDOWN-style stock when balance adjust throws", async () => {
    const modules = await loadShipmentWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);
    const md = modules.markdownRepository.create({
      itemId: item.id,
      markdownPrice: 5,
      reasonCode: "OTHER",
      status: "ACTIVE",
      createdAt: "2026-03-30T00:00:00.000Z",
      createdBy: "test",
      warehouseId: warehouse.id,
      style: "MARKDOWN",
      printCount: 0,
    });
    const so = modules.salesOrderRepository.create(
      {
        date: "2026-03-30",
        customerId: customer.id,
        warehouseId: warehouse.id,
        status: "draft",
        comment: "",
      },
      [{ itemId: item.id, qty: 1, unitPrice: 15, markdownCode: md.markdownCode }],
    );
    expect(await modules.confirmSalesOrder(so.id)).toEqual({ success: true });
    const confirmedSo = modules.salesOrderRepository.getById(so.id)!;
    seedGoodStock(modules, item.id, warehouse.id, 1);
    modules.stockBalanceRepository.upsert({
      itemId: item.id,
      warehouseId: warehouse.id,
      style: "MARKDOWN",
      qtyOnHand: 1,
    });
    const allocResult = await modules.allocateSalesOrderStock(confirmedSo.id);
    expect(allocResult.success).toBe(true);
    const createResult = await modules.createShipmentFromSalesOrder(confirmedSo.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(await modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    const markdownQtyBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "MARKDOWN")?.qtyOnHand ?? 0;
    expect(markdownQtyBefore).toBe(0);
    const goodQtyBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "GOOD")?.qtyOnHand ?? 0;
    expect(goodQtyBefore).toBe(1);

    const originalAdjustQty = modules.stockBalanceRepository.adjustQty.bind(modules.stockBalanceRepository);
    let isFirstAdjustAfterPost = true;
    vi.spyOn(modules.stockBalanceRepository, "adjustQty").mockImplementation((input) => {
      if (isFirstAdjustAfterPost) {
        isFirstAdjustAfterPost = false;
        throw new Error("markdown reversal balance exploded");
      }
      return originalAdjustQty(input);
    });

    expect(
      await modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" }),
    ).toEqual({
      success: false,
      error: "Shipment reverse failed: markdown reversal balance exploded",
    });

    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "MARKDOWN")?.qtyOnHand ?? 0,
    ).toBe(markdownQtyBefore);
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(goodQtyBefore);
    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");
  });

  it("receipt post fails and rolls back when inventory persistence fails during flush", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    modules.mockFs.injectWriteFileFailure("inventory/stock-movements.json.tmp", {
      message: "Injected stock-movement persist failure",
    });

    const postResult = await modules.receiptService.post(createResult.receiptId);
    expect(postResult.success).toBe(false);
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Injected stock-movement persist failure"),
        }),
      ]),
    );

    expect(modules.receiptRepository.getById(createResult.receiptId)?.status).toBe("draft");
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === createResult.receiptId),
    ).toEqual([]);
    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
  });

  it("shipment post returns success before async document persistence failure is surfaced", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = await modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    modules.mockFs.injectWriteFileFailure("documents/shipments.json.tmp", {
      message: "Injected shipment persist failure",
    });
    const postResult = await modules.shipmentService.post(createResult.shipmentId);
    expect(postResult.success).toBe(false);
    if (postResult.success) return;
    expect(postResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Injected shipment persist failure"),
        }),
      ]),
    );

    expect(modules.shipmentRepository.getById(createResult.shipmentId)?.status).toBe("draft");
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("confirmed");
    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
  });
});
