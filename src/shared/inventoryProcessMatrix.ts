import {
  normalizeWarehouseStylePolicy,
  warehouseStylePolicyAllowsStyle,
  type StockStyle,
  type WarehouseStylePolicy,
} from "./inventoryStyle";

export const GOODS_ACCOUNTING_PROFILE = "GOODS" as const;

export type GoodsStyleProcessCapability =
  | "receipt"
  | "storage"
  | "reservation"
  | "shipment"
  | "markdownTransition"
  | "barcodeLookup"
  | "labelPrinting";

type GoodsStyleMatrixRule = {
  allowedWarehousePolicies: WarehouseStylePolicy[];
  blockedWarehousePolicies: WarehouseStylePolicy[];
  capabilities: Record<GoodsStyleProcessCapability, boolean>;
};

type ItemProfileLike = {
  itemKind?: string;
  accountingProfile?: string;
};

export const GOODS_STYLE_PROCESS_MATRIX: Record<StockStyle, GoodsStyleMatrixRule> = {
  GOOD: {
    allowedWarehousePolicies: ["ANY", "GOOD_ONLY"],
    blockedWarehousePolicies: ["MARKDOWN_ONLY", "DEFECT_ONLY"],
    capabilities: {
      receipt: true,
      storage: true,
      reservation: true,
      shipment: true,
      markdownTransition: true,
      barcodeLookup: false,
      labelPrinting: false,
    },
  },
  MARKDOWN: {
    allowedWarehousePolicies: ["ANY", "MARKDOWN_ONLY"],
    blockedWarehousePolicies: ["GOOD_ONLY", "DEFECT_ONLY"],
    capabilities: {
      receipt: false,
      storage: true,
      reservation: false,
      shipment: true,
      markdownTransition: false,
      barcodeLookup: true,
      labelPrinting: true,
    },
  },
  DEFECT: {
    allowedWarehousePolicies: ["ANY", "DEFECT_ONLY"],
    blockedWarehousePolicies: ["GOOD_ONLY", "MARKDOWN_ONLY"],
    capabilities: {
      receipt: false,
      storage: true,
      reservation: false,
      shipment: false,
      markdownTransition: false,
      barcodeLookup: false,
      labelPrinting: false,
    },
  },
};

export function normalizeAccountingProfileCode(value: string | undefined): string | undefined {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return normalized || undefined;
}

export function resolveItemAccountingProfileCode(item: ItemProfileLike): string {
  if ((item.itemKind ?? "").toUpperCase() === "TESTER") return "TESTER";
  return normalizeAccountingProfileCode(item.accountingProfile) ?? GOODS_ACCOUNTING_PROFILE;
}

export function isGoodsAccountingProfileCode(value: string | undefined): value is typeof GOODS_ACCOUNTING_PROFILE {
  return value === GOODS_ACCOUNTING_PROFILE;
}

export function itemUsesGoodsProcessMatrix(item: ItemProfileLike): boolean {
  return isGoodsAccountingProfileCode(resolveItemAccountingProfileCode(item));
}

export function goodsStyleSupportsProcess(
  style: StockStyle,
  capability: GoodsStyleProcessCapability,
): boolean {
  return GOODS_STYLE_PROCESS_MATRIX[style].capabilities[capability];
}

export function goodsStyleAllowedInWarehousePolicy(
  style: StockStyle,
  policy: WarehouseStylePolicy | undefined,
): boolean {
  const effective = normalizeWarehouseStylePolicy(policy);
  return (
    GOODS_STYLE_PROCESS_MATRIX[style].allowedWarehousePolicies.includes(effective) &&
    warehouseStylePolicyAllowsStyle(effective, style)
  );
}

export function listAllowedGoodsStylesForWarehousePolicy(
  policy: WarehouseStylePolicy | undefined,
): StockStyle[] {
  const effective = normalizeWarehouseStylePolicy(policy);
  return (Object.keys(GOODS_STYLE_PROCESS_MATRIX) as StockStyle[]).filter((style) =>
    goodsStyleAllowedInWarehousePolicy(style, effective),
  );
}
