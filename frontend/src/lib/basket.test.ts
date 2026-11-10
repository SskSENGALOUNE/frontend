import { describe, expect, it } from "vitest";
import { basketTotal, bumpUsage, canAdd, invalidKeys, MAX_BASKET, toPayload, topUsed, type BasketItem } from "./basket";

const item = (key: string, amount: number, note?: string): BasketItem => ({ key, category_id: `c${key}`, amount, txn_date: "2026-10-05", ...(note ? { note } : {}) });

describe("basket", () => {
  it("totals without float drift", () => {
    expect(basketTotal([item("a", 0.1), item("b", 0.2)])).toBe(0.3);
    expect(basketTotal([item("a", 45000), item("b", 20000), item("c", 15000)])).toBe(80000);
    expect(basketTotal([])).toBe(0);
  });
  it("limits to MAX_BASKET items", () => {
    const full = Array.from({ length: MAX_BASKET }, (_, i) => item(String(i), 1));
    expect(canAdd(full.slice(1))).toBe(true);
    expect(canAdd(full)).toBe(false);
  });
  it("builds the /expenses payload with txn_date always set", () => {
    expect(toPayload([item("a", 5, "lunch"), item("b", 7)])).toEqual([
      { category_id: "ca", amount: 5, txn_date: "2026-10-05", note: "lunch" },
      { category_id: "cb", amount: 7, txn_date: "2026-10-05" },
    ]);
  });
  it("maps API error positions back to items", () => {
    const items = [item("a", 1), item("b", 1), item("c", 1)];
    expect(invalidKeys(items, { invalid_items: [1, 2] })).toEqual(new Set(["b", "c"]));
    expect(invalidKeys(items, { "[0].amount": "gt", "[2].category_id": "required" })).toEqual(new Set(["a", "c"]));
    expect(invalidKeys(items, { invalid_items: [7] })).toEqual(new Set());
    expect(invalidKeys(items, undefined)).toEqual(new Set());
  });
  it("tracks most used categories", () => {
    let u = bumpUsage({}, ["x", "y", "x"]);
    u = bumpUsage(u, ["z", "x", "y"]);
    expect(u).toEqual({ x: 3, y: 2, z: 1 });
    expect(topUsed(u, 2)).toEqual(["x", "y"]);
  });
});
