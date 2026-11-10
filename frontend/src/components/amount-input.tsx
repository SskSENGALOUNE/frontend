"use client";

import { cleanAmountInput, formatAmountInput } from "@/lib/format";

/**
 * Money field that shows thousands separators while typing and accepts at most 2 decimals.
 * `value` is the clean string ("12500.5"); parse it with parseAmount().
 */
export function AmountInput({
  id,
  value,
  onChange,
  large,
  label,
  currency,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (clean: string) => void;
  large?: boolean;
  label: string;
  currency?: string;
  invalid?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-2 rounded-xl border bg-sunken px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 ${invalid ? "border-expense" : "border-line"}`}>
      <input
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={`num min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted ${large ? "min-h-14 py-2 text-3xl font-medium" : "min-h-11 py-2"}`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={formatAmountInput(value)}
        onChange={(e) => {
          const clean = cleanAmountInput(e.target.value);
          if (clean !== null) onChange(clean);
        }}
      />
      {currency && <span className="shrink-0 text-sm text-muted">{currency}</span>}
    </div>
  );
}

export function currencyLabel(code: string | undefined): string {
  return code === "LAK" || !code ? "ກີບ" : code;
}
