/**
 * Dev-only hook for Playwright: exposes repositories and pricing helpers on `window`.
 * Stripped from production builds (`import.meta.env.DEV` is false).
 */
import { ensureItemsLoaded, flushPendingItemsPersist, itemRepository } from "@/modules/items/repository";
import {
  applyItemPriceAwaitPersist,
  cancelScheduledItemPriceAwaitPersist,
  getEffectiveItemBasePriceOrZero,
} from "@/modules/items/itemPriceService";
import { markdownRepository, flushPendingMarkdownPersist } from "@/modules/markdown-journal/repository";
import {
  customerAgreementRepository,
  flushPendingCustomerAgreementPersist,
} from "@/modules/customer-agreements/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { customerRepository, flushPendingCustomerPersist } from "@/modules/customers/repository";
import type { UpdateItemPatch } from "@/modules/items/repository";
import { purchaseOrderRepository, flushPendingPurchaseOrderPersist } from "@/modules/purchase-orders/repository";
import { salesOrderRepository, flushPendingSalesOrderPersist } from "@/modules/sales-orders/repository";
import { employeeRepository, flushPendingEmployeePersist } from "@/modules/employees/repository";
import { flushPendingLabelWrites } from "@/modules/labels/service";

export type MiniErpE2eApi = {
  itemRepository: typeof itemRepository;
  applyItemPriceAwaitPersist: typeof applyItemPriceAwaitPersist;
  cancelScheduledItemPriceAwaitPersist: typeof cancelScheduledItemPriceAwaitPersist;
  getEffectiveItemBasePriceOrZero: typeof getEffectiveItemBasePriceOrZero;
  markdownRepository: typeof markdownRepository;
  customerAgreementRepository: typeof customerAgreementRepository;
  warehouseRepository: typeof warehouseRepository;
  customerRepository: typeof customerRepository;
  purchaseOrderRepository: typeof purchaseOrderRepository;
  salesOrderRepository: typeof salesOrderRepository;
  employeeRepository: typeof employeeRepository;
  /** Persists items + markdown + customer-agreement queues (best-effort). */
  flushAll: () => Promise<void>;
  /** Direct update for deterministic seeding (use sparingly in tests). */
  patchItem: (id: string, patch: UpdateItemPatch) => Promise<void>;
};

declare global {
  interface Window {
    __MINI_ERP_E2E__?: MiniErpE2eApi;
  }
}

async function flushAll(): Promise<void> {
  await flushPendingItemsPersist().catch(() => undefined);
  await flushPendingMarkdownPersist().catch(() => undefined);
  await flushPendingCustomerAgreementPersist().catch(() => undefined);
  await flushPendingCustomerPersist().catch(() => undefined);
  await flushPendingPurchaseOrderPersist().catch(() => undefined);
  await flushPendingSalesOrderPersist().catch(() => undefined);
  await flushPendingEmployeePersist().catch(() => undefined);
  await flushPendingLabelWrites().catch(() => undefined);
}

async function patchItem(id: string, patch: UpdateItemPatch): Promise<void> {
  const prev = itemRepository.getById(id);
  if (!prev) throw new Error(`patchItem: item ${id} not found`);
  itemRepository.update(id, patch);
  await flushPendingItemsPersist();
}

function attach(): void {
  window.__MINI_ERP_E2E__ = {
    itemRepository,
    applyItemPriceAwaitPersist,
    cancelScheduledItemPriceAwaitPersist,
    getEffectiveItemBasePriceOrZero,
    markdownRepository,
    customerAgreementRepository,
    warehouseRepository,
    customerRepository,
    purchaseOrderRepository,
    salesOrderRepository,
    employeeRepository,
    flushAll,
    patchItem,
  };
}

if (import.meta.env.DEV) {
  attach();
  void ensureItemsLoaded()
    .then(() => {
      attach();
    })
    .catch(() => {
      attach();
    });
}
