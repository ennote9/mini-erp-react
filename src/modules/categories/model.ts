/**
 * Category entity — master data for product categories.
 * Referenced by Item via categoryId.
 */
export interface Category {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
}
