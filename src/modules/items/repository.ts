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

// Demo seed: ~25 items for list testing
const seed: CreateItemInput[] = [
  { code: "ITEM-001", name: "Widget A", uom: "EA", isActive: true },
  { code: "ITEM-002", name: "Widget B", uom: "EA", isActive: true },
  { code: "ITEM-003", name: "Steel Bracket 50mm", uom: "EA", isActive: true },
  { code: "ITEM-004", name: "Aluminum Channel 1m", uom: "EA", isActive: true },
  { code: "ITEM-005", name: "Assembly Kit Type A", uom: "BOX", isActive: true },
  { code: "ITEM-006", name: "Assembly Kit Type B", uom: "BOX", isActive: true },
  { code: "ITEM-007", name: "O-Ring Set 10pc", uom: "PK", isActive: true },
  { code: "ITEM-008", name: "Gasket Sheet 1m²", uom: "EA", isActive: true },
  { code: "ITEM-009", name: "Fastener M6x20", uom: "PK", isActive: true },
  { code: "ITEM-010", name: "Fastener M8x25", uom: "PK", isActive: true },
  { code: "ITEM-011", name: "Grease Cartridge 400g", uom: "EA", isActive: true },
  { code: "ITEM-012", name: "Coolant 5L", uom: "EA", isActive: true },
  { code: "ITEM-013", name: "Filter Element Air", uom: "EA", isActive: true },
  { code: "ITEM-014", name: "Filter Element Oil", uom: "EA", isActive: true },
  { code: "ITEM-015", name: "Drive Belt V-Type", uom: "EA", isActive: true },
  { code: "ITEM-016", name: "Seal Kit Standard", uom: "BOX", isActive: true },
  { code: "ITEM-017", name: "Control Board Rev.2", uom: "EA", isActive: true },
  { code: "ITEM-018", name: "Sensor Proximity 24V", uom: "EA", isActive: true },
  { code: "ITEM-019", name: "Cable Assembly 2m", uom: "EA", isActive: true },
  { code: "ITEM-020", name: "Display Unit 7\"", uom: "EA", isActive: true },
  { code: "ITEM-021", name: "Spacer Ring 12mm", uom: "PK", isActive: true },
  { code: "ITEM-022", name: "Washer M10", uom: "PK", isActive: true },
  { code: "ITEM-023", name: "Legacy Adapter Plate", uom: "EA", isActive: false },
  { code: "ITEM-024", name: "Obsolete Gasket Old", uom: "EA", isActive: false },
  { code: "ITEM-025", name: "Spare Parts Kit Basic", uom: "CTN", isActive: true },
];
seed.forEach((s) => itemRepository.create(s));
