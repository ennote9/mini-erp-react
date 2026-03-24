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

export type ItemBarcodeType =
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

export type ItemBarcodePackagingLevel =
  | "UNIT"
  | "INNER"
  | "CASE"
  | "PALLET"
  | "LOGISTICS"
  | "CUSTOM";

export interface ItemBarcode {
  id: string;
  itemId: string;
  codeValue: string;
  barcodeType: ItemBarcodeType;
  packagingLevel: ItemBarcodePackagingLevel;
  isPrimary: boolean;
  isActive: boolean;
  comment?: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  brandId?: string;
  categoryId?: string;
  /** Legacy flat barcode field retained for compatibility; bridged from barcodes collection. */
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
  images: ItemImage[];
  barcodes: ItemBarcode[];
}
