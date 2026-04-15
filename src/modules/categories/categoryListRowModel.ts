import type { Category } from "./model";

/** Row type for the Categories TanStack list — same shape as `Category`; line numbers are view-derived. */
export type CategoryListRow = Category;

export function buildCategoryListRows(categories: Category[]): CategoryListRow[] {
  return categories;
}
