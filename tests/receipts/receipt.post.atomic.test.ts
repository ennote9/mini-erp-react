import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockFsFailures, injectWriteFileFailure, resetMockFs } from "../support/tauriFsMock";

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
  };
}

function draftPoHeader(warehouseId: string) {
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

beforeEach(() => {
  resetMockFs();
  vi.clearAllMocks();
  warehouseSeq = 1;
  itemSeq = 1;
});

afterEach(async () => {
  clearMockFsFailures();
  try {
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    await flushAllPendingPersistence();
  } catch {
    // ignore
  }
});

describe.sequential("Receipt post atomicity", () => {
  it("rolls back in-memory state when persistence flush fails, then succeeds on retry", async () => {
    const modules = await loadWorkflow();
    const warehouse = modules.warehouseRepository.create({
      code: `WH-${warehouseSeq++}`,
      name: "W",
      isActive: true,
    });
    const item = modules.itemRepository.create({
      code: `IT-${itemSeq++}`,
      name: "I",
      uom: "EA",
      isActive: true,
    });
    const po = modules.purchaseOrderRepository.create(draftPoHeader(warehouse.id), [
      { itemId: item.id, qty: 10, unitPrice: 1 },
    ]);
    expect(modules.confirmPurchaseOrder(po.id)).toEqual({ success: true });
    const confirmed = modules.purchaseOrderRepository.getById(po.id)!;

    const createResult = await modules.createReceiptFromPurchaseOrder(confirmed.id);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const receiptId = createResult.receiptId;

    injectWriteFileFailure("stock-balances.json", { times: 1, message: "disk full" });

    const failPost = await modules.receiptService.post(receiptId);
    expect(failPost.success).toBe(false);

    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("draft");
    expect(
      modules.stockMovementRepository.list().filter((m) => m.sourceDocumentId === receiptId),
    ).toHaveLength(0);
    expect(
      modules.listAuditEventsForEntity("receipt", receiptId).some((e) => e.eventType === "document_posted"),
    ).toBe(false);

    const okPost = await modules.receiptService.post(receiptId);
    expect(okPost).toEqual({ success: true });
    expect(modules.receiptRepository.getById(receiptId)?.status).toBe("posted");
    expect(
      modules.stockMovementRepository.list().filter((m) => m.sourceDocumentId === receiptId && m.movementType === "receipt"),
    ).toHaveLength(1);
    expect(modules.listAuditEventsForEntity("receipt", receiptId).some((e) => e.eventType === "document_posted")).toBe(
      true,
    );
  });
});
