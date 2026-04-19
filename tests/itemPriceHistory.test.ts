import { describe, expect, it } from "vitest";
import type { Item, ItemPriceRecord } from "../src/modules/items/model";
import {
  applyNewPriceToItem,
  compareYmd,
  getCurrentActiveRecord,
  getEffectiveItemBasePrice,
  getLastNHistoricalPriceAmounts,
  getPreviousActiveRecord,
  getPriceHistoryChainStartedOnOrBefore,
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

  it("same validFrom: effective price and active record use newer createdAt", () => {
    const d = "2026-04-19";
    const item = baseItem({
      priceHistory: [
        {
          id: "earlier",
          itemId: "1",
          priceType: "purchase",
          amount: 10,
          validFrom: d,
          validTo: "2026-04-18",
          reasonCode: "manual_update",
          createdAt: "2026-04-19T08:00:00.000Z",
        },
        {
          id: "later",
          itemId: "1",
          priceType: "purchase",
          amount: 12,
          validFrom: d,
          reasonCode: "correction",
          createdAt: "2026-04-19T10:00:00.000Z",
        },
      ],
    });
    expect(getEffectiveItemBasePrice(item, "purchase", d)).toBe(12);
    const active = getCurrentActiveRecord(item, "purchase", d);
    expect(active?.id).toBe("later");
    expect(active?.amount).toBe(12);
    const prev = getPreviousActiveRecord(item, "purchase", active!, d);
    expect(prev?.id).toBe("earlier");
    expect(prev?.amount).toBe(10);
    expect(getLastNHistoricalPriceAmounts(item, "purchase", d, 5)).toEqual([10, 12]);
  });

  it("chain order matches history table: validFrom desc then createdAt desc", () => {
    const d = "2026-05-01";
    const item = baseItem({
      priceHistory: [
        {
          id: "a",
          itemId: "1",
          priceType: "sale",
          amount: 1,
          validFrom: "2026-04-01",
          reasonCode: "manual_update",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "b",
          itemId: "1",
          priceType: "sale",
          amount: 2,
          validFrom: d,
          validTo: "2026-04-30",
          reasonCode: "manual_update",
          createdAt: "2026-05-01T09:00:00.000Z",
        },
        {
          id: "c",
          itemId: "1",
          priceType: "sale",
          amount: 3,
          validFrom: d,
          reasonCode: "correction",
          createdAt: "2026-05-01T11:00:00.000Z",
        },
      ],
    });
    const chain = getPriceHistoryChainStartedOnOrBefore(item, "sale", d);
    expect(chain.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(getLastNHistoricalPriceAmounts(item, "sale", d, 2)).toEqual([2, 3]);
  });
});
