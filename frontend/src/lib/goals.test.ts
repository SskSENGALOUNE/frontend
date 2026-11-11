import { describe, expect, it } from "vitest";
import type { Goal } from "./api";
import { goalPercent, paydaysLeft } from "./goals";

const goal = (saved: number, target: number, monthly: number | null): Goal => ({
  id: "g", name: "x", category_id: "c", deposit_count: 0, next_deposit: null,
  saved, target_amount: target, monthly_amount: monthly,
});

describe("goals", () => {
  it("counts the paydays still needed", () => {
    expect(paydaysLeft(goal(0, 10_000_000, 500_000))).toBe(20);
    expect(paydaysLeft(goal(9_800_000, 10_000_000, 500_000))).toBe(1);
    expect(paydaysLeft(goal(10_000_000, 10_000_000, 500_000))).toBeNull();
    expect(paydaysLeft(goal(0, 10_000_000, null))).toBeNull();
  });
  it("rounds the percentage to one decimal", () => {
    expect(goalPercent(goal(1, 3, null))).toBe(33.3);
    expect(goalPercent(goal(12, 10, null))).toBe(120);
  });
});
