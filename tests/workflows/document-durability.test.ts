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
  const persistenceCoordinator = await import("../../src/shared/persistenceCoordinator");

  return {
    confirmSalesOrder: soService.confirm,
    allocateSalesOrderStock: soService.allocateStock,
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
  expect(modules.confirmSalesOrder(so.id)).toEqual({ success: true });
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
  it("receipt post can partially apply when a later repository update throws", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const receiptId = createResult.receiptId;
    const poUpdateSpy = vi
      .spyOn(modules.purchaseOrderRepository, "update")
      .mockImplementation(() => {
        throw new Error("purchase order update exploded");
      });

    expect(() => modules.receiptService.post(receiptId)).toThrow("purchase order update exploded");
    expect(poUpdateSpy).toHaveBeenCalled();

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("posted");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(10);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === receiptId),
    ).toEqual([
      expect.objectContaining({
        movementType: "receipt",
        itemId: item.id,
        warehouseId: po.warehouseId,
        qtyDelta: 10,
      }),
    ]);
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("confirmed");
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((row) => row.eventType),
    ).not.toContain("document_posted");
  });

  it("receipt reverse can partially apply when a compensating balance adjustment throws", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const receiptId = createResult.receiptId;
    expect(modules.receiptService.post(receiptId)).toEqual({ success: true });

    vi.spyOn(modules.stockBalanceRepository, "adjustQty").mockImplementation(() => {
      throw new Error("stock balance reversal exploded");
    });

    expect(() =>
      modules.receiptService.reverseDocument(receiptId, { reversalReasonCode: "OTHER" }),
    ).toThrow("stock balance reversal exploded");

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("posted");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, po.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(10);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === receiptId),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ movementType: "receipt", qtyDelta: 10 }),
        expect.objectContaining({ movementType: "receipt_reversal", qtyDelta: -10 }),
      ]),
    );
    expect(modules.purchaseOrderRepository.getById(po.id)?.status).toBe("closed");
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
  });

  it("shipment post can partially apply when a later sales-order update throws", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });

    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;

    const soUpdateSpy = vi
      .spyOn(modules.salesOrderRepository, "update")
      .mockImplementation(() => {
        throw new Error("sales order update exploded");
      });

    expect(() => modules.shipmentService.post(shipmentId)).toThrow("sales order update exploded");
    expect(soUpdateSpy).toHaveBeenCalled();

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(0);
    expect(
      modules.stockMovementRepository
        .list()
        .filter(
          (row) => row.sourceDocumentType === "shipment" && row.sourceDocumentId === shipmentId,
        ),
    ).toEqual([
      expect.objectContaining({
        movementType: "shipment",
        itemId: item.id,
        warehouseId: so.warehouseId,
        qtyDelta: -10,
      }),
    ]);
    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId),
    ).toBe(0);
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("confirmed");

    const soAudit = modules.listAuditEventsForEntity("sales_order", so.id).map((row) => row.eventType);
    expect(soAudit).toContain("reservation_consumed");
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_posted");
  });

  it("shipment reverse can partially apply when a compensating balance adjustment throws", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const shipmentId = createResult.shipmentId;
    expect(modules.shipmentService.post(shipmentId)).toEqual({ success: true });

    vi.spyOn(modules.stockBalanceRepository, "adjustQty").mockImplementation(() => {
      throw new Error("shipment reversal balance exploded");
    });

    expect(() =>
      modules.shipmentService.reverseDocument(shipmentId, { reversalReasonCode: "OTHER" }),
    ).toThrow("shipment reversal balance exploded");

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");
    expect(
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, so.warehouseId, "GOOD")?.qtyOnHand ?? 0,
    ).toBe(0);
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === shipmentId),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ movementType: "shipment", qtyDelta: -10 }),
        expect.objectContaining({ movementType: "shipment_reversal", qtyDelta: 10 }),
      ]),
    );
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("closed");
    expect(
      modules.listAuditEventsForEntity("shipment", shipmentId).map((row) => row.eventType),
    ).not.toContain("document_reversed");
  });

  it("receipt post returns success before async inventory persistence failure is surfaced", async () => {
    const modules = await loadReceiptWorkflow();
    const item = createActiveItem(modules);
    const po = await createConfirmedPurchaseOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 1 }]);
    const createResult = modules.createReceiptFromPurchaseOrder(po.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    modules.mockFs.injectWriteFileFailure("inventory/stock-movements.json.tmp", {
      message: "Injected stock-movement persist failure",
    });

    const postResult = modules.receiptService.post(createResult.receiptId);
    expect(postResult).toEqual({ success: true });

    expect(modules.receiptRepository.getById(createResult.receiptId)?.status).toBe("posted");
    expect(
      modules.stockMovementRepository.list().filter((row) => row.sourceDocumentId === createResult.receiptId),
    ).toHaveLength(1);

    await expect(modules.flushAllPendingPersistence()).rejects.toMatchObject({
      name: "PersistenceFlushError",
      failures: expect.arrayContaining([
        expect.objectContaining({ moduleId: "stock-movements" }),
      ]),
    });
  });

  it("shipment post returns success before async document persistence failure is surfaced", async () => {
    const modules = await loadShipmentWorkflow();
    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    modules.mockFs.injectWriteFileFailure("documents/shipments.json.tmp", {
      message: "Injected shipment persist failure",
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const postResult = modules.shipmentService.post(createResult.shipmentId);
    expect(postResult).toEqual({ success: true });

    expect(modules.shipmentRepository.getById(createResult.shipmentId)?.status).toBe("posted");
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("closed");

    await expect(modules.flushAllPendingPersistence()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[shipmentRepository] persist failed:",
      expect.objectContaining({ message: "Injected shipment persist failure" }),
    );
  });
});
