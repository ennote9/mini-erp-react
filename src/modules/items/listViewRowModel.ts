import type { Brand } from "@/modules/brands/model";
import type { Category } from "@/modules/categories/model";
import type { Item } from "./model";

export type ItemListRow = {
  id: string;
  code: string;
  name: string;
  itemKind: Item["itemKind"];
  uom: string;
  accountingProfile?: string;
  purchasePrice?: number;
  salePrice?: number;
  isActive: boolean;
  description?: string;
  brandId?: string;
  categoryId?: string;
  brand: string;
  category: string;
  brandName: string;
  categoryName: string;
  imageCount: number;
  hasImages: boolean;
  barcode: string;
  primaryBarcode: string;
  barcodeCount: number;
  hasBarcode: boolean;
  testerCount: number;
  hasTesters: boolean;
};

type TesterStats = { count: number; firstCode: string; firstName: string };

function buildTesterStats(items: Item[]): Map<string, TesterStats> {
  const map = new Map<string, TesterStats>();
  for (const item of items) {
    if (item.itemKind !== "TESTER" || !item.baseItemId) continue;
    const key = item.baseItemId;
    const current = map.get(key) ?? { count: 0, firstCode: "", firstName: "" };
    map.set(key, {
      count: current.count + 1,
      firstCode: current.firstCode || item.code,
      firstName: current.firstName || item.name,
    });
  }
  return map;
}

function resolveBarcodeStats(item: Item): {
  count: number;
  hasBarcode: boolean;
  primaryBarcode: string;
} {
  const barcodes = Array.isArray(item.barcodes) ? item.barcodes : [];
  const count = barcodes.length > 0 ? barcodes.length : item.barcode ? 1 : 0;
  const active = barcodes.filter((barcode) => barcode.isActive !== false);
  const primary = active.find((barcode) => barcode.isPrimary) ?? active[0] ?? barcodes[0] ?? null;
  const primaryBarcode = primary?.codeValue ?? item.barcode ?? "";
  return {
    count,
    hasBarcode: count > 0,
    primaryBarcode,
  };
}

export function buildItemListRows(input: {
  items: Item[];
  brands: Brand[];
  categories: Category[];
}): ItemListRow[] {
  const { items, brands, categories } = input;
  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const testerStatsByBaseId = buildTesterStats(items);

  return items.map((item) => {
    const imageCount = Array.isArray(item.images) ? item.images.length : 0;
    const barcodeStats = resolveBarcodeStats(item);
    const testerStats =
      item.itemKind === "SELLABLE" ? testerStatsByBaseId.get(item.id) ?? { count: 0, firstCode: "", firstName: "" } : { count: 0, firstCode: "", firstName: "" };

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      itemKind: item.itemKind,
      uom: item.uom,
      accountingProfile: item.accountingProfile,
      purchasePrice: item.purchasePrice,
      salePrice: item.salePrice,
      isActive: item.isActive,
      description: item.description,
      brandId: item.brandId,
      categoryId: item.categoryId,
      brand: item.brandId ? brandNameById.get(item.brandId) ?? "" : "",
      category: item.categoryId ? categoryNameById.get(item.categoryId) ?? "" : "",
      brandName: item.brandId ? brandNameById.get(item.brandId) ?? "" : "",
      categoryName: item.categoryId ? categoryNameById.get(item.categoryId) ?? "" : "",
      imageCount,
      hasImages: imageCount > 0,
      barcode: barcodeStats.primaryBarcode,
      primaryBarcode: barcodeStats.primaryBarcode,
      barcodeCount: barcodeStats.count,
      hasBarcode: barcodeStats.hasBarcode,
      testerCount: testerStats.count,
      hasTesters: testerStats.count > 0,
    };
  });
}
