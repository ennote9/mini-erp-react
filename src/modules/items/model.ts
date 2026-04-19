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

/** Base purchase / sale price history (v1). Source of truth; {@link Item.purchasePrice} / {@link Item.salePrice} are denormalized snapshots. */
export type ItemPriceType = "purchase" | "sale";

export type ItemPriceReasonCode =
  | "initial_migration"
  | "manual_update"
  | "supplier_change"
  | "commercial_review"
  | "correction"
  | "other";

export interface ItemPriceRecord {
  id: string;
  itemId: string;
  priceType: ItemPriceType;
  amount: number;
  validFrom: string;
  validTo?: string;
  reasonCode: ItemPriceReasonCode;
  comment?: string;
  createdAt: string;
  cancelledAt?: string;
}

/** Direct item-level responsibility roles (v1). One employee per role per item. */
export type ItemResponsibleRoleCode =
  | "content_manager"
  | "category_manager"
  | "brand_manager"
  | "buyer"
  | "sales_manager"
  | "operations_owner";

export interface ItemResponsibleAssignment {
  id: string;
  roleCode: ItemResponsibleRoleCode;
  employeeId: string;
  note: string;
  /** ISO datetime */
  assignedAt: string;
  assignedByEmployeeId: string | null;
}

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
  /**
   * Denormalized: current effective base purchase price as of "today" in session (see price sync).
   * Authoritative history is {@link priceHistory}.
   */
  purchasePrice?: number;
  /**
   * Denormalized: current effective base sale price as of "today" in session.
   */
  salePrice?: number;
  /** Base price history; when absent, treat as legacy flat-price-only item. */
  priceHistory?: ItemPriceRecord[];
  images: ItemImage[];
  barcodes: ItemBarcode[];
  itemKind: ItemKind;
  baseItemId?: string;
  /**
   * Next numeric suffix for generated tester codes ({@code <baseCode>T01}).
   * Only meaningful for sellable (non-tester) base items; monotonic so codes are not reused after deletions.
   */
  testerCodeNextSeq?: number;
  /** Direct nominations on this item; brand/category context is read-only elsewhere. */
  responsibleAssignments?: ItemResponsibleAssignment[];
  /** Localized / alternate display name for translation stickers (optional). */
  translationName?: string;
  /** Extra translation copy (optional). */
  translationDescription?: string;
  /**
   * Generic marking / traceability payload (e.g. DataMatrix content, GS1 string).
   * Not validated against government schemas in-app.
   */
  markingCode?: string;
  /** КИЗ / identification placeholder for label workflows (optional). */
  kizCode?: string;
}
