import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseDirectory, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { clearMockFsFailures, resetMockFs } from "../support/tauriFsMock";

async function readEnvelopeRecordCount(relativePath: string): Promise<number> {
  const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData });
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { records?: unknown[] };
  return Array.isArray(parsed.records) ? parsed.records.length : 0;
}

async function readItemsJsonItemCount(): Promise<number> {
  const bytes = await readFile("items/items.json", { baseDir: BaseDirectory.AppLocalData });
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { items?: unknown[] };
  return Array.isArray(parsed.items) ? parsed.items.length : 0;
}

beforeEach(() => {
  resetMockFs();
  clearMockFsFailures();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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

describe("resetPurchasingSalesOperationalStores", () => {
  it("dry run lists expected paths and does not clear persisted stores", async () => {
    vi.resetModules();
    const { purchaseOrderRepository } = await import("../../src/modules/purchase-orders/repository");
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );

    purchaseOrderRepository.create(
      {
        date: "2026-04-01",
        supplierId: "1",
        warehouseId: "1",
        status: "draft",
        comment: "",
      },
      [{ itemId: "1", qty: 1, unitPrice: 1 }],
    );
    await flushAllPendingPersistence();
    expect(await readEnvelopeRecordCount("documents/purchase-orders.json")).toBeGreaterThan(0);

    const result = await resetPurchasingSalesOperationalStores({ dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.persistenceMode).toBe("tauri_files");
    expect(result.clearedPaths).toContain("documents/purchase-orders.json");
    expect(result.clearedPaths).toContain("inventory/stock-movements.json");
    expect(result.clearedPaths).toContain("documents/audit/events.json");
    expect(result.clearedPaths.some((p) => p.includes("entity-attachments"))).toBe(true);

    expect(await readEnvelopeRecordCount("documents/purchase-orders.json")).toBeGreaterThan(0);
  });

  it("clears operational document and inventory stores", async () => {
    vi.resetModules();
    const modules = await loadReceiptWorkflow();
    const item = modules.itemRepository.create({
      code: "RST-ITEM",
      name: "Reset test item",
      uom: "EA",
      isActive: true,
    });
    const warehouse = modules.warehouseRepository.create({
      code: "RST-WH",
      name: "Reset WH",
      isActive: true,
    });
    const po = modules.purchaseOrderRepository.create(
      {
        date: "2026-04-02",
        supplierId: "1",
        warehouseId: warehouse.id,
        status: "draft",
        comment: "",
      },
      [{ itemId: item.id, qty: 2, unitPrice: 3 }],
    );
    expect(modules.confirmPurchaseOrder(po.id)).toEqual({ success: true });
    const createReceipt = await modules.createReceiptFromPurchaseOrder(po.id);
    expect(createReceipt.success).toBe(true);
    if (!createReceipt.success) return;
    expect(await modules.receiptService.post(createReceipt.receiptId)).toEqual({ success: true });

    modules.stockReservationRepository.upsertActiveForSalesOrderLine({
      warehouseId: warehouse.id,
      itemId: item.id,
      salesOrderId: "so-test",
      salesOrderLineId: "line-test",
      qty: 1,
    });

    const { appendAuditEvent } = await import("../../src/shared/audit/eventLogRepository");
    appendAuditEvent({
      entityType: "purchase_order",
      entityId: po.id,
      eventType: "document_created",
      actor: "test",
      payload: {},
    });

    await modules.flushAllPendingPersistence();
    expect(await readEnvelopeRecordCount("documents/purchase-orders.json")).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("documents/receipts.json")).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("inventory/stock-movements.json")).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("documents/audit/events.json")).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("inventory/stock-reservations.json")).toBeGreaterThan(0);

    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    const resetResult = await resetPurchasingSalesOperationalStores();
    expect(resetResult.success).toBe(true);
    expect(resetResult.errors).toEqual([]);

    expect(await readEnvelopeRecordCount("documents/purchase-orders.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/receipts.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/sales-orders.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/shipments.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/purchase-order-payments.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/sales-order-payments.json")).toBe(0);
    expect(await readEnvelopeRecordCount("documents/audit/events.json")).toBe(0);
    expect(await readEnvelopeRecordCount("inventory/stock-movements.json")).toBe(0);
    expect(await readEnvelopeRecordCount("inventory/stock-reservations.json")).toBe(0);
    expect(await readEnvelopeRecordCount("inventory/stock-balances.json")).toBe(0);
  });

  it("filters operational entity attachments and preserves customer rows", async () => {
    resetMockFs();
    vi.resetModules();

    const attachmentPayload = {
      version: 1,
      records: [
        {
          id: "1",
          entityType: "order",
          entityId: "po-1",
          fileName: "op.pdf",
          storageRef: "ref-op",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          entityType: "customer",
          entityId: "c-1",
          fileName: "cust.pdf",
          storageRef: "ref-c",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    await writeFile(
      "documents/entity-attachments.json",
      new TextEncoder().encode(JSON.stringify(attachmentPayload, null, 2)),
      { baseDir: BaseDirectory.AppLocalData },
    );

    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    const result = await resetPurchasingSalesOperationalStores();
    expect(result.success).toBe(true);
    expect(result.entityAttachmentOperationalRowsRemoved).toBe(1);

    const bytes = await readFile("documents/entity-attachments.json", {
      baseDir: BaseDirectory.AppLocalData,
    });
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      records: Array<{ entityType?: string }>;
    };
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].entityType).toBe("customer");
  });

  it("does not remove master data stores", async () => {
    vi.resetModules();
    const { itemRepository, ensureItemsLoaded, flushPendingItemsPersist } = await import(
      "../../src/modules/items/repository"
    );
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    const { flushPendingSupplierPersist } = await import("../../src/modules/suppliers/repository");
    await ensureItemsLoaded();
    expect(itemRepository.list().length).toBeGreaterThan(0);
    await flushPendingItemsPersist();
    await flushPendingSupplierPersist();
    await flushAllPendingPersistence();

    expect(await readItemsJsonItemCount()).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("master-data/suppliers.json")).toBeGreaterThan(0);

    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    await resetPurchasingSalesOperationalStores();

    expect(await readItemsJsonItemCount()).toBeGreaterThan(0);
    expect(await readEnvelopeRecordCount("master-data/suppliers.json")).toBeGreaterThan(0);
  });

  it("after reset, a new purchase order can be created with fresh numbering", async () => {
    vi.resetModules();
    const { purchaseOrderRepository } = await import("../../src/modules/purchase-orders/repository");
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );

    purchaseOrderRepository.create(
      {
        date: "2026-05-01",
        supplierId: "1",
        warehouseId: "1",
        status: "draft",
        comment: "old",
      },
      [{ itemId: "1", qty: 1, unitPrice: 1 }],
    );
    await flushAllPendingPersistence();
    await resetPurchasingSalesOperationalStores();

    vi.resetModules();
    const { purchaseOrderRepository: po2 } = await import("../../src/modules/purchase-orders/repository");
    const next = po2.create(
      {
        date: "2026-05-02",
        supplierId: "1",
        warehouseId: "1",
        status: "draft",
        comment: "new",
      },
      [{ itemId: "1", qty: 1, unitPrice: 2 }],
    );
    expect(next.number).toMatch(/^PO/);
    expect(po2.list()).toHaveLength(1);
  });
});

async function loadReceiptWorkflow() {
  const poService = await import("../../src/modules/purchase-orders/service");
  const poRepositoryModule = await import("../../src/modules/purchase-orders/repository");
  const receiptServiceModule = await import("../../src/modules/receipts/service");
  const receiptRepositoryModule = await import("../../src/modules/receipts/repository");
  const stockBalanceRepositoryModule = await import("../../src/modules/stock-balances/repository");
  const stockMovementRepositoryModule = await import("../../src/modules/stock-movements/repository");
  const stockReservationRepositoryModule = await import("../../src/modules/stock-reservations/repository");
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
    stockReservationRepository: stockReservationRepositoryModule.stockReservationRepository,
    itemRepository: itemRepositoryModule.itemRepository,
    warehouseRepository: warehouseRepositoryModule.warehouseRepository,
    flushAllPendingPersistence: persistenceCoordinator.flushAllPendingPersistence,
  };
}
