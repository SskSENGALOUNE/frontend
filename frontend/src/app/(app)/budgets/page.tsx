"use client";

import { useState } from "react";
import { Copy, Plus, Target, Trash2 } from "lucide-react";
import { del, errorText, post, put, type BudgetStatus, type Category } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, monthLabel, parseAmount, shiftMonth } from "@/lib/format";
import { usePeriodMonth } from "@/lib/use-period";
import { useData } from "@/lib/use-data";
import { AmountInput, currencyLabel } from "@/components/amount-input";
import { CategoryIcon } from "@/components/category-icon";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { Alert, Bar, budgetTone, EmptyState, ErrorState, ListSkeleton, Money, MonthPicker, PageHeader, Row } from "@/components/ui";

interface BudgetReport {
  items: BudgetStatus[];
  total: { budget: number; spent: number; remaining: number };
}

export default function BudgetsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [month, setMonth] = usePeriodMonth();
  const cats = useData<Category[]>("/categories?type=expense");
  const report = useData<BudgetReport>(`/reports/budget?month=${month}`);
  const [editing, setEditing] = useState<{ category: Category; status?: BudgetStatus } | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

  const byCat = new Map((report.data?.items ?? []).map((b) => [b.category_id, b]));
  const withBudget = (report.data?.items ?? []).map((b) => ({ status: b, category: (cats.data ?? []).find((c) => c.id === b.category_id) }));
  const withoutBudget = (cats.data ?? []).filter((c) => !byCat.has(c.id));
  const t = report.data?.total;

  async function copyPrevious() {
    setCopyBusy(true);
    const prev = shiftMonth(month, -1);
    try {
      const r = await post<{ copied: number }>("/budgets/copy", { from_month: prev, to_month: month });
      toast(r.copied ? `ສຳເນົາງົບຈາກ ${monthLabel(prev)} ແລ້ວ ${r.copied} ໝວດ` : `${monthLabel(prev)} ບໍ່ມີງົບໃຫ້ສຳເນົາ`, r.copied ? "ok" : "error");
      report.reload();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="ງົບປະມານ">
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      {(report.error && !report.data) || (cats.error && !cats.data) ? (
        <ErrorState message={report.error || cats.error || ""} onRetry={() => { report.reload(); cats.reload(); }} />
      ) : !report.data || !cats.data ? (
        <div className="card">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <>
          {t && t.budget > 0 ? (
            <section className="card flex flex-col gap-3" aria-label="ລວມງົບ">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm text-muted">ໃຊ້ໄປ</p>
                  <p className="num text-2xl font-semibold">{money(t.spent)}</p>
                </div>
                <p className="text-right text-sm text-muted">
                  ຈາກງົບ <Money value={t.budget} className="text-fg" />
                  <span className={`block ${t.remaining < 0 ? "text-expense" : ""}`}>{t.remaining < 0 ? `ເກີນ ${money(-t.remaining)}` : `ເຫຼືອ ${money(t.remaining)}`}</span>
                </p>
              </div>
              <Bar percent={(t.spent / t.budget) * 100} tone={budgetTone((t.spent / t.budget) * 100, t.remaining < 0)} label="ລວມງົບ" />
            </section>
          ) : (
            <section className="card">
              <EmptyState
                icon={Target}
                title={`ຍັງບໍ່ໄດ້ຕັ້ງງົບ ${monthLabel(month)}`}
                text="ຕັ້ງງົບໃຫ້ໝວດທີ່ຢາກຄວບຄຸມ ລະບົບຈະເຕືອນເມື່ອໃຊ້ໃກ້ໝົດ"
                action={
                  <button className="btn" onClick={copyPrevious} disabled={copyBusy}>
                    <Copy className="size-4" aria-hidden />
                    ສຳເນົາຈາກເດືອນກ່ອນ
                  </button>
                }
              />
            </section>
          )}

          {withBudget.length > 0 && (
            <section className="card flex flex-col gap-1 p-2" data-testid="budget-list">
              {withBudget.map(({ status: b, category: c }) => (
                <button key={b.budget_id} type="button" className="flex flex-col gap-2 rounded-xl p-2 text-left transition hover:bg-sunken" onClick={() => c && setEditing({ category: c, status: b })}>
                  <div className="flex w-full items-center gap-3">
                    <CategoryIcon icon={c?.icon} color={c?.color} name={b.category_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{b.category_name}</span>
                      <span className="num text-xs text-muted">
                        {money(b.spent)} / {money(b.budget)}
                      </span>
                    </span>
                    <span className={`num text-right text-sm ${b.over_budget ? "font-medium text-expense" : "text-muted"}`}>
                      {b.over_budget ? `ເກີນ ${money(-b.remaining)}` : `ເຫຼືອ ${money(b.remaining)}`}
                    </span>
                  </div>
                  <Bar percent={b.percent} tone={budgetTone(b.percent, b.over_budget)} label={b.category_name} />
                </button>
              ))}
            </section>
          )}

          {withoutBudget.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-sm text-muted">ໝວດທີ່ຍັງບໍ່ຕັ້ງງົບ</h2>
              <div className="card p-2">
                {withoutBudget.map((c) => (
                  <Row
                    key={c.id}
                    onClick={() => setEditing({ category: c })}
                    leading={<CategoryIcon icon={c.icon} color={c.color} name={c.name} size="sm" />}
                    title={c.name}
                    trailing={
                      <span className="flex items-center gap-1 text-sm text-accent">
                        <Plus className="size-4" aria-hidden />
                        ຕັ້ງງົບ
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {t && t.budget > 0 && (
            <button className="btn self-start" onClick={copyPrevious} disabled={copyBusy}>
              <Copy className="size-4" aria-hidden />
              ສຳເນົາງົບທີ່ຂາດຈາກເດືອນກ່ອນ
            </button>
          )}
        </>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? `ງົບ ${editing.category.name}` : ""}>
        {editing && (
          <BudgetEditor
            category={editing.category}
            status={editing.status}
            month={month}
            currency={currencyLabel(user?.currency)}
            onDone={() => {
              setEditing(null);
              report.reload();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function BudgetEditor({ category, status, month, currency, onDone }: { category: Category; status?: BudgetStatus; month: string; currency: string; onDone: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(status ? String(status.budget) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(value);
    if (amount === null) return setError("ກະລຸນາໃສ່ຈຳນວນງົບ");
    setBusy(true);
    try {
      await put("/budgets", { category_id: category.id, month, amount });
      toast(`ຕັ້ງງົບ ${category.name} ${money(amount)} ແລ້ວ`);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!status) return;
    setBusy(true);
    try {
      await del(`/budgets/${status.budget_id}`);
      toast("ລຶບງົບແລ້ວ");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {monthLabel(month)}
        {status && (
          <>
            {" "}· ໃຊ້ໄປແລ້ວ <Money value={status.spent} className="text-fg" />
          </>
        )}
      </p>
      <AmountInput id="budget-amount" label="ງົບປະມານ" value={value} onChange={setValue} large currency={currency} />
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>
        ບັນທຶກງົບ
      </button>
      {status && (
        <button type="button" className="btn btn-ghost text-expense hover:text-expense" onClick={remove} disabled={busy}>
          <Trash2 className="size-4" aria-hidden />
          ລຶບງົບນີ້
        </button>
      )}
    </form>
  );
}
