import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockFs } from "../support/tauriFsMock";

type WorkflowModules = Awaited<ReturnType<typeof loadWorkflow>>;

async function loadWorkflow() {
  resetMockFs();
  vi.resetModules();
  const soService = await import("../../src/modules/sales-orders/service");
  const soRepositoryModule = await import("../../src/modules/sales-orders/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockReservationRepositoryModule = await import("../../src/modules/stock-reservations/repository");
  const auditModule = await import("../../src/shared/audit/eventLogRepository");
  const itemRepositoryModule = await import("../../src/modules/items/repository");
  const warehouseRepositoryModule = await import("../../src/modules/warehouses/repository");
  const customerRepositoryModule = await import("../../src/modules/customers/repository");

  return {
    confirmSalesOrder: soService.confirm,
    allocateSalesOrderStock: soService.allocateStock,
    cancelSalesOrderDocument: soService.cancelDocument,
    salesOrderRepository: soRepositoryModule.salesOrderRepository,
    stockBalanceRepository: stockBalanceRepositoryModule.stockBalanceRepository,
    stockReservationRepository: stockReservationRepositoryModule.stockReservationRepository,
    listAuditEventsForEntity: auditModule.listAuditEventsForEntity,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
    customerRepository: customerRepositoryModule.customerRepository,
  };
}

async function setReleaseReservationsOnSalesOrderCancel(enabled: boolean): Promise<void> {
  const { patchAppSettings } = await import("../../src/shared/settings/store");
  patchAppSettings({ inventory: { releaseReservationsOnSalesOrderCancel: enabled } });
}

let warehouseSeq = 1;
let itemSeq = 1;
let customerSeq = 1;

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

function createActiveCustomer(modules: WorkflowModules) {
  const seq = customerSeq++;
  return modules.customerRepository.create({
    code: `TEST-CUS-${seq}`,
    name: `Test Customer ${seq}`,
    isActive: true,
  });
}

function draftSalesOrderHeaderFor(warehouseId: string, customerId: string) {
  return {
    date: "2026-03-30",
    customerId,
    warehouseId,
    status: "draft" as const,
    comment: "",
  };
}

async function createConfirmedSalesOrder(
  modules: WorkflowModules,
  lines: Array<{ itemId: string; qty: number; unitPrice: number }>,
) {
  const warehouse = createActiveWarehouse(modules);
  const customer = createActiveCustomer(modules);
  const so = modules.salesOrderRepository.create(draftSalesOrderHeaderFor(warehouse.id, customer.id), lines);
  expect(await modules.confirmSalesOrder(so.id)).toEqual({ success: true });
  return modules.salesOrderRepository.getById(so.id)!;
}

function seedGoodStock(modules: WorkflowModules, itemId: string, warehouseId: string, qtyOnHand: number) {
  modules.stockBalanceRepository.upsert({
    itemId,
    warehouseId,
    qtyOnHand,
  });
}

function stableActiveReservationSnapshot(modules: WorkflowModules, soId: string) {
  return modules.stockReservationRepository
    .listActiveForSalesOrder(soId)
    .map((r) => ({
      salesOrderLineId: r.salesOrderLineId,
      warehouseId: r.warehouseId,
      itemId: r.itemId,
      qty: r.qty,
      status: r.status,
    }))
    .sort((a, b) => a.salesOrderLineId.localeCompare(b.salesOrderLineId, undefined, { numeric: true }));
}

beforeEach(() => {
  resetMockFs();
  vi.clearAllMocks();
  warehouseSeq = 1;
  itemSeq = 1;
  customerSeq = 1;
});

afterEach(async () => {
  const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
  await flushAllPendingPersistence();
});

describe.sequential("Sales order cancel workflow", () => {
  it("cancelling a confirmed sales order releases active reservations when release-on-cancel is enabled", async () => {
    const modules = await loadWorkflow();
    await setReleaseReservationsOnSalesOrderCancel(true);

    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 20);

    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    expect(modules.stockReservationRepository.listActiveForSalesOrder(so.id).length).toBeGreaterThan(0);
    expect(modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId)).toBe(10);

    const result = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Customer walked away",
    });
    expect(result).toEqual({ success: true });

    const updated = modules.salesOrderRepository.getById(so.id);
    expect(updated?.status).toBe("cancelled");
    expect(updated?.cancelReasonCode).toBe("OTHER");
    expect(updated?.cancelReasonComment).toBe("Customer walked away");

    expect(modules.stockReservationRepository.listActiveForSalesOrder(so.id)).toEqual([]);
    expect(modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId)).toBe(0);
    const releasedForSo = modules.stockReservationRepository
      .list()
      .filter((r) => r.salesOrderId === so.id && r.status === "released");
    expect(releasedForSo.length).toBeGreaterThan(0);
    expect(releasedForSo.every((r) => r.qty === 0)).toBe(true);

    const auditTypes = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType);
    expect(auditTypes).toContain("document_cancelled");
    expect(auditTypes).toContain("reservation_released");
    const releasedAudit = modules
      .listAuditEventsForEntity("sales_order", so.id)
      .find((e) => e.eventType === "reservation_released");
    expect(releasedAudit?.payload).toMatchObject({
      reason: "sales_order_cancelled",
      reservationsReleased: expect.any(Number),
    });
    expect((releasedAudit?.payload as { reservationsReleased?: number }).reservationsReleased).toBeGreaterThan(0);
  });

  it("cancelling a confirmed sales order keeps active reservations when release-on-cancel is disabled", async () => {
    const modules = await loadWorkflow();
    await setReleaseReservationsOnSalesOrderCancel(false);

    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 10, unitPrice: 5 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 20);

    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });
    const beforeActive = stableActiveReservationSnapshot(modules, so.id);
    expect(beforeActive.length).toBeGreaterThan(0);

    const result = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "No release path",
    });
    expect(result).toEqual({ success: true });

    const updated = modules.salesOrderRepository.getById(so.id);
    expect(updated?.status).toBe("cancelled");
    expect(updated?.cancelReasonCode).toBe("OTHER");
    expect(updated?.cancelReasonComment).toBe("No release path");

    expect(stableActiveReservationSnapshot(modules, so.id)).toEqual(beforeActive);
    expect(modules.stockReservationRepository.sumActiveQtyForSalesOrderItem(so.id, item.id, so.warehouseId)).toBe(10);

    const auditTypes = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType);
    expect(auditTypes).toContain("document_cancelled");
    expect(auditTypes).not.toContain("reservation_released");
  });

  it("cannot cancel a sales order that is already cancelled", async () => {
    const modules = await loadWorkflow();
    await setReleaseReservationsOnSalesOrderCancel(true);

    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 3, unitPrice: 1 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });

    expect(
      await modules.cancelSalesOrderDocument(so.id, {
        cancelReasonCode: "OTHER",
        cancelReasonComment: "First cancel",
      }),
    ).toEqual({ success: true });

    const cancelledAuditCount = modules
      .listAuditEventsForEntity("sales_order", so.id)
      .filter((e) => e.eventType === "document_cancelled").length;

    const second = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Try again",
    });
    expect(second).toEqual({
      success: false,
      error: "Only draft or confirmed sales orders can be cancelled.",
    });

    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("cancelled");
    expect(modules.salesOrderRepository.getById(so.id)?.cancelReasonComment).toBe("First cancel");

    const cancelledAfter = modules
      .listAuditEventsForEntity("sales_order", so.id)
      .filter((e) => e.eventType === "document_cancelled").length;
    expect(cancelledAfter).toBe(cancelledAuditCount);
  });

  it("cannot cancel a sales order in closed status", async () => {
    const modules = await loadWorkflow();
    await setReleaseReservationsOnSalesOrderCancel(true);

    const item = createActiveItem(modules);
    const so = await createConfirmedSalesOrder(modules, [{ itemId: item.id, qty: 5, unitPrice: 2 }]);
    seedGoodStock(modules, item.id, so.warehouseId, 10);
    expect(await modules.allocateSalesOrderStock(so.id)).toEqual({ success: true, linesTouched: 1 });

    modules.salesOrderRepository.update(so.id, { status: "closed" });
    const auditBefore = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id);

    const result = await modules.cancelSalesOrderDocument(so.id, {
      cancelReasonCode: "OTHER",
      cancelReasonComment: "Should not apply",
    });
    expect(result).toEqual({
      success: false,
      error: "Only draft or confirmed sales orders can be cancelled.",
    });

    expect(modules.salesOrderRepository.getById(so.id)?.status).toBe("closed");
    expect(modules.salesOrderRepository.getById(so.id)?.cancelReasonCode).toBeUndefined();

    const auditAfter = modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.id);
    expect(auditAfter.length).toBe(auditBefore.length);
    expect(modules.listAuditEventsForEntity("sales_order", so.id).map((e) => e.eventType)).not.toContain(
      "document_cancelled",
    );
    expect(modules.stockReservationRepository.listActiveForSalesOrder(so.id).length).toBeGreaterThan(0);
  });
});
