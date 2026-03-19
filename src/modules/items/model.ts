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

export interface Item {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  brandId?: string;
  categoryId?: string;
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
  images: ItemImage[];
}
