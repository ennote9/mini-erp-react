/**
 * Brand entity — master data for product brands.
 * Referenced by Item via brandId.
 */
export interface Brand {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
}
