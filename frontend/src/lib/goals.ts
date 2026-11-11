import type { Goal } from "./api";

/** Paydays still needed at the automatic deposit to reach the target, or null without one. */
export function paydaysLeft(g: Goal): number | null {
  const left = g.target_amount - g.saved;
  if (left <= 0 || !g.monthly_amount) return null;
  return Math.ceil(left / g.monthly_amount);
}

/** Saved share of the target, one decimal. */
export function goalPercent(g: Goal): number {
  return Math.round((g.saved / g.target_amount) * 1000) / 10;
}
