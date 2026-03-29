import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockFs } from "../support/tauriFsMock";

type WorkflowModules = Awaited<ReturnType<typeof loadWorkflow>>;

async function loadWorkflow() {
  resetMockFs();
  vi.resetModules();
  const soService = await import("../../src/modules/sales-orders/service");
  const soRepositoryModule = await import("../../src/modules/sales-orders/repository");
  const shipmentServiceModule = await import("../../src/modules/shipments/service");
  const shipmentRepositoryModule = await import("../../src/modules/shipments/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockMovementRepositoryModule = await import("../../src/modules/stock-movements/repository");
  const stockReservationRepositoryModule = await import("../../src/modules/stock-reservations/repository");
  const auditModule = await import("../../src/shared/audit/eventLogRepository");
  const fulfillmentModule = await import("../../src/shared/planningFulfillment");
  const itemRepositoryModule = await import("../../src/modules/items/repository");
  const warehouseRepositoryModule = await import("../../src/modules/warehouses/repository");
  const customerRepositoryModule = await import("../../src/modules/customers/repository");
  const carrierRepositoryModule = await import("../../src/modules/carriers/repository");
  const markdownRepositoryModule = await import("../../src/modules/markdown-journal/repository");

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
    computeSalesOrderFulfillment: fulfillmentModule.computeSalesOrderFulfillment,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
    customerRepository: customerRepositoryModule.customerRepository,
    carrierRepository: carrierRepositoryModule.carrierRepository,
    markdownRepository: markdownRepositoryModule.markdownRepository,
  };
}

let warehouseSeq = 1;
let itemSeq = 1;
let customerSeq = 1;
let carrierSeq = 1;

function createActiveWarehouse(
  modules: WorkflowModules,
  patch?: Partial<Parameters<typeof modules.warehouseRepository.create>[0]>,
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
  modules: WorkflowModules,
  patch?: Partial<Parameters<typeof modules.itemRepository.create>[0]>,
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

function createActiveCustomer(
  modules: WorkflowModules,
  patch?: Partial<Parameters<typeof modules.customerRepository.create>[0]>,
) {
  const seq = customerSeq++;
  return modules.customerRepository.create({
    code: `TEST-CUS-${seq}`,
    name: `Test Customer ${seq}`,
    isActive: true,
    ...patch,
  });
}

function createActiveCarrier(
  modules: WorkflowModules,
  patch?: Partial<Parameters<typeof modules.carrierRepository.create>[0]>,
) {
  const seq = carrierSeq++;
  return modules.carrierRepository.create({
    code: `TEST-CAR-${seq}`,
    name: `Test Carrier ${seq}`,
    isActive: true,
    carrierType: "courier",
    ...patch,
  });
}

function draftSalesOrderHeaderFor(
  warehouseId: string,
  customerId: string,
  patch?: Partial<{
    date: string;
    comment: string;
    carrierId: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    deliveryComment: string;
  }>,
) {
  return {
    date: "2026-03-30",
    customerId,
    warehouseId,
    status: "draft" as const,
    comment: "",
    ...patch,
  };
}

async function createConfirmedSalesOrder(
  modules: WorkflowModules,
  lines: Array<{ itemId: string; qty: number; unitPrice: number; markdownCode?: string }>,
  patch?: Partial<{
    warehouseId: string;
    customerId: string;
    carrierId: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    deliveryComment: string;
    date: string;
    comment: string;
  }>,
) {
  const warehouse =
    patch?.warehouseId != null
      ? modules.warehouseRepository.getById(patch.warehouseId)!
      : createActiveWarehouse(modules);
  const customer =
    patch?.customerId != null
      ? modules.customerRepository.getById(patch.customerId)!
      : createActiveCustomer(modules);
  const so = modules.salesOrderRepository.create(
    draftSalesOrderHeaderFor(warehouse.id, customer.id, patch),
    lines,
  );
  const confirmResult = modules.confirmSalesOrder(so.id);
  expect(confirmResult).toEqual({ success: true });
  return modules.salesOrderRepository.getById(so.id)!;
}

function seedGoodStock(
  modules: WorkflowModules,
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

beforeEach(() => {
  resetMockFs();
  vi.clearAllMocks();
  warehouseSeq = 1;
  itemSeq = 1;
  customerSeq = 1;
  carrierSeq = 1;
});

afterEach(async () => {
  const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
  await flushAllPendingPersistence();
});

describe.sequential("Shipment workflow", () => {
  it("creates a draft shipment from a confirmed reserved sales order using remaining quantities and copied logistics", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const carrier = createActiveCarrier(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 20);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      {
        warehouseId: warehouse.id,
        customerId: customer.id,
        carrierId: carrier.id,
        recipientName: "Jane Receiver",
        recipientPhone: "+1 555 111 2222",
        deliveryAddress: "100 Delivery Ave",
        deliveryComment: "Call on arrival",
      },
    );

    modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: so.warehouseId,
        status: "posted",
      },
      [{ itemId: item.id, qty: 4 }],
    );

    expect(modules.allocateSalesOrderStock(so.id)).toEqual({
      success: true,
      linesTouched: 1,
    });

    const result = modules.createShipmentFromSalesOrder(so.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const shipment = modules.shipmentRepository.getById(result.shipmentId);
    expect(shipment).toMatchObject({
      salesOrderId: so.id,
      warehouseId: warehouse.id,
      status: "draft",
      carrierId: carrier.id,
      recipientName: "Jane Receiver",
      recipientPhone: "+1 555 111 2222",
      deliveryAddress: "100 Delivery Ave",
      deliveryComment: "Call on arrival",
    });
    expect(modules.shipmentRepository.listLines(result.shipmentId)).toEqual([
      expect.objectContaining({ itemId: item.id, qty: 6 }),
    ]);

    const audit = modules.listAuditEventsForEntity("shipment", result.shipmentId);
    expect(audit[0]).toMatchObject({
      eventType: "document_created",
      entityType: "shipment",
      entityId: result.shipmentId,
    });
  });

  it("refuses shipment creation for invalid sales-order states or missing reservations", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 10);

    const draftSo = modules.salesOrderRepository.create(
      draftSalesOrderHeaderFor(warehouse.id, customer.id),
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
    );
    expect(modules.createShipmentFromSalesOrder(draftSo.id)).toEqual({
      success: false,
      error: "Only confirmed sales orders can have a shipment created.",
    });

    const confirmedSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.createShipmentFromSalesOrder(confirmedSo.id)).toEqual({
      success: false,
      error:
        "Each open line must be fully reserved before creating a shipment. Use Allocate stock on the sales order.",
    });

    modules.shipmentRepository.create(
      {
        date: confirmedSo.date,
        salesOrderId: confirmedSo.id,
        warehouseId: confirmedSo.warehouseId,
        status: "posted",
      },
      [{ itemId: item.id, qty: 10 }],
    );
    expect(modules.createShipmentFromSalesOrder(confirmedSo.id)).toEqual({
      success: false,
      error: "Sales order is already fully shipped (posted shipments).",
    });
  });

  it("posts valid draft shipments and updates stock, reservations, sales-order status, and audit", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 10);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({
      success: true,
      linesTouched: 1,
    });

    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const shipmentId = createResult.shipmentId;
    const balanceBefore =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "GOOD")?.qtyOnHand ?? 0;
    const reservedBefore = modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(
      so.id,
      item.id,
      warehouse.id,
    );
    expect(reservedBefore).toBe(10);

    const postResult = modules.shipmentService.post(shipmentId);
    expect(postResult).toEqual({ success: true });

    expect(modules.shipmentRepository.getById(shipmentId)?.status).toBe("posted");

    const balanceAfter =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "GOOD")?.qtyOnHand ?? 0;
    expect(balanceBefore - balanceAfter).toBe(10);

    const movements = modules.stockMovementRepository
      .list()
      .filter((row) => row.sourceDocumentType === "shipment" && row.sourceDocumentId === shipmentId);
    expect(movements).toEqual([
      expect.objectContaining({
        movementType: "shipment",
        itemId: item.id,
        warehouseId: warehouse.id,
        style: "GOOD",
        qtyDelta: -10,
      }),
    ]);

    expect(
      modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, warehouse.id),
    ).toBe(0);
    expect(
      modules.stockReservationRepository.list().some((row) => row.salesOrderId === so.id && row.status === "consumed"),
    ).toBe(true);

    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("closed");

    const shipmentAudit = modules.listAuditEventsForEntity("shipment", shipmentId);
    expect(shipmentAudit.map((row) => row.eventType)).toContain("document_posted");

    const soAudit = modules.listAuditEventsForEntity("sales_order", so.id);
    expect(soAudit.map((row) => row.eventType)).toContain("reservation_consumed");

    const repostResult = modules.shipmentService.post(shipmentId);
    expect(repostResult.success).toBe(false);
    if (repostResult.success) return;
    expect(repostResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          i18nKey: "issues.shipment.onlyDraftPost",
          message: "Only draft shipments can be posted.",
        }),
      ]),
    );
  });

  it("cancels only draft shipments without inventory impact and writes audit", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 10);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({
      success: true,
      linesTouched: 1,
    });

    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const shipmentId = createResult.shipmentId;
    const balancesBefore = modules.stockBalanceRepository.list();
    const movementsBefore = modules.stockMovementRepository.list();

    const cancelResult = modules.shipmentService.cancelDocument(shipmentId, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Customer changed schedule",
    });
    expect(cancelResult).toEqual({ success: true });

    expect(modules.shipmentRepository.getById(shipmentId)).toMatchObject({
      status: "cancelled",
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Customer changed schedule",
    });
    expect(modules.stockBalanceRepository.list()).toEqual(balancesBefore);
    expect(modules.stockMovementRepository.list()).toEqual(movementsBefore);

    const audit = modules.listAuditEventsForEntity("shipment", shipmentId);
    expect(audit.map((row) => row.eventType)).toContain("document_cancelled");

    expect(
      modules.shipmentService.cancelDocument(shipmentId, { cancelReasonCode: "OTHER" }),
    ).toEqual({
      success: false,
      error: "Only draft shipments can be cancelled.",
    });
  });

  it("reverses posted shipments with compensating movements and sales-order reopen", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 10);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({
      success: true,
      linesTouched: 1,
    });

    const createResult = modules.createShipmentFromSalesOrder(so.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const shipmentId = createResult.shipmentId;
    expect(modules.shipmentService.post(shipmentId)).toEqual({ success: true });
    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("closed");

    const reverseResult = modules.shipmentService.reverseDocument(shipmentId, {
      reversalReasonCode: "OTHER",
      reversalReasonComment: "Undo outbound",
    });
    expect(reverseResult).toEqual({ success: true });

    expect(modules.shipmentRepository.getById(shipmentId)).toMatchObject({
      status: "reversed",
      reversalReasonCode: "OTHER",
      reversalReasonComment: "Undo outbound",
    });

    const balance =
      modules.stockBalanceRepository.getByItemWarehouseAndStyle(item.id, warehouse.id, "GOOD")?.qtyOnHand ?? 0;
    expect(balance).toBe(10);

    const movements = modules.stockMovementRepository
      .list()
      .filter((row) => row.sourceDocumentId === shipmentId)
      .map((row) => ({ movementType: row.movementType, qtyDelta: row.qtyDelta }));
    expect(movements).toEqual(
      expect.arrayContaining([
        { movementType: "shipment", qtyDelta: -10 },
        { movementType: "shipment_reversal", qtyDelta: 10 },
      ]),
    );

    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("confirmed");

    const audit = modules.listAuditEventsForEntity("shipment", shipmentId);
    expect(audit.map((row) => row.eventType)).toContain("document_reversed");
  });

  it("blocks posting when reservations are missing or stock is insufficient", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const reservedItem = createActiveItem(modules);
    const stockItem = createActiveItem(modules);

    seedGoodStock(modules, reservedItem.id, warehouse.id, 10);
    seedGoodStock(modules, stockItem.id, warehouse.id, 5);

    const reservationSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: reservedItem.id, qty: 10, unitPrice: 10 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(reservationSo.id)).toEqual({
      success: true,
      linesTouched: 1,
    });
    const reservationShipmentResult = modules.createShipmentFromSalesOrder(reservationSo.id);
    expect(reservationShipmentResult.success).toBe(true);
    if (!reservationShipmentResult.success) return;
    modules.stockReservationRepository.releaseAllActiveForSalesOrder(reservationSo.id);

    const missingReservationPost = modules.shipmentService.post(reservationShipmentResult.shipmentId);
    expect(missingReservationPost.success).toBe(false);
    if (missingReservationPost.success) return;
    expect(missingReservationPost.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.insufficientReserved" }),
      ]),
    );

    const stockSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: stockItem.id, qty: 5, unitPrice: 10 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(stockSo.id)).toEqual({
      success: true,
      linesTouched: 1,
    });
    const stockShipmentResult = modules.createShipmentFromSalesOrder(stockSo.id);
    expect(stockShipmentResult.success).toBe(true);
    if (!stockShipmentResult.success) return;

    modules.stockBalanceRepository.adjustQty({
      itemId: stockItem.id,
      warehouseId: warehouse.id,
      style: "GOOD",
      qtyDelta: -5,
    });

    const insufficientStockPost = modules.shipmentService.post(stockShipmentResult.shipmentId);
    expect(insufficientStockPost.success).toBe(false);
    if (insufficientStockPost.success) return;
    expect(insufficientStockPost.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.insufficientStockPost" }),
      ]),
    );
  });

  it("blocks invalid qty, duplicate items, missing or inactive item, and invalid or inactive warehouse", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );

    const invalidQtyShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: warehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 0 }],
    );
    expect(modules.shipmentService.validateShipmentFull(invalidQtyShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.qtyPositive" }),
      ]),
    );

    const duplicateShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: warehouse.id,
        status: "draft",
      },
      [
        { itemId: item.id, qty: 2 },
        { itemId: item.id, qty: 1 },
      ],
    );
    expect(modules.shipmentService.validateShipmentFull(duplicateShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.duplicateItems" }),
      ]),
    );

    const missingItemShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: warehouse.id,
        status: "draft",
      },
      [{ itemId: "999999", qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(missingItemShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.lineNeedsItem" }),
      ]),
    );

    modules.itemRepository.update(item.id, { isActive: false });
    const inactiveItemShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: warehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(inactiveItemShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.itemInactive" }),
      ]),
    );

    const missingWarehouseShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: "999999",
        status: "draft",
      },
      [{ itemId: item.id, qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(missingWarehouseShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.warehouseRequired" }),
      ]),
    );

    modules.warehouseRepository.update(warehouse.id, { isActive: false });
    const inactiveWarehouseShipment = modules.shipmentRepository.create(
      {
        date: so.date,
        salesOrderId: so.id,
        warehouseId: warehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(inactiveWarehouseShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.warehouseInactive" }),
      ]),
    );
  });

  it("enforces warehouse, style, and markdown restrictions currently implemented", async () => {
    const modules = await loadWorkflow();
    const anyWarehouse = createActiveWarehouse(modules);
    const otherWarehouse = createActiveWarehouse(modules);
    const markdownOnlyWarehouse = createActiveWarehouse(modules, {
      stylePolicy: "MARKDOWN_ONLY",
    });
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    const mismatchSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 1, unitPrice: 15 }],
      { warehouseId: anyWarehouse.id, customerId: customer.id },
    );
    const mismatchShipment = modules.shipmentRepository.create(
      {
        date: mismatchSo.date,
        salesOrderId: mismatchSo.id,
        warehouseId: otherWarehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(mismatchShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.warehouseMismatchSo" }),
      ]),
    );

    const styleSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 1, unitPrice: 15 }],
      { warehouseId: markdownOnlyWarehouse.id, customerId: customer.id },
    );
    const styleShipment = modules.shipmentRepository.create(
      {
        date: styleSo.date,
        salesOrderId: styleSo.id,
        warehouseId: markdownOnlyWarehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 1 }],
    );
    expect(modules.shipmentService.validateShipmentFull(styleShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("style policy does not allow GOOD stock for shipment"),
        }),
      ]),
    );

    const markdownRecord = modules.markdownRepository.create({
      itemId: item.id,
      markdownPrice: 5,
      reasonCode: "OTHER",
      status: "ACTIVE",
      createdAt: "2026-03-30T00:00:00.000Z",
      createdBy: "test",
      warehouseId: anyWarehouse.id,
      style: "MARKDOWN",
      printCount: 0,
    });
    const markdownSo = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 1, unitPrice: 15, markdownCode: markdownRecord.markdownCode }],
      { warehouseId: anyWarehouse.id, customerId: customer.id },
    );

    const invalidMarkdownQtyShipment = modules.shipmentRepository.create(
      {
        date: markdownSo.date,
        salesOrderId: markdownSo.id,
        warehouseId: anyWarehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 2, markdownCode: markdownRecord.markdownCode }],
    );
    expect(modules.shipmentService.validateShipmentFull(invalidMarkdownQtyShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.markdownQtyMustBeOne" }),
      ]),
    );

    modules.shipmentRepository.create(
      {
        date: markdownSo.date,
        salesOrderId: markdownSo.id,
        warehouseId: anyWarehouse.id,
        status: "posted",
      },
      [{ itemId: item.id, qty: 1, markdownCode: markdownRecord.markdownCode }],
    );
    const duplicateMarkdownShipment = modules.shipmentRepository.create(
      {
        date: markdownSo.date,
        salesOrderId: markdownSo.id,
        warehouseId: anyWarehouse.id,
        status: "draft",
      },
      [{ itemId: item.id, qty: 1, markdownCode: markdownRecord.markdownCode }],
    );
    expect(modules.shipmentService.validateShipmentFull(duplicateMarkdownShipment.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i18nKey: "issues.shipment.markdownAlreadyShipped" }),
      ]),
    );
  });

  it("counts only posted shipments toward sales-order fulfillment", async () => {
    const modules = await loadWorkflow();
    const warehouse = createActiveWarehouse(modules);
    const customer = createActiveCustomer(modules);
    const item = createActiveItem(modules);

    seedGoodStock(modules, item.id, warehouse.id, 10);

    const so = await createConfirmedSalesOrder(
      modules,
      [{ itemId: item.id, qty: 10, unitPrice: 15 }],
      { warehouseId: warehouse.id, customerId: customer.id },
    );
    expect(modules.allocateSalesOrderStock(so.id)).toEqual({
      success: true,
      linesTouched: 1,
    });

    const draftCreate = modules.createShipmentFromSalesOrder(so.id);
    expect(draftCreate.success).toBe(true);
    if (!draftCreate.success) return;

    const draftFulfillment = modules.computeSalesOrderFulfillment(so.id);
    expect(draftFulfillment.totalShipped).toBe(0);
    expect(draftFulfillment.postedShipmentCount).toBe(0);
    expect(draftFulfillment.state).toBe("not_started");

    expect(
      modules.shipmentService.cancelDocument(draftCreate.shipmentId, { cancelReasonCode: "OTHER" }),
    ).toEqual({ success: true });
    const cancelledFulfillment = modules.computeSalesOrderFulfillment(so.id);
    expect(cancelledFulfillment.totalShipped).toBe(0);
    expect(cancelledFulfillment.postedShipmentCount).toBe(0);
    expect(cancelledFulfillment.state).toBe("not_started");

    const postedCreate = modules.createShipmentFromSalesOrder(so.id);
    expect(postedCreate.success).toBe(true);
    if (!postedCreate.success) return;

    expect(modules.shipmentService.post(postedCreate.shipmentId)).toEqual({ success: true });
    const postedFulfillment = modules.computeSalesOrderFulfillment(so.id);
    expect(postedFulfillment.totalShipped).toBe(10);
    expect(postedFulfillment.postedShipmentCount).toBe(1);
    expect(postedFulfillment.state).toBe("complete");

    expect(
      modules.shipmentService.reverseDocument(postedCreate.shipmentId, { reversalReasonCode: "OTHER" }),
    ).toEqual({ success: true });
    const reversedFulfillment = modules.computeSalesOrderFulfillment(so.id);
    expect(reversedFulfillment.totalShipped).toBe(0);
    expect(reversedFulfillment.postedShipmentCount).toBe(0);
    expect(reversedFulfillment.state).toBe("not_started");
  });
});
