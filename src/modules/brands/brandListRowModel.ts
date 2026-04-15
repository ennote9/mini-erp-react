import type { Brand } from "./model";

/** Row type for the Brands TanStack list — same shape as `Brand`; line numbers are view-derived. */
export type BrandListRow = Brand;

export function buildBrandListRows(brands: Brand[]): BrandListRow[] {
  return brands;
}
