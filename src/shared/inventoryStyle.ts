export type StockStyle = "GOOD" | "MARKDOWN" | "DEFECT";

export const STOCK_STYLE_VALUES: StockStyle[] = [
  "GOOD",
  "MARKDOWN",
  "DEFECT",
];

export const DEFAULT_STOCK_STYLE: StockStyle = "GOOD";

export function isStockStyle(value: unknown): value is StockStyle {
  return (
    value === "GOOD" || value === "MARKDOWN" || value === "DEFECT"
  );
}

export function normalizeStockStyle(
  value: unknown,
  fallback: StockStyle = DEFAULT_STOCK_STYLE,
): StockStyle {
  return isStockStyle(value) ? value : fallback;
}

export type WarehouseStylePolicy =
  | "ANY"
  | "GOOD_ONLY"
  | "MARKDOWN_ONLY"
  | "DEFECT_ONLY";

export const WAREHOUSE_STYLE_POLICY_VALUES: WarehouseStylePolicy[] = [
  "ANY",
  "GOOD_ONLY",
  "MARKDOWN_ONLY",
  "DEFECT_ONLY",
];

export const DEFAULT_WAREHOUSE_STYLE_POLICY: WarehouseStylePolicy = "ANY";

export function isWarehouseStylePolicy(
  value: unknown,
): value is WarehouseStylePolicy {
  return (
    value === "ANY" ||
    value === "GOOD_ONLY" ||
    value === "MARKDOWN_ONLY" ||
    value === "DEFECT_ONLY"
  );
}

export function normalizeWarehouseStylePolicy(
  value: unknown,
  fallback: WarehouseStylePolicy = DEFAULT_WAREHOUSE_STYLE_POLICY,
): WarehouseStylePolicy {
  return isWarehouseStylePolicy(value) ? value : fallback;
}

export function warehouseStylePolicyAllowsStyle(
  policy: WarehouseStylePolicy | undefined,
  style: StockStyle,
): boolean {
  const effective = normalizeWarehouseStylePolicy(policy);
  if (effective === "ANY") return true;
  if (effective === "GOOD_ONLY") return style === "GOOD";
  if (effective === "MARKDOWN_ONLY") return style === "MARKDOWN";
  return style === "DEFECT";
}
