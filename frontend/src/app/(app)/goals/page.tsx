"use client";

import { useState } from "react";
import { CalendarSync, PiggyBank, Plus, Trash2 } from "lucide-react";
import { ApiError, del, errorText, post, put, type Goal } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, money, parseAmount, PAY_DAY } from "@/lib/format";
import { goalPercent, paydaysLeft } from "@/lib/goals";
import { useData } from "@/lib/use-data";
import { AmountInput, currencyLabel } from "@/components/amount-input";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { Alert, Bar, EmptyState, ErrorState, ListSkeleton, Money, PageHeader } from "@/components/ui";

export default function GoalsPage() {
  const { user } = useAuth();
  const currency = currencyLabel(user?.currency);
  const goals = useData<Goal[]>("/goals");
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [depositTo, setDepositTo] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader title="ເປົ້າໝາຍອອມ">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-5" aria-hidden />
          ເປົ້າໝາຍໃໝ່
        </button>
      </PageHeader>

      {goals.error && !goals.data ? (
        <ErrorState message={goals.error} onRetry={goals.reload} />
      ) : !goals.data ? (
        <div className="card">
          <ListSkeleton rows={3} />
        </div>
      ) : goals.data.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={PiggyBank}
            title="ຍັງບໍ່ມີເປົ້າໝາຍ"
            text={`ຕັ້ງເປົ້າ ເຊັ່ນ ຊື້ໂທລະສັບ 10 ລ້ານ ແລ້ວໃຫ້ລະບົບກັນເງິນອອມໃຫ້ທຸກວັນທີ ${PAY_DAY}`}
            action={
              <button className="btn btn-primary" onClick={() => setEditing("new")}>
                <Plus className="size-5" aria-hidden />
                ຕັ້ງເປົ້າໝາຍທຳອິດ
              </button>
            }
          />
        </section>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="goal-list">
          {goals.data.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} onDeposit={() => setDepositTo(g)} />
          ))}
        </ul>
      )}

      <p className="px-1 text-xs text-muted">
        ເງິນທີ່ອອມຈະບັນທຶກເປັນລາຍຈ່າຍໝວດ “ເງິນອອມ” ຍອດຄົງເຫຼືອໃນພາບລວມຈຶ່ງເປັນເງິນທີ່ໃຊ້ໄດ້ແທ້
      </p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "ເປົ້າໝາຍໃໝ່" : "ແກ້ໄຂເປົ້າໝາຍ"}>
        {editing && (
          <GoalEditor
            goal={editing === "new" ? null : editing}
            currency={currency}
            onDone={() => {
              setEditing(null);
              goals.reload();
            }}
          />
        )}
      </Sheet>

      <Sheet open={depositTo !== null} onClose={() => setDepositTo(null)} title={depositTo ? `ອອມເຂົ້າ ${depositTo.name}` : ""}>
        {depositTo && (
          <DepositForm
            goal={depositTo}
            currency={currency}
            onDone={() => {
              setDepositTo(null);
              goals.reload();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function GoalCard({ goal: g, onEdit, onDeposit }: { goal: Goal; onEdit: () => void; onDeposit: () => void }) {
  const pct = goalPercent(g);
  const done = g.saved >= g.target_amount;
  const left = paydaysLeft(g);
  return (
    <li className="card flex flex-col gap-3">
      <button type="button" className="flex flex-col gap-3 text-left" onClick={onEdit} aria-label={`ແກ້ໄຂ ${g.name}`}>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-bg text-accent">
            <PiggyBank className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{g.name}</span>
            <span className="num text-sm text-muted">
              {money(g.saved)} / {money(g.target_amount)}
            </span>
          </span>
          <span className={`num text-sm font-medium ${done ? "text-income" : ""}`}>{done ? "ຄົບແລ້ວ 🎉" : `${pct}%`}</span>
        </div>
        <Bar percent={pct} tone={done ? "income" : "accent"} label={g.name} />
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {g.monthly_amount ? (
            <span className="inline-flex items-center gap-1">
              <CalendarSync className="size-3.5" aria-hidden />
              ອັດຕະໂນມັດ <span className="num">{money(g.monthly_amount)}</span> ທຸກວັນທີ {PAY_DAY}
            </span>
          ) : (
            <span>ບໍ່ມີການອອມອັດຕະໂນມັດ</span>
          )}
          {!done && <span className="num">ຍັງຂາດ {money(g.target_amount - g.saved)}</span>}
          {left !== null && <span>ອີກປະມານ {left} ເດືອນ</span>}
        </span>
      </button>
      {!done && (
        <button type="button" className="btn self-start" onClick={onDeposit}>
          <Plus className="size-4" aria-hidden />
          ອອມເພີ່ມ
        </button>
      )}
    </li>
  );
}

function GoalEditor({ goal, currency, onDone }: { goal: Goal | null; currency: string; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const [auto, setAuto] = useState(goal ? goal.monthly_amount !== null : true);
  const [monthly, setMonthly] = useState(goal?.monthly_amount ? String(goal.monthly_amount) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const targetAmount = parseAmount(target);
    const monthlyAmount = auto ? parseAmount(monthly) : null;
    if (!name.trim()) return setError("ກະລຸນາໃສ່ຊື່ເປົ້າໝາຍ");
    if (targetAmount === null) return setError("ກະລຸນາໃສ່ຍອດເປົ້າໝາຍ");
    if (auto && monthlyAmount === null) return setError("ກະລຸນາໃສ່ຍອດອອມຕໍ່ເດືອນ ຫຼື ປິດການອອມອັດຕະໂນມັດ");
    setBusy(true);
    try {
      const body = { name: name.trim(), target_amount: targetAmount, monthly_amount: monthlyAmount };
      if (goal) await put(`/goals/${goal.id}`, body);
      else await post("/goals", body);
      toast(goal ? "ບັນທຶກເປົ້າໝາຍແລ້ວ" : `ສ້າງເປົ້າໝາຍ ${name.trim()} ແລ້ວ`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "ມີເປົ້າໝາຍຊື່ນີ້ແລ້ວ" : errorText(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!goal) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await del(`/goals/${goal.id}`);
      toast("ລຶບເປົ້າໝາຍແລ້ວ");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="label">ຊື່ເປົ້າໝາຍ</span>
        <input className="input" maxLength={100} placeholder="ເຊັ່ນ ຊື້ໂທລະສັບ" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!goal} />
      </label>
      <div className="flex flex-col gap-1">
        <span className="label">ຍອດເປົ້າໝາຍ</span>
        <AmountInput id="goal-target" label="ຍອດເປົ້າໝາຍ" value={target} onChange={setTarget} currency={currency} />
      </div>

      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        <span className="text-sm">ອອມອັດຕະໂນມັດທຸກວັນທີ {PAY_DAY} (ວັນເງິນເດືອນອອກ)</span>
      </label>
      {auto && (
        <div className="flex flex-col gap-1">
          <span className="label">ອອມຕໍ່ເດືອນ</span>
          <AmountInput id="goal-monthly" label="ອອມຕໍ່ເດືອນ" value={monthly} onChange={setMonthly} currency={currency} />
          {goal?.next_deposit && goal.monthly_amount !== null && (
            <span className="text-xs text-muted">ຄັ້ງຕໍ່ໄປ {dateLabel(goal.next_deposit)}</span>
          )}
        </div>
      )}

      <Alert>{error}</Alert>

      <div className="flex gap-2">
        {goal && (
          <button type="button" className={`btn ${confirmDelete ? "bg-expense text-white" : "text-expense"}`} onClick={remove} disabled={busy}>
            <Trash2 className="size-4" aria-hidden />
            {confirmDelete ? "ກົດອີກຄັ້ງເພື່ອລຶບ" : "ລຶບ"}
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={busy}>
          {busy ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
        </button>
      </div>
      {goal && confirmDelete && <p className="text-xs text-muted">ເງິນທີ່ອອມໄປແລ້ວຈະຍັງຢູ່ໃນລາຍການ, ການອອມອັດຕະໂນມັດຈະຖືກຍົກເລີກ</p>}
    </form>
  );
}

function DepositForm({ goal, currency, onDone }: { goal: Goal; currency: string; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(goal.monthly_amount ? String(goal.monthly_amount) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (value === null) return setError("ກະລຸນາໃສ່ຈຳນວນເງິນ");
    setBusy(true);
    try {
      await post(`/goals/${goal.id}/deposits`, { amount: value });
      toast(`ອອມເຂົ້າ ${goal.name} ${money(value)} ແລ້ວ`);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        ອອມແລ້ວ <Money value={goal.saved} className="text-fg" /> ຈາກ <Money value={goal.target_amount} />
      </p>
      <AmountInput id="deposit-amount" label="ຈຳນວນເງິນ" value={amount} onChange={setAmount} large currency={currency} />
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "ກຳລັງບັນທຶກ…" : "ອອມ"}
      </button>
    </form>
  );
}
