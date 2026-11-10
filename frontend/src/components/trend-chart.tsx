"use client";

import { useState } from "react";
import type { PeriodTotal } from "@/lib/api";
import { compactMoney, money } from "@/lib/format";

/**
 * Daily expense bars for one pay period. Sized by its container (no fixed min width), so it fits a
 * 375px phone. Tapping or hovering a bar shows that day's numbers.
 */
export function ExpenseChart({ items, today }: { items: PeriodTotal[]; today?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 150;
  const padL = 30;
  const padB = 18;
  const padT = 6;
  const max = niceMax(Math.max(1, ...items.map((i) => i.expense)));
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const slot = plotW / Math.max(items.length, 1);
  const barW = Math.max(2, slot * 0.62);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const sel = active !== null ? items[active] : null;
  const todayIdx = today ? items.findIndex((i) => i.period === today) : -1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-5 items-baseline justify-between gap-2 text-xs text-muted" aria-live="polite">
        {sel ? (
          <>
            <span>ວັນທີ {Number(sel.period.slice(8))}/{Number(sel.period.slice(5, 7))}</span>
            <span className="num">
              <span className="text-expense">−{money(sel.expense)}</span>
              {sel.income > 0 && <span className="text-income"> · +{money(sel.income)}</span>}
            </span>
          </>
        ) : (
          <span>ແຕະທີ່ແທ່ງເພື່ອເບິ່ງຍອດ</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="ກຣາຟລາຍຈ່າຍລາຍວັນ" onMouseLeave={() => setActive(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 4} y={y(t) + 3.5} textAnchor="end" fontSize={9} fill="var(--muted)">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {items.map((it, i) => {
          const x = padL + slot * i + (slot - barW) / 2;
          const h = Math.max(0, padT + plotH - y(it.expense));
          const on = active === i;
          const day = Number(it.period.slice(8));
          return (
            <g key={it.period} onMouseEnter={() => setActive(i)} onClick={() => setActive(on ? null : i)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH + padB} fill="transparent" />
              {it.expense > 0 && (
                <rect x={x} y={y(it.expense)} width={barW} height={h} rx={Math.min(2, barW / 2)} fill="var(--expense)" opacity={active === null || on ? 1 : 0.35} />
              )}
              {(day === 1 || day % 5 === 0 || i === todayIdx) && (
                <text
                  x={padL + slot * i + slot / 2}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fill={i === todayIdx ? "var(--accent)" : "var(--muted)"}
                  fontWeight={i === todayIdx ? 600 : 400}
                >
                  {day}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceMax(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}
