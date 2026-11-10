"use client";

import { Plus } from "lucide-react";
import type { Category } from "@/lib/api";
import { CategoryIcon } from "./category-icon";

/** Tap-to-pick grid of categories (4 columns on phones). `onAdd` adds a "new category" tile at the end. */
export function CategoryGrid({
  categories,
  value,
  onChange,
  invalid,
  onAdd,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="ໝວດ"
      aria-invalid={invalid || undefined}
      className={`grid grid-cols-4 gap-1.5 rounded-2xl sm:grid-cols-5 ${invalid ? "ring-2 ring-expense ring-offset-2 ring-offset-bg" : ""}`}
    >
      {categories.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.id)}
            className={`flex min-h-20 flex-col items-center justify-start gap-1.5 rounded-xl border px-1 pt-2.5 pb-2 text-center transition ${
              on ? "border-accent bg-accent-bg" : "border-transparent hover:bg-sunken"
            }`}
          >
            <CategoryIcon icon={c.icon} color={c.color} name={c.name} />
            <span className={`line-clamp-2 text-xs leading-tight ${on ? "font-medium text-fg" : "text-muted"}`}>{c.name}</span>
          </button>
        );
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-20 flex-col items-center justify-start gap-1.5 rounded-xl border border-dashed border-line px-1 pt-2.5 pb-2 text-center text-accent transition hover:border-accent hover:bg-accent-bg"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-bg">
            <Plus className="size-5" aria-hidden />
          </span>
          <span className="text-xs leading-tight font-medium">ເພີ່ມໝວດ</span>
        </button>
      )}
    </div>
  );
}
