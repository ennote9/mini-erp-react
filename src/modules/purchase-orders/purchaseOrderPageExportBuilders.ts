import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { itemRepository } from "@/modules/items/repository";
import { lineAmountMoney, roundMoney } from "@/shared/commercialMoney";
import type { PoExportLineRow } from "./poExport";
import type { LineFormRow, LineWithItem } from "./purchaseOrderPageModel";

export function buildExportRowsFromFormLines(lines: LineFormRow[]): PoExportLineRow[] {
  return lines.map((line, idx) => {
    const item = itemRepository.getById(line.itemId);
    const qty = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
    const unitPrice =
      typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) && line.unitPrice >= 0
        ? roundMoney(line.unitPrice)
        : 0;
    const lineAmount = lineAmountMoney(qty, unitPrice);
    const brand = item?.brandId ? brandRepository.getById(item.brandId)?.code ?? "" : "";
    const category = item?.categoryId ? categoryRepository.getById(item.categoryId)?.code ?? "" : "";
    return {
      no: idx + 1,
      itemCode: item?.code ?? line.itemId,
      itemName: item?.name ?? line.itemId,
      brand,
      category,
      qty,
      unitPrice,
      lineAmount,
    };
  });
}

export function buildExportRowsFromLinesWithItem(lines: LineWithItem[]): PoExportLineRow[] {
  return lines.map((line, idx) => {
    const item = itemRepository.getById(line.itemId);
    const qty = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
    const unitPrice =
      typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) && line.unitPrice >= 0
        ? roundMoney(line.unitPrice)
        : 0;
    const lineAmount = lineAmountMoney(qty, unitPrice);
    const brand = item?.brandId ? brandRepository.getById(item.brandId)?.code ?? "" : "";
    const category = item?.categoryId ? categoryRepository.getById(item.categoryId)?.code ?? "" : "";
    return {
      no: idx + 1,
      itemCode: item?.code ?? line.itemId,
      itemName: line.itemName ?? item?.name ?? line.itemId,
      brand,
      category,
      qty,
      unitPrice,
      lineAmount,
    };
  });
}
