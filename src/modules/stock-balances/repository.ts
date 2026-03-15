import type { StockBalance } from "./model";

export type UpsertStockBalanceInput = Omit<StockBalance, "id">;

const store: StockBalance[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
}

export const stockBalanceRepository = {
  list(): StockBalance[] {
    return [...store];
  },

  getByItemAndWarehouse(
    itemId: string,
    warehouseId: string,
  ): StockBalance | undefined {
    return store.find(
      (x) => x.itemId === itemId && x.warehouseId === warehouseId,
    );
  },

  /** Insert or replace balance for item+warehouse. Foundation for future post logic. */
  upsert(data: UpsertStockBalanceInput): StockBalance {
    const i = store.findIndex(
      (x) => x.itemId === data.itemId && x.warehouseId === data.warehouseId,
    );
    if (i >= 0) {
      store[i] = { ...data, id: store[i].id };
      return store[i];
    }
    const balance: StockBalance = { ...data, id: nextIdStr() };
    store.push(balance);
    return balance;
  },
};

// Minimal seed: one balance for item 1 / warehouse 1
stockBalanceRepository.upsert({
  itemId: "1",
  warehouseId: "1",
  qtyOnHand: 0,
});
