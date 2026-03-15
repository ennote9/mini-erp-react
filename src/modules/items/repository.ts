import type { Item } from "./model";

export type CreateItemInput = Omit<Item, "id">;
export type UpdateItemPatch = Partial<Omit<Item, "id">>;

const store: Item[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
}

export const itemRepository = {
  list(): Item[] {
    return [...store];
  },

  getById(id: string): Item | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateItemInput): Item {
    const item: Item = { ...input, id: nextIdStr() };
    store.push(item);
    return item;
  },

  update(id: string, patch: UpdateItemPatch): Item | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    return store[i];
  },

  search(query: string): Item[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

// Minimal seed for demo
const seed: CreateItemInput[] = [
  { code: "ITEM-001", name: "Widget A", uom: "EA", isActive: true },
  { code: "ITEM-002", name: "Widget B", uom: "EA", isActive: true },
];
seed.forEach((s) => itemRepository.create(s));
