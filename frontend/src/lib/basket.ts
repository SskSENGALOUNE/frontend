// Pure logic for entering several expenses and saving them in one POST /expenses call.

export const MAX_BASKET = 100;

export interface BasketItem {
  key: string;
  category_id: string;
  amount: number;
  txn_date: string;
  note?: string;
}

export function basketTotal(items: BasketItem[]): number {
  // sum in minor units so 0.1 + 0.2 stays 0.3
  return items.reduce((s, i) => s + Math.round(i.amount * 100), 0) / 100;
}

export function canAdd(items: BasketItem[]): boolean {
  return items.length < MAX_BASKET;
}

/** Request body for POST /expenses; txn_date is always sent so the server never guesses "today". */
export function toPayload(items: BasketItem[]) {
  return items.map(({ category_id, amount, txn_date, note }) => ({
    category_id,
    amount,
    txn_date,
    ...(note ? { note } : {}),
  }));
}

/**
 * Maps an /expenses error back to basket keys. The API reports positions either as
 * { invalid_items: [1, 2] } or as field keys like "[0].amount".
 */
export function invalidKeys(items: BasketItem[], errors: Record<string, unknown> | undefined): Set<string> {
  const idx = new Set<number>();
  if (errors) {
    const list = errors.invalid_items;
    if (Array.isArray(list)) list.forEach((i) => typeof i === "number" && idx.add(i));
    for (const k of Object.keys(errors)) {
      const m = k.match(/^\[(\d+)\]/);
      if (m) idx.add(Number(m[1]));
    }
  }
  return new Set([...idx].filter((i) => i >= 0 && i < items.length).map((i) => items[i].key));
}

/** Counts how often each category is used, for ordering the category grid. */
export function bumpUsage(usage: Record<string, number>, categoryIds: string[]): Record<string, number> {
  const next = { ...usage };
  for (const id of categoryIds) next[id] = (next[id] ?? 0) + 1;
  return next;
}

/** Ids of the most used categories, most used first. */
export function topUsed(usage: Record<string, number>, n = 4): string[] {
  return Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}
