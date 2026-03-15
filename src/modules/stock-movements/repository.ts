import type { StockMovement } from "./model";

export type CreateStockMovementInput = Omit<StockMovement, "id">;

const store: StockMovement[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
}

export const stockMovementRepository = {
  list(): StockMovement[] {
    return [...store];
  },

  /** Append a movement. Foundation for future post logic. */
  create(input: CreateStockMovementInput): StockMovement {
    const movement: StockMovement = { ...input, id: nextIdStr() };
    store.push(movement);
    return movement;
  },
};
