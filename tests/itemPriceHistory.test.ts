import { describe, expect, it } from "vitest";
import type { Item, ItemPriceRecord } from "../src/modules/items/model";
import {
  applyNewPriceToItem,
  compareYmd,
  getEffectiveItemBasePrice,
  migrateLegacyFlatPricesToHistory,
  todayYmdLocal,
} from "../src/modules/items/lib/itemPriceHistory";

function baseItem(over: Partial<Item> = {}): Item {
  return {
    id: "1",
    code: "T1",
    name: "Test",
    uom: "EA",
    isActive: true,
    images: [],
    barcodes: [],
    itemKind: "SELLABLE",
    ...over,
  };
}

describe("itemPriceHistory", () => {
  it("getEffectiveItemBasePrice uses document date and history", () => {
    const item = baseItem({
      priceHistory: [
        {
          id: "a",
          itemId: "1",
          priceType: "purchase",
          amount: 10,
          validFrom: "2026-01-01",
          validTo: "2026-06-30",
          reasonCode: "manual_update",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "b",
          itemId: "1",
          priceType: "purchase",
          amount: 20,
          validFrom: "2026-07-01",
          reasonCode: "manual_update",
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    expect(getEffectiveItemBasePrice(item, "purchase", "2026-03-15")).toBe(10);
    expect(getEffectiveItemBasePrice(item, "purchase", "2026-07-15")).toBe(20);
  });

  it("applyNewPriceToItem today closes previous active purchase", () => {
    const today = todayYmdLocal();
    const item = baseItem({
      purchasePrice: 5,
      priceHistory: [
        {
          id: "old",
          itemId: "1",
          priceType: "purchase",
          amount: 5,
          validFrom: today,
          reasonCode: "manual_update",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const r = applyNewPriceToItem(item, {
      priceType: "purchase",
      amount: 9,
      validFromYmd: today,
      reasonCode: "commercial_review",
      todayYmd: today,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hist = r.item.priceHistory ?? [];
    const closed = hist.find((x) => x.id === "old");
    expect(closed?.validTo).toBeDefined();
    expect(r.item.purchasePrice).toBe(9);
  });

  it("migrateLegacyFlatPricesToHistory seeds from flat prices once", () => {
    const item = baseItem({ purchasePrice: 12, salePrice: 34 });
    const m = migrateLegacyFlatPricesToHistory(item, "2026-04-15", "2026-04-15T12:00:00.000Z");
    expect(m.priceHistory?.length).toBe(2);
    expect(m.purchasePrice).toBe(12);
    expect(m.salePrice).toBe(34);
  });
});
