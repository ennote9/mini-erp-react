import type { Item, ItemImage } from "./model";
import { brandRepository } from "../brands/repository";
import { categoryRepository } from "../categories/repository";

export type CreateItemInput = Omit<Item, "id" | "images"> & { images?: ItemImage[] };
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
    const item: Item = {
      ...input,
      id: nextIdStr(),
      images: input.images ?? [],
    };
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

// Map brand code → id and category code → id for seed (repositories seeded on load)
const brandByCode = (() => {
  const map: Record<string, string> = {};
  brandRepository.list().forEach((b) => {
    map[b.code] = b.id;
  });
  return map;
})();
const categoryByCode = (() => {
  const map: Record<string, string> = {};
  categoryRepository.list().forEach((c) => {
    map[c.code] = c.id;
  });
  return map;
})();

// Demo seed: ~25 items for list testing (brandId and categoryId from directories)
const seed: CreateItemInput[] = [
  { code: "ITEM-001", name: "Widget A", uom: "EA", isActive: true, brandId: brandByCode["ACME"], categoryId: categoryByCode["COMPONENTS"], barcode: "5901234123457", purchasePrice: 4.5, salePrice: 7.99 },
  { code: "ITEM-002", name: "Widget B", uom: "EA", isActive: true, brandId: brandByCode["ACME"], categoryId: categoryByCode["COMPONENTS"], barcode: "5901234123458", purchasePrice: 5.2, salePrice: 9.5 },
  { code: "ITEM-003", name: "Steel Bracket 50mm", uom: "EA", isActive: true, brandId: brandByCode["METALWORKS"], categoryId: categoryByCode["HARDWARE"], barcode: "5901234123459", purchasePrice: 2.1, salePrice: 3.5 },
  { code: "ITEM-004", name: "Aluminum Channel 1m", uom: "EA", isActive: true, brandId: brandByCode["METALWORKS"], categoryId: categoryByCode["HARDWARE"], barcode: "5901234123460", purchasePrice: 12, salePrice: 18 },
  { code: "ITEM-005", name: "Assembly Kit Type A", uom: "BOX", isActive: true, brandId: brandByCode["ACME"], categoryId: categoryByCode["KITS"], barcode: "5901234123461", purchasePrice: 25, salePrice: 39 },
  { code: "ITEM-006", name: "Assembly Kit Type B", uom: "BOX", isActive: true, brandId: brandByCode["ACME"], categoryId: categoryByCode["KITS"], barcode: "5901234123462", purchasePrice: 32, salePrice: 49 },
  { code: "ITEM-007", name: "O-Ring Set 10pc", uom: "PK", isActive: true, brandId: brandByCode["SEALPRO"], categoryId: categoryByCode["SEALS"], barcode: "5901234123463", purchasePrice: 3.5, salePrice: 5.5 },
  { code: "ITEM-008", name: "Gasket Sheet 1m²", uom: "EA", isActive: true, brandId: brandByCode["SEALPRO"], categoryId: categoryByCode["SEALS"], barcode: "5901234123464", purchasePrice: 18, salePrice: 28 },
  { code: "ITEM-009", name: "Fastener M6x20", uom: "PK", isActive: true, brandId: brandByCode["BOLTCO"], categoryId: categoryByCode["FASTENERS"], barcode: "5901234123465", purchasePrice: 2.8, salePrice: 4.2 },
  { code: "ITEM-010", name: "Fastener M8x25", uom: "PK", isActive: true, brandId: brandByCode["BOLTCO"], categoryId: categoryByCode["FASTENERS"], barcode: "5901234123466", purchasePrice: 3.5, salePrice: 5.5 },
  { code: "ITEM-011", name: "Grease Cartridge 400g", uom: "EA", isActive: true, brandId: brandByCode["LUBEMAX"], categoryId: categoryByCode["CONSUMABLES"], barcode: "5901234123467", purchasePrice: 6, salePrice: 9.5 },
  { code: "ITEM-012", name: "Coolant 5L", uom: "EA", isActive: true, brandId: brandByCode["LUBEMAX"], categoryId: categoryByCode["CONSUMABLES"], barcode: "5901234123468", purchasePrice: 22, salePrice: 35 },
  { code: "ITEM-013", name: "Filter Element Air", uom: "EA", isActive: true, brandId: brandByCode["FILTERTECH"], categoryId: categoryByCode["FILTERS"], barcode: "5901234123469", purchasePrice: 8, salePrice: 14 },
  { code: "ITEM-014", name: "Filter Element Oil", uom: "EA", isActive: true, brandId: brandByCode["FILTERTECH"], categoryId: categoryByCode["FILTERS"], barcode: "5901234123470", purchasePrice: 9, salePrice: 15 },
  { code: "ITEM-015", name: "Drive Belt V-Type", uom: "EA", isActive: true, brandId: brandByCode["DRIVEPARTS"], categoryId: categoryByCode["TRANSMISSION"], barcode: "5901234123471", purchasePrice: 15, salePrice: 24 },
  { code: "ITEM-016", name: "Seal Kit Standard", uom: "BOX", isActive: true, brandId: brandByCode["SEALPRO"], categoryId: categoryByCode["SEALS"], barcode: "5901234123472", purchasePrice: 45, salePrice: 69 },
  { code: "ITEM-017", name: "Control Board Rev.2", uom: "EA", isActive: true, brandId: brandByCode["ELECTROLOGIC"], categoryId: categoryByCode["ELECTRONICS"], barcode: "5901234123473", purchasePrice: 85, salePrice: 129 },
  { code: "ITEM-018", name: "Sensor Proximity 24V", uom: "EA", isActive: true, brandId: brandByCode["ELECTROLOGIC"], categoryId: categoryByCode["SENSORS"], barcode: "5901234123474", purchasePrice: 28, salePrice: 42 },
  { code: "ITEM-019", name: "Cable Assembly 2m", uom: "EA", isActive: true, brandId: brandByCode["ELECTROLOGIC"], categoryId: categoryByCode["CABLES"], barcode: "5901234123475", purchasePrice: 12, salePrice: 19 },
  { code: "ITEM-020", name: "Display Unit 7\"", uom: "EA", isActive: true, brandId: brandByCode["DISPLAYTECH"], categoryId: categoryByCode["ELECTRONICS"], barcode: "5901234123476", purchasePrice: 55, salePrice: 89 },
  { code: "ITEM-021", name: "Spacer Ring 12mm", uom: "PK", isActive: true, brandId: brandByCode["BOLTCO"], categoryId: categoryByCode["HARDWARE"], barcode: "5901234123477", purchasePrice: 1.5, salePrice: 2.5 },
  { code: "ITEM-022", name: "Washer M10", uom: "PK", isActive: true, brandId: brandByCode["BOLTCO"], categoryId: categoryByCode["FASTENERS"], barcode: "5901234123478", purchasePrice: 0.8, salePrice: 1.5 },
  { code: "ITEM-023", name: "Legacy Adapter Plate", uom: "EA", isActive: false, brandId: brandByCode["METALWORKS"], categoryId: categoryByCode["HARDWARE"], barcode: "5901234123479", purchasePrice: 20, salePrice: 0 },
  { code: "ITEM-024", name: "Obsolete Gasket Old", uom: "EA", isActive: false, brandId: brandByCode["SEALPRO"], categoryId: categoryByCode["SEALS"], purchasePrice: 5, salePrice: 0 },
  { code: "ITEM-025", name: "Spare Parts Kit Basic", uom: "CTN", isActive: true, brandId: brandByCode["ACME"], categoryId: categoryByCode["KITS"], barcode: "5901234123480", purchasePrice: 60, salePrice: 95 },
];
seed.forEach((s) => itemRepository.create(s));
