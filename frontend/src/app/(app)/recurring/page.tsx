"use client";

import { useState } from "react";
import { CalendarSync, Pause, Play, Plus, Trash2 } from "lucide-react";
import { del, errorText, post, put, type Category, type Frequency, type Recurring } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, FREQ_LABEL, money, parseAmount, today } from "@/lib/format";
import { useData } from "@/lib/use-data";
import { AmountInput, currencyLabel } from "@/components/amount-input";
import { CategoryGrid } from "@/components/category-grid";
import { CategoryIcon } from "@/components/category-icon";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { Alert, EmptyState, ErrorState, ListSkeleton, Money, PageHeader, TypeToggle } from "@/components/ui";

export default function RecurringPage() {
  const { user } = useAuth();
  const list = useData<Recurring[]>("/recurring");
  const cats = useData<Category[]>("/categories");
  const catById = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const [editing, setEditing] = useState<Recurring | "new" | null>(null);

  return (
    <>
      <PageHeader title="ລາຍການປະຈຳ">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-5" aria-hidden />
          ເພີ່ມ
        </button>
      </PageHeader>
      <p className="text-sm text-muted">ເຊັ່ນ ເງິນເດືອນທຸກວັນທີ 25 ຫຼື ຄ່າເຊົ່າທຸກຕົ້ນເດືອນ ລະບົບຈະບັນທຶກໃຫ້ອັດຕະໂນມັດເມື່ອຮອດມື້</p>

      {list.error && !list.data ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <div className="card">
          <ListSkeleton rows={3} />
        </div>
      ) : list.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarSync} title="ຍັງບໍ່ມີລາຍການປະຈຳ" text="ຕັ້ງໄວ້ຄັ້ງດຽວ ບໍ່ຕ້ອງບັນທຶກຊ້ຳທຸກເດືອນ" />
        </div>
      ) : (
        <ul className="card flex flex-col gap-1 p-2">
          {list.data.map((r) => {
            const meta = catById.get(r.category_id);
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setEditing(r)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-sunken ${r.active ? "" : "opacity-60"}`}>
                  <CategoryIcon icon={meta?.icon} color={meta?.color} name={r.category_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {r.category_name}
                      {r.note && <span className="text-muted"> · {r.note}</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {FREQ_LABEL[r.frequency]} · {r.active ? `ຄັ້ງຕໍ່ໄປ ${dateLabel(r.next_run_date)}` : "ຢຸດໄວ້"}
                    </span>
                  </span>
                  <Money value={r.amount} type={r.type} sign className="text-sm" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "ເພີ່ມລາຍການປະຈຳ" : "ແກ້ໄຂລາຍການປະຈຳ"}>
        {editing && cats.data && (
          <RecurringEditor
            item={editing === "new" ? null : editing}
            categories={cats.data}
            currency={currencyLabel(user?.currency)}
            onDone={() => {
              setEditing(null);
              list.reload();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function RecurringEditor({ item, categories, currency, onDone }: { item: Recurring | null; categories: Category[]; currency: string; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<"income" | "expense">(item?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(item?.start_date ?? today());
  const [endDate, setEndDate] = useState(item?.end_date ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function body(active: boolean) {
    return { type, category_id: categoryId, amount: parseAmount(amount), note: note.trim() || null, end_date: endDate || null, active };
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast(message);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return setError("ກະລຸນາເລືອກໝວດ");
    if (parseAmount(amount) === null) return setError("ກະລຸນາໃສ່ຈຳນວນເງິນ");
    if (item) {
      run(() => put(`/recurring/${item.id}`, body(item.active)), "ບັນທຶກການແກ້ໄຂແລ້ວ");
    } else {
      run(async () => {
        const r = await post<Recurring>("/recurring", { ...body(true), frequency, start_date: startDate });
        if (r.generated_count > 0) toast(`ບັນທຶກຍ້ອນຫຼັງໃຫ້ ${r.generated_count} ຄັ້ງ`);
      }, "ຕັ້ງລາຍການປະຈຳແລ້ວ");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {item && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 text-sm">
          <span className="text-muted">ເລີ່ມ</span>
          <span>{dateLabel(item.start_date)}</span>
          <span className="text-muted">ຄວາມຖີ່</span>
          <span>{FREQ_LABEL[item.frequency]}</span>
          <span className="text-muted">ບັນທຶກແລ້ວ</span>
          <span>{item.generated_count} ຄັ້ງ</span>
          <span className="text-muted">ຄັ້ງຕໍ່ໄປ</span>
          <span>{item.active ? dateLabel(item.next_run_date) : "ຢຸດໄວ້"}</span>
        </div>
      )}
      <TypeToggle
        value={type}
        onChange={(t) => {
          setType(t);
          setCategoryId("");
        }}
      />
      <AmountInput id="rec-amount" label="ຈຳນວນເງິນ" value={amount} onChange={setAmount} large currency={currency} />
      <CategoryGrid categories={categories.filter((c) => c.type === type)} value={categoryId} onChange={setCategoryId} />
      {!item && (
        <div className="grid grid-cols-2 gap-3">
          <label className="label">
            ຄວາມຖີ່
            <select id="rec-freq" className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {Object.entries(FREQ_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            ເລີ່ມວັນທີ
            <input id="rec-start" className="input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          ສິ້ນສຸດ (ບໍ່ບັງຄັບ)
          <input id="rec-end" className="input" type="date" min={item?.start_date ?? startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="label">
          ໝາຍເຫດ
          <input id="rec-note" className="input" maxLength={500} placeholder="ເຊັ່ນ ຄ່າເຊົ່າຫ້ອງ" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {!item && startDate < today() && <p className="text-xs text-muted">ວັນເລີ່ມຢູ່ໃນອະດີດ ລະບົບຈະບັນທຶກຍ້ອນຫຼັງໃຫ້ທັນທີ</p>}
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>
        {item ? "ບັນທຶກການແກ້ໄຂ" : "ຕັ້ງລາຍການປະຈຳ"}
      </button>

      {item && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run(() => put(`/recurring/${item.id}`, { ...body(!item.active), amount: parseAmount(amount) ?? item.amount }), item.active ? "ຢຸດແລ້ວ" : "ເປີດໃຊ້ຄືນແລ້ວ")}
          >
            {item.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {item.active ? "ຢຸດ" : "ເປີດໃຊ້ຄືນ"}
          </button>
          <button type="button" className="btn text-expense" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden />
            ລຶບ
          </button>
        </div>
      )}
      {item && !item.active && <p className="text-xs text-muted">ເມື່ອເປີດໃຊ້ຄືນ ລະບົບຈະຂ້າມຮອບທີ່ຢຸດໄວ້ ບໍ່ບັນທຶກຍ້ອນຫຼັງ</p>}
      {item && confirmDelete && (
        <div className="flex flex-col gap-2 rounded-xl bg-expense-bg p-3">
          <p className="text-sm text-expense">ລຶບລາຍການປະຈຳນີ້ບໍ? ລາຍການທີ່ບັນທຶກໄປແລ້ວ {item.generated_count} ຄັ້ງຍັງຢູ່</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              ຍົກເລີກ
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => del(`/recurring/${item.id}`), "ລຶບແລ້ວ")}>
              ລຶບ
            </button>
          </div>
        </div>
      )}
      {item && <p className="text-center text-xs text-muted">ມູນຄ່າ {money(item.amount)} {currency} · ປ່ຽນຄວາມຖີ່ ຫຼື ວັນເລີ່ມບໍ່ໄດ້ ຖ້າຕ້ອງການໃຫ້ລຶບແລ້ວສ້າງໃໝ່</p>}
    </form>
  );
}
