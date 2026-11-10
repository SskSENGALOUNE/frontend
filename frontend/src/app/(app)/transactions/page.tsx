"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Repeat, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { errorText, get, type Category, type Transaction, type TransactionList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currentMonth, dayHeading, monthRange } from "@/lib/format";
import { useData, useDebounced } from "@/lib/use-data";
import { currencyLabel } from "@/components/amount-input";
import { CategoryIcon } from "@/components/category-icon";
import { Sheet } from "@/components/sheet";
import { TransactionEditor } from "@/components/transaction-editor";
import { Alert, EmptyState, ErrorState, ListSkeleton, Money, MonthPicker, PageHeader, Row } from "@/components/ui";

const LIMIT = 30;

export default function TransactionsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { from, to } = monthRange(month);
  const params = new URLSearchParams({ from, to, limit: String(LIMIT) });
  if (type) params.set("type", type);
  if (categoryId) params.set("category_id", categoryId);
  if (q) params.set("q", q);
  const base = `/transactions?${params}`;

  const first = useData<TransactionList>(`${base}&page=1`);
  const cats = useData<Category[]>("/categories");
  const catById = new Map((cats.data ?? []).map((c) => [c.id, c]));

  // pages after the first, tied to the query they were loaded for
  const [more, setMore] = useState<{ base: string; items: Transaction[]; page: number } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState("");
  const extra = more?.base === base ? more : null;
  const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])];
  const totalPages = first.data?.pagination.total_pages ?? 1;
  const loadedPage = extra?.page ?? 1;

  async function loadMore() {
    setMoreBusy(true);
    setMoreError("");
    try {
      const next = loadedPage + 1;
      const res = await get<TransactionList>(`${base}&page=${next}`);
      setMore({ base, page: next, items: [...(extra?.items ?? []), ...res.items] });
    } catch (e) {
      setMoreError(errorText(e));
    } finally {
      setMoreBusy(false);
    }
  }

  function refresh() {
    setMore(null);
    first.reload();
  }

  const activeFilters = (type ? 1 : 0) + (categoryId ? 1 : 0);
  const groups = groupByDate(items);
  const d = first.data;

  return (
    <>
      <PageHeader title="ລາຍການ">
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input id="search" type="search" className="input pl-10" placeholder="ຄົ້ນຫາໝາຍເຫດ" aria-label="ຄົ້ນຫາໝາຍເຫດ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button className={`btn relative px-3 ${activeFilters ? "border-accent text-accent" : ""}`} onClick={() => setFilterOpen(true)} aria-label="ຕົວກອງ">
          <SlidersHorizontal className="size-5" aria-hidden />
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-fg">{activeFilters}</span>
          )}
        </button>
      </div>

      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-2">
          {type && (
            <button className="chip chip-on" onClick={() => { setType(""); setCategoryId(""); }}>
              {type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"} <X className="size-3.5" aria-label="ເອົາອອກ" />
            </button>
          )}
          {categoryId && (
            <button className="chip chip-on" onClick={() => setCategoryId("")}>
              {catById.get(categoryId)?.name} <X className="size-3.5" aria-label="ເອົາອອກ" />
            </button>
          )}
        </div>
      )}

      {d && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted" aria-label="ຍອດລວມ">
          <div className="rounded-xl bg-income-bg p-2">
            ລາຍຮັບ
            <Money value={d.totals.income} className="block text-sm font-medium text-income" />
          </div>
          <div className="rounded-xl bg-expense-bg p-2">
            ລາຍຈ່າຍ
            <Money value={d.totals.expense} className="block text-sm font-medium text-expense" />
          </div>
          <div className="rounded-xl bg-surface p-2 ring-1 ring-line">
            ສຸດທິ
            <Money value={d.totals.net} className="block text-sm font-medium text-fg" />
          </div>
        </div>
      )}

      {first.error && !d ? (
        <ErrorState message={first.error} onRetry={first.reload} />
      ) : !d ? (
        <div className="card">
          <ListSkeleton rows={6} />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          {q || activeFilters ? (
            <EmptyState icon={SearchX} title="ບໍ່ພົບລາຍການ" text="ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ຕົວກອງ" />
          ) : (
            <EmptyState
              icon={Plus}
              title="ຍັງບໍ່ມີລາຍການເດືອນນີ້"
              action={
                <Link href="/entry" className="btn btn-primary">
                  ບັນທຶກລາຍການ
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="txn-list">
          {groups.map((g) => (
            <section key={g.date} className="card p-2">
              <div className="flex items-baseline justify-between px-2 pt-1 pb-1 text-sm">
                <h2 className="font-medium">{dayHeading(g.date)}</h2>
                <Money value={Math.abs(g.net)} type={g.net >= 0 ? "income" : "expense"} sign className="text-xs" />
              </div>
              <ul>
                {g.items.map((t) => {
                  const meta = catById.get(t.category_id);
                  return (
                    <li key={t.id}>
                      <Row
                        onClick={() => setEditing(t)}
                        leading={<CategoryIcon icon={meta?.icon ?? t.category_icon} color={meta?.color ?? t.category_color} name={t.category_name} />}
                        title={
                          <span className="flex items-center gap-1.5">
                            {t.category_name}
                            {t.recurring_id && <Repeat className="size-3.5 text-muted" aria-label="ລາຍການປະຈຳ" />}
                          </span>
                        }
                        subtitle={t.note ?? undefined}
                        trailing={<Money value={t.amount} type={t.type} sign className="text-sm" />}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Alert>{moreError}</Alert>
          {loadedPage < totalPages && (
            <button className="btn" onClick={loadMore} disabled={moreBusy}>
              {moreBusy ? "ກຳລັງໂຫຼດ…" : `ໂຫຼດເພີ່ມ (${items.length}/${d.pagination.total})`}
            </button>
          )}
        </div>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="ຕົວກອງ">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted">ປະເພດ</legend>
            <div className="flex flex-wrap gap-2">
              {[["", "ທັງໝົດ"], ["expense", "ລາຍຈ່າຍ"], ["income", "ລາຍຮັບ"]].map(([v, label]) => (
                <button key={v} type="button" className={`chip ${type === v ? "chip-on" : ""}`} onClick={() => { setType(v); setCategoryId(""); }}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted">ໝວດ</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`chip ${!categoryId ? "chip-on" : ""}`} onClick={() => setCategoryId("")}>
                ທຸກໝວດ
              </button>
              {(cats.data ?? [])
                .filter((c) => !type || c.type === type)
                .map((c) => (
                  <button key={c.id} type="button" className={`chip ${categoryId === c.id ? "chip-on" : ""}`} onClick={() => setCategoryId(c.id)}>
                    <CategoryIcon icon={c.icon} color={c.color} name={c.name} size="sm" />
                    {c.name}
                  </button>
                ))}
            </div>
          </fieldset>
          <button className="btn btn-primary" onClick={() => setFilterOpen(false)}>
            ເບິ່ງຜົນ
          </button>
        </div>
      </Sheet>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="ແກ້ໄຂລາຍການ">
        {editing && cats.data && (
          <TransactionEditor
            txn={editing}
            categories={cats.data}
            currency={currencyLabel(user?.currency)}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function groupByDate(items: Transaction[]) {
  const groups: { date: string; net: number; items: Transaction[] }[] = [];
  for (const t of items) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.txn_date) {
      g = { date: t.txn_date, net: 0, items: [] };
      groups.push(g);
    }
    g.items.push(t);
    g.net += t.type === "income" ? t.amount : -t.amount;
  }
  return groups;
}
