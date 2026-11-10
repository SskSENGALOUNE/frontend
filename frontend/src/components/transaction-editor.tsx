"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { del, errorText, put, type Category, type Transaction } from "@/lib/api";
import { parseAmount } from "@/lib/format";
import { Alert, TypeToggle } from "./ui";
import { AmountInput } from "./amount-input";
import { CategoryGrid } from "./category-grid";
import { useToast } from "./toast";

/** Edit or delete one transaction; rendered inside a Sheet. */
export function TransactionEditor({
  txn,
  categories,
  currency,
  onDone,
}: {
  txn: Transaction;
  categories: Category[];
  currency: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [type, setType] = useState(txn.type);
  const [categoryId, setCategoryId] = useState(txn.category_id);
  const [amount, setAmount] = useState(String(txn.amount));
  const [date, setDate] = useState(txn.txn_date);
  const [note, setNote] = useState(txn.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!categoryId) return setError("ກະລຸນາເລືອກໝວດ");
    if (value === null) return setError("ກະລຸນາໃສ່ຈຳນວນເງິນ");
    setBusy(true);
    setError("");
    try {
      await put(`/transactions/${txn.id}`, { type, category_id: categoryId, amount: value, txn_date: date, note: note.trim() || null });
      toast("ແກ້ໄຂແລ້ວ");
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/transactions/${txn.id}`);
      toast("ລຶບແລ້ວ");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <TypeToggle
        value={type}
        onChange={(t) => {
          setType(t);
          setCategoryId("");
        }}
      />
      <AmountInput id="edit-amount" label="ຈຳນວນເງິນ" value={amount} onChange={setAmount} large currency={currency} />
      <CategoryGrid categories={categories.filter((c) => c.type === type)} value={categoryId} onChange={setCategoryId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          ວັນທີ
          <input id="edit-date" className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="label">
          ໝາຍເຫດ
          <input id="edit-note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>
        ບັນທຶກການແກ້ໄຂ
      </button>
      {confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-xl bg-expense-bg p-3">
          <p className="text-sm text-expense">ລຶບລາຍການນີ້ແທ້ບໍ? ກູ້ຄືນບໍ່ໄດ້</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              ຍົກເລີກ
            </button>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
              ລຶບ
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost text-expense hover:text-expense" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden />
          ລຶບລາຍການ
        </button>
      )}
    </form>
  );
}
