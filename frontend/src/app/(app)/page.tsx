"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, NotebookPen, Plus } from "lucide-react";
import type { BudgetStatus, Category, CategoryTotal, PeriodTotal, Summary, TransactionList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currentMonth, dayHeading, money, monthRange, today } from "@/lib/format";
import { useData } from "@/lib/use-data";
import { currencyLabel } from "@/components/amount-input";
import { CategoryIcon } from "@/components/category-icon";
import { ExpenseChart } from "@/components/trend-chart";
import { Bar, budgetTone, EmptyState, ErrorState, ListSkeleton, Money, MonthPicker, Row, Skeleton } from "@/components/ui";

interface SummaryRes {
  summary: Summary;
  previous: { summary: Summary };
}
interface BudgetRes {
  items: BudgetStatus[];
  total: { budget: number; spent: number; remaining: number };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const { from, to } = monthRange(month);
  const q = `from=${from}&to=${to}`;

  const sum = useData<SummaryRes>(`/reports/summary?${q}`);
  const trend = useData<{ items: PeriodTotal[] }>(`/reports/trend?period=day&${q}`);
  const cats = useData<{ items: CategoryTotal[] }>(`/reports/by-category?type=expense&${q}`);
  const budget = useData<BudgetRes>(`/reports/budget?month=${month}`);
  const recent = useData<TransactionList>(`/transactions?${q}&limit=5`);
  const allCats = useData<Category[]>("/categories");
  const catById = new Map((allCats.data ?? []).map((c) => [c.id, c]));

  const failed = sum.error || trend.error || cats.error || budget.error || recent.error;
  const retry = () => [sum, trend, cats, budget, recent].forEach((d) => d.reload());
  const s = sum.data?.summary;
  const p = sum.data?.previous.summary;
  const empty = s && s.income_count + s.expense_count === 0;
  const currency = currencyLabel(user?.currency);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">ສະບາຍດີ {user?.name}</p>
          <h1 className="text-xl font-semibold">ພາບລວມ</h1>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {failed && !sum.data ? (
        <ErrorState message={failed} onRetry={retry} />
      ) : (
        <>
          <section className="card flex flex-col gap-4" aria-label="ສະຫຼຸບ">
            <div>
              <p className="text-sm text-muted">ຄົງເຫຼືອເດືອນນີ້ ({currency})</p>
              {s ? (
                <p className={`num text-3xl font-semibold ${s.net < 0 ? "text-expense" : ""}`} data-testid="net">
                  {money(s.net)}
                </p>
              ) : (
                <Skeleton className="mt-1 h-9 w-40" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="ລາຍຮັບ" type="income" value={s?.income} prev={p?.income} />
              <Tile label="ລາຍຈ່າຍ" type="expense" value={s?.expense} prev={p?.expense} />
            </div>
          </section>

          {empty ? (
            <section className="card">
              <EmptyState
                icon={NotebookPen}
                title="ຍັງບໍ່ມີລາຍການເດືອນນີ້"
                text="ບັນທຶກລາຍຮັບ ຫຼື ລາຍຈ່າຍ ແລ້ວລາຍງານຈະສະແດງຢູ່ນີ້"
                action={
                  <Link href="/entry" className="btn btn-primary">
                    <Plus className="size-5" aria-hidden />
                    ບັນທຶກລາຍການທຳອິດ
                  </Link>
                }
              />
            </section>
          ) : (
            <>
              <section className="card flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">ລາຍຈ່າຍລາຍວັນ</h2>
                  {s && <span className="text-xs text-muted">ສະເລ່ຍ <span className="num">{money(Math.round(s.avg_daily_expense))}</span> / ມື້</span>}
                </div>
                {trend.data ? <ExpenseChart items={trend.data.items} today={month === currentMonth() ? today() : undefined} /> : <Skeleton className="h-40" />}
              </section>

              <section className="card flex flex-col gap-3">
                <h2 className="font-semibold">ໃຊ້ຫຼາຍສຸດ</h2>
                {!cats.data ? (
                  <ListSkeleton rows={3} />
                ) : cats.data.items.length === 0 ? (
                  <p className="text-sm text-muted">ຍັງບໍ່ມີລາຍຈ່າຍເດືອນນີ້</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {cats.data.items.slice(0, 5).map((c) => {
                      const meta = catById.get(c.category_id);
                      return (
                        <li key={c.category_id} className="flex items-center gap-3">
                          <CategoryIcon icon={meta?.icon} color={meta?.color ?? c.color} name={c.category_name} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex justify-between gap-2 text-sm">
                              <span className="truncate">{c.category_name}</span>
                              <Money value={c.total} />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Bar percent={c.percent} tone="expense" label={c.category_name} />
                              </div>
                              <span className="num w-12 text-right text-xs text-muted">{c.percent}%</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          <BudgetCard data={budget.data} catById={catById} />

          {!empty && (
            <section className="card flex flex-col gap-1 p-2">
              <div className="flex items-center justify-between px-2 pt-1">
                <h2 className="font-semibold">ລາຍການລ່າສຸດ</h2>
                <Link href="/transactions" className="flex min-h-11 items-center gap-0.5 px-2 text-sm text-accent">
                  ທັງໝົດ <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              {!recent.data ? (
                <div className="p-2">
                  <ListSkeleton rows={3} />
                </div>
              ) : (
                <ul>
                  {recent.data.items.map((t) => {
                    const meta = catById.get(t.category_id);
                    return (
                      <li key={t.id}>
                        <Row
                          leading={<CategoryIcon icon={meta?.icon ?? t.category_icon} color={meta?.color ?? t.category_color} name={t.category_name} />}
                          title={t.category_name}
                          subtitle={[dayHeading(t.txn_date), t.note].filter(Boolean).join(" · ")}
                          trailing={<Money value={t.amount} type={t.type} sign className="text-sm" />}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function Tile({ label, type, value, prev }: { label: string; type: "income" | "expense"; value?: number; prev?: number }) {
  let diff: React.ReactNode = null;
  if (value !== undefined && prev !== undefined && prev > 0) {
    const pct = Math.round(((value - prev) / prev) * 100);
    const up = pct >= 0;
    const good = type === "income" ? up : !up; // more income is good, more expense is bad
    const Arrow = up ? ArrowUpRight : ArrowDownRight;
    diff = (
      <span className={`inline-flex items-center text-xs ${good ? "text-income" : "text-expense"}`}>
        <Arrow className="size-3.5" aria-hidden />
        {Math.abs(pct)}%
      </span>
    );
  }
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl p-3 ${type === "income" ? "bg-income-bg" : "bg-expense-bg"}`}>
      <span className={`text-xs font-medium ${type === "income" ? "text-income" : "text-expense"}`}>{label}</span>
      {value !== undefined ? <span className="num text-lg font-medium" data-testid={`total-${type}`}>{money(value)}</span> : <Skeleton className="h-6 w-20" />}
      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        ເດືອນກ່ອນ <span className="num">{prev !== undefined ? money(prev) : "–"}</span> {diff}
      </span>
    </div>
  );
}

function BudgetCard({ data, catById }: { data: BudgetRes | null; catById: Map<string, Category> }) {
  if (!data) return null;
  if (data.items.length === 0) {
    return (
      <Link href="/budgets" className="card flex items-center gap-3 transition hover:border-accent">
        <span className="flex-1 text-sm">
          <span className="block font-medium">ຕັ້ງງົບປະມານ</span>
          <span className="text-muted">ຄວບຄຸມລາຍຈ່າຍແຕ່ລະໝວດໃນເດືອນນີ້</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
    );
  }
  // most used first; show at most 4 here
  const items = [...data.items].sort((a, b) => b.percent - a.percent).slice(0, 4);
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ງົບປະມານ</h2>
        <Link href="/budgets" className="flex min-h-11 items-center gap-0.5 text-sm text-accent">
          ທັງໝົດ <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((b) => {
          const meta = catById.get(b.category_id);
          return (
            <li key={b.budget_id} className="flex items-center gap-3">
              <CategoryIcon icon={meta?.icon} color={meta?.color} name={b.category_name} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{b.category_name}</span>
                  <span className={`num text-xs ${b.over_budget ? "text-expense" : "text-muted"}`}>
                    {b.over_budget ? `ເກີນ ${money(-b.remaining)}` : `ເຫຼືອ ${money(b.remaining)}`}
                  </span>
                </div>
                <Bar percent={b.percent} tone={budgetTone(b.percent, b.over_budget)} label={b.category_name} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
