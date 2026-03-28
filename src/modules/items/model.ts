/**
 * Item entity per docs/01_product_core/02_Domain_Model.md.
 * Master data: sellable/receivable product.
 */

/** Image metadata; binary lives in app-local storage (see relativePath). Multiple images per item; at most one {@link ItemImage.isPrimary}. */
export interface ItemImage {
  id: string;
  fileName: string;
  /** Path relative to app local data dir (Tauri), e.g. `items/{id}/images/file.webp`. */
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

/** Barcode symbology / format (not GS1 application semantics). */
export type ItemBarcodeSymbology =
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "GS1_128"
  | "ITF_14"
  | "QR"
  | "GS1_QR"
  | "DATAMATRIX"
  | "GS1_DATAMATRIX"
  | "OTHER";

/** @deprecated Use {@link ItemBarcodeSymbology}; kept for gradual refactors. */
export type ItemBarcodeType = ItemBarcodeSymbology;

export type ItemBarcodePackagingLevel =
  | "UNIT"
  | "INNER"
  | "CASE"
  | "PALLET"
  | "LOGISTICS"
  | "CUSTOM";

/** Ordinary item barcode business role (not tester / markdown). */
export type ItemBarcodeRole = "SELLABLE" | "INTERNAL" | "SUPPLIER" | "LOGISTICS" | "OTHER";

/** Where the barcode value came from. */
export type ItemBarcodeSourceType = "MANUFACTURER" | "INTERNAL" | "SUPPLIER" | "GENERATED" | "OTHER";

export interface ItemBarcode {
  id: string;
  itemId: string;
  codeValue: string;
  symbology: ItemBarcodeSymbology;
  packagingLevel: ItemBarcodePackagingLevel;
  barcodeRole: ItemBarcodeRole;
  sourceType: ItemBarcodeSourceType;
  isPrimary: boolean;
  isActive: boolean;
  comment?: string;
}

export type ItemKind = "SELLABLE" | "TESTER";

export interface Item {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  accountingProfile?: string;
  brandId?: string;
  categoryId?: string;
  /**
   * Legacy flat barcode: derived summary from {@link Item.barcodes} for compatibility only.
   * Not authoritative; do not treat as the source of truth for lookups after migration.
   */
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
  images: ItemImage[];
  barcodes: ItemBarcode[];
  itemKind: ItemKind;
  baseItemId?: string;
  /**
   * Next numeric suffix for generated tester codes ({@code <baseCode>T01}).
   * Only meaningful for sellable (non-tester) base items; monotonic so codes are not reused after deletions.
   */
  testerCodeNextSeq?: number;
}
