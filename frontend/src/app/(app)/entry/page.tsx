"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  History,
  ListPlus,
  NotebookPen,
  ShoppingBasket,
  Star,
  X,
} from "lucide-react";
import {
  ApiError,
  del,
  errorText,
  post,
  type Category,
  type Favorite,
  type FrequentAmounts,
  type Transaction,
  type TransactionList,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  basketTotal,
  bumpUsage,
  canAdd,
  invalidKeys,
  MAX_BASKET,
  toPayload,
  topUsed,
  type BasketItem,
} from "@/lib/basket";
import {
  formatAmountInput,
  money,
  parseAmount,
  today,
  yesterday,
  dateLabel,
} from "@/lib/format";
import { readJSON, writeJSON } from "@/lib/storage";
import { useData } from "@/lib/use-data";
import { AmountInput, currencyLabel } from "@/components/amount-input";
import { CategoryEditor } from "@/components/category-editor";
import { CategoryGrid } from "@/components/category-grid";
import { CategoryIcon } from "@/components/category-icon";
import { Sheet } from "@/components/sheet";
import { TransactionEditor } from "@/components/transaction-editor";
import {
  Alert,
  ErrorState,
  ListSkeleton,
  Money,
  Row,
  Skeleton,
  TypeToggle,
} from "@/components/ui";
import { useToast } from "@/components/toast";

const USAGE_KEY = "mm_category_usage";
/** Shown when the chosen category has no history yet; learned amounts come first otherwise. */
const QUICK_AMOUNTS = [
  "5000",
  "10000",
  "20000",
  "30000",
  "40000",
  "50000",
  "100000",
];
const MAX_QUICK = 7;

/** The category's most used amounts first, then the defaults, without duplicates. */
function quickAmounts(learned: number[] | undefined): { value: string; learned: boolean }[] {
  const out = (learned ?? []).map((a) => ({ value: String(a), learned: true }));
  for (const q of QUICK_AMOUNTS) {
    if (out.length >= MAX_QUICK) break;
    if (!out.some((o) => o.value === q)) out.push({ value: q, learned: false });
  }
  return out.slice(0, MAX_QUICK);
}

export default function EntryPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const currency = currencyLabel(user?.currency);
  const cats = useData<Category[]>("/categories");
  const todayStr = today();
  const todays = useData<TransactionList>(
    `/transactions?from=${todayStr}&to=${todayStr}&limit=5`,
  );
  const favorites = useData<Favorite[]>("/favorites");
  const frequent = useData<{ items: FrequentAmounts[] }>(
    "/reports/frequent-amounts",
  );
  const [editingFavorites, setEditingFavorites] = useState(false);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [badKeys, setBadKeys] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<{
    category?: boolean;
    amount?: boolean;
    text?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [addingCategory, setAddingCategory] = useState(false);
  const nextKey = useRef(0);

  useEffect(() => {
    // localStorage is only available after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsage(readJSON(USAGE_KEY, {}));
  }, []);

  const byId = useMemo(
    () => new Map((cats.data ?? []).map((c) => [c.id, c])),
    [cats.data],
  );
  const ordered = useMemo(() => {
    const list = (cats.data ?? []).filter((c) => c.type === type);
    const top = topUsed(usage, 4).filter((id) => byId.get(id)?.type === type);
    return [
      ...top.map((id) => byId.get(id)!),
      ...list.filter((c) => !top.includes(c.id)),
    ];
  }, [cats.data, type, usage, byId]);

  const learnedByCat = useMemo(
    () =>
      new Map((frequent.data?.items ?? []).map((f) => [f.category_id, f.amounts])),
    [frequent.data],
  );
  const chips = quickAmounts(categoryId ? learnedByCat.get(categoryId) : undefined);
  const typeFavorites = (favorites.data ?? []).filter((f) => f.type === type);
  const parsedAmount = parseAmount(amount);
  const isFavorite = typeFavorites.some(
    (f) =>
      f.category_id === categoryId &&
      f.amount === parsedAmount &&
      (f.note ?? "") === note.trim(),
  );

  /** Expense favorites go straight into the basket; an income favorite fills the form. */
  function applyFavorite(f: Favorite) {
    if (type === "income") {
      setCategoryId(f.category_id);
      setAmount(String(f.amount));
      setNote(f.note ?? "");
      setShowNote(!!f.note);
      setFormError({});
      return;
    }
    if (!canAdd(basket))
      return setFormError({ text: `ໃສ່ໄດ້ສູງສຸດ ${MAX_BASKET} ລາຍການຕໍ່ຄັ້ງ` });
    setBasket((b) => [
      ...b,
      {
        key: String(nextKey.current++),
        category_id: f.category_id,
        amount: f.amount,
        txn_date: date,
        ...(f.note ? { note: f.note } : {}),
      },
    ]);
    navigator.vibrate?.(10);
  }

  async function saveFavorite() {
    if (!categoryId || parsedAmount === null) return;
    try {
      await post<Favorite>("/favorites", {
        type,
        category_id: categoryId,
        amount: parsedAmount,
        note: note.trim() || null,
      });
      toast("ເພີ່ມເປັນລາຍການໂປດແລ້ວ");
      favorites.reload();
    } catch (err) {
      setFormError({ text: errorText(err) });
    }
  }

  async function removeFavorite(f: Favorite) {
    try {
      await del(`/favorites/${f.id}`);
      favorites.reload();
    } catch (err) {
      setFormError({ text: errorText(err) });
    }
  }

  function switchType(t: "expense" | "income") {
    setType(t);
    setCategoryId("");
    setFormError({});
  }

  /** Validates the form; returns the item or null after flagging what is missing. */
  function currentItem(): BasketItem | null {
    const value = parseAmount(amount);
    const err = { category: !categoryId, amount: value === null };
    if (err.category || err.amount) {
      setFormError({
        ...err,
        text:
          err.category && err.amount
            ? "ເລືອກໝວດ ແລະ ໃສ່ຈຳນວນເງິນ"
            : err.category
              ? "ກະລຸນາເລືອກໝວດ"
              : "ກະລຸນາໃສ່ຈຳນວນເງິນ",
      });
      return null;
    }
    setFormError({});
    return {
      key: String(nextKey.current++),
      category_id: categoryId,
      amount: value!,
      txn_date: date,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }

  function resetForm() {
    setAmount("");
    setNote("");
    setShowNote(false);
  }

  function addToBasket() {
    if (!canAdd(basket))
      return setFormError({ text: `ໃສ່ໄດ້ສູງສຸດ ${MAX_BASKET} ລາຍການຕໍ່ຄັ້ງ` });
    const item = currentItem();
    if (!item) return;
    setBasket((b) => [...b, item]);
    resetForm();
  }

  function editBasketItem(item: BasketItem) {
    setBasket((b) => b.filter((x) => x.key !== item.key));
    setCategoryId(item.category_id);
    setAmount(String(item.amount));
    setDate(item.txn_date);
    setNote(item.note ?? "");
    setShowNote(!!item.note);
    setBadKeys(new Set());
  }

  async function save() {
    // The filled-in form counts as one more item; an empty form with a basket just saves the basket.
    const formTouched = categoryId !== "" && amount !== "";
    let items = basket;
    if (type === "income" || basket.length === 0 || formTouched) {
      const item = currentItem();
      if (!item) return;
      items = type === "income" ? [item] : [...basket, item];
    }
    if (items.length > MAX_BASKET)
      return setFormError({
        text: `ບັນທຶກໄດ້ສູງສຸດ ${MAX_BASKET} ລາຍການຕໍ່ຄັ້ງ`,
      });

    setBusy(true);
    setBadKeys(new Set());
    try {
      let count = 1;
      let total = items[0].amount;
      if (type === "income") {
        const it = items[0];
        await post<Transaction>("/transactions", {
          type: "income",
          category_id: it.category_id,
          amount: it.amount,
          txn_date: it.txn_date,
          note: it.note ?? null,
        });
      } else {
        const res = await post<{ count: number; total: number }>(
          "/expenses",
          toPayload(items),
        );
        count = res.count;
        total = res.total;
      }
      const nextUsage = bumpUsage(
        usage,
        items.map((i) => i.category_id),
      );
      setUsage(nextUsage);
      writeJSON(USAGE_KEY, nextUsage);
      navigator.vibrate?.(15);
      toast(
        count > 1
          ? `ບັນທຶກແລ້ວ ${count} ລາຍການ ລວມ ${money(total)}`
          : `ບັນທຶກ${type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"} ${money(total)} ແລ້ວ`,
      );
      setBasket([]);
      resetForm();
      todays.reload();
      frequent.reload();
    } catch (err) {
      if (type === "expense" && err instanceof ApiError) {
        if (basket.length !== items.length) {
          // move the form item into the basket so the highlighted index matches what is shown
          setBasket(items);
          resetForm();
        }
        setBadKeys(invalidKeys(items, err.errors));
      }
      setFormError({ text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const total = basketTotal(basket);
  const isExpense = type === "expense";
  const saveCount = basket.length + (categoryId && amount ? 1 : 0);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="icon-btn -ml-2"
          onClick={() => router.back()}
          aria-label="ປິດ"
        >
          <X className="size-6" aria-hidden />
        </button>
        <h1 className="flex-1 text-lg font-semibold">ບັນທຶກ</h1>
        <TypeToggle value={type} onChange={switchType} />
      </div>

      {cats.error && !cats.data ? (
        <ErrorState message={cats.error} onRetry={cats.reload} />
      ) : (
        <>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {typeFavorites.length > 0 && (
              <section className="flex flex-col gap-2" aria-label="ລາຍການໂປດ">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1 text-sm text-muted">
                    <Star className="size-4" aria-hidden />
                    ລາຍການໂປດ
                    {isExpense && !editingFavorites && (
                      <span className="text-xs"> · ແຕະເພື່ອໃສ່ລາຍການ</span>
                    )}
                  </h2>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm text-accent"
                    onClick={() => setEditingFavorites((v) => !v)}
                  >
                    {editingFavorites ? "ແລ້ວ" : "ແກ້ໄຂ"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="favorites">
                  {typeFavorites.map((f) => {
                    const c = byId.get(f.category_id);
                    const label = `${f.note || f.category_name} ${money(f.amount)}`;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`chip max-w-full ${editingFavorites ? "border-expense" : ""}`}
                        onClick={() =>
                          editingFavorites ? removeFavorite(f) : applyFavorite(f)
                        }
                        aria-label={editingFavorites ? `ລຶບ ${label}` : label}
                      >
                        <CategoryIcon
                          icon={c?.icon}
                          color={c?.color}
                          name={f.category_name}
                          size="xs"
                        />
                        <span className="truncate">{f.note || f.category_name}</span>
                        <span className="num text-muted">{money(f.amount)}</span>
                        {editingFavorites && (
                          <X className="size-4 text-expense" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="flex flex-col gap-2">
              <AmountInput
                id="amount"
                label="ຈຳນວນເງິນ"
                value={amount}
                onChange={setAmount}
                large
                currency={currency}
                invalid={formError.amount}
              />
              <div className="flex flex-wrap gap-2" aria-label="ຈຳນວນດ່ວນ">
                {chips.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    className={`chip num ${amount === q.value ? "chip-on" : ""}`}
                    onClick={() => setAmount(q.value)}
                    title={q.learned ? "ຍອດທີ່ໃຊ້ບ່ອຍໃນໝວດນີ້" : undefined}
                  >
                    {q.learned && (
                      <History className="size-3.5 text-muted" aria-label="ໃຊ້ບ່ອຍ" />
                    )}
                    {formatAmountInput(q.value)}
                  </button>
                ))}
              </div>
            </div>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm text-muted">ໝວດ</h2>
              {cats.data ? (
                <CategoryGrid
                  categories={ordered}
                  value={categoryId}
                  onChange={(id) => {
                    setCategoryId(id);
                    setFormError((f) => ({ ...f, category: false }));
                  }}
                  invalid={formError.category}
                  onAdd={() => setAddingCategory(true)}
                />
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              )}
              {cats.data && ordered.length === 0 && (
                <p className="text-sm text-muted">
                  ຍັງບໍ່ມີໝວດ{type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"} ກົດ
                  “ເພີ່ມໝວດ” ເພື່ອສ້າງ
                </p>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`chip ${date === today() ? "chip-on" : ""}`}
                onClick={() => setDate(today())}
              >
                ມື້ນີ້
              </button>
              <button
                type="button"
                className={`chip ${date === yesterday() ? "chip-on" : ""}`}
                onClick={() => setDate(yesterday())}
              >
                ມື້ວານ
              </button>
              <input
                id="date"
                aria-label="ເລືອກວັນທີ"
                type="date"
                className={`chip ${date !== today() && date !== yesterday() ? "chip-on" : ""}`}
                value={date}
                max={today()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              {!showNote && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setShowNote(true)}
                >
                  <NotebookPen className="size-4" aria-hidden />
                  ໝາຍເຫດ
                </button>
              )}
              {categoryId && parsedAmount !== null && (
                <button
                  type="button"
                  className={`chip ${isFavorite ? "chip-on" : ""}`}
                  onClick={saveFavorite}
                  disabled={isFavorite}
                >
                  <Star
                    className={`size-4 ${isFavorite ? "fill-current" : ""}`}
                    aria-hidden
                  />
                  {isFavorite ? "ຢູ່ໃນລາຍການໂປດ" : "ເພີ່ມເປັນລາຍການໂປດ"}
                </button>
              )}
            </div>
            {showNote && (
              <input
                id="note"
                aria-label="ໝາຍເຫດ"
                className="input"
                maxLength={500}
                placeholder="ໝາຍເຫດ (ບໍ່ບັງຄັບ)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
            )}

            <Alert>{formError.text}</Alert>

            {isExpense && basket.length > 0 && (
              <section
                className="card flex flex-col gap-1 p-2"
                aria-label="ລາຍການລໍຖ້າບັນທຶກ"
              >
                <div className="flex items-center justify-between px-2 py-1 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <ShoppingBasket className="size-4 text-muted" aria-hidden />
                    ລໍຖ້າບັນທຶກ {basket.length} ລາຍການ
                  </span>
                  <Money value={total} type="expense" />
                </div>
                <ul data-testid="basket">
                  {basket.map((it) => {
                    const c = byId.get(it.category_id);
                    const bad = badKeys.has(it.key);
                    return (
                      <li
                        key={it.key}
                        data-invalid={bad || undefined}
                        className={`flex items-center gap-1 rounded-xl ${bad ? "bg-expense-bg ring-1 ring-expense" : ""}`}
                      >
                        <button
                          type="button"
                          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-2 text-left"
                          onClick={() => editBasketItem(it)}
                          aria-label={`ແກ້ໄຂ ${c?.name ?? ""} ${money(it.amount)}`}
                        >
                          <CategoryIcon
                            icon={c?.icon}
                            color={c?.color}
                            name={c?.name ?? "?"}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {c?.name ?? "ໝວດທີ່ຖືກລຶບ"}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {it.txn_date !== today() &&
                                dateLabel(it.txn_date)}
                              {it.note && ` ${it.note}`}
                            </span>
                          </span>
                          <Money value={it.amount} className="text-sm" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() =>
                            setBasket((b) => b.filter((x) => x.key !== it.key))
                          }
                          aria-label="ເອົາອອກ"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
              <div className="mx-auto flex max-w-3xl gap-2">
                {isExpense && (
                  <button
                    type="button"
                    className="btn flex-1"
                    onClick={addToBasket}
                    disabled={busy}
                  >
                    <ListPlus className="size-5" aria-hidden />
                    ເພີ່ມໃສ່ລາຍການ
                  </button>
                )}
                <button className="btn btn-primary flex-1" disabled={busy}>
                  {busy
                    ? "ກຳລັງບັນທຶກ…"
                    : isExpense && saveCount > 1
                      ? `ບັນທຶກທັງໝົດ (${saveCount})`
                      : "ບັນທຶກ"}
                </button>
              </div>
            </div>
          </form>
          <TodayList
            data={todays.data}
            categories={cats.data ?? []}
            currency={currency}
            onChanged={todays.reload}
          />
        </>
      )}

      <Sheet
        open={addingCategory}
        onClose={() => setAddingCategory(false)}
        title={`ເພີ່ມໝວດ${type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}`}
      >
        {addingCategory && (
          <CategoryEditor
            category={null}
            defaultType={type}
            lockType
            onDone={(created) => {
              setAddingCategory(false);
              if (created) {
                // pick the new category right away so the entry can be saved without another tap
                setCategoryId(created.id);
                setFormError((f) => ({ ...f, category: false }));
                cats.reload();
              }
            }}
          />
        )}
      </Sheet>
    </>
  );
}

/** Today's entries under the form: confirms what was saved, avoids duplicates, tap to fix. */
function TodayList({
  data,
  categories,
  currency,
  onChanged,
}: {
  data: TransactionList | null;
  categories: Category[];
  currency: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <section
      className="card flex flex-col gap-1 p-2"
      aria-label="ບັນທຶກມື້ນີ້"
      data-testid="today-list"
    >
      <div className="flex items-baseline justify-between gap-2 px-2 pt-1">
        <h2 className="font-semibold">
          ບັນທຶກມື້ນີ້
          {data && data.pagination.total > 0 && (
            <span className="text-sm font-normal text-muted">
              {" "}
              · {data.pagination.total} ລາຍການ
            </span>
          )}
        </h2>
        {data && data.pagination.total > 0 && (
          <span className="flex gap-2 text-sm">
            {data.totals.income > 0 && (
              <Money value={data.totals.income} type="income" sign />
            )}
            {data.totals.expense > 0 && (
              <Money value={data.totals.expense} type="expense" sign />
            )}
          </span>
        )}
      </div>
      {!data ? (
        <div className="p-2">
          <ListSkeleton rows={2} />
        </div>
      ) : data.items.length === 0 ? (
        <p className="px-2 pb-2 text-sm text-muted">ຍັງບໍ່ມີລາຍການມື້ນີ້</p>
      ) : (
        <>
          <ul>
            {data.items.map((t) => {
              const meta = byId.get(t.category_id);
              return (
                <li key={t.id}>
                  <Row
                    onClick={() => setEditing(t)}
                    leading={
                      <CategoryIcon
                        icon={meta?.icon ?? t.category_icon}
                        color={meta?.color ?? t.category_color}
                        name={t.category_name}
                        size="sm"
                      />
                    }
                    title={t.category_name}
                    subtitle={t.note ?? undefined}
                    trailing={
                      <Money
                        value={t.amount}
                        type={t.type}
                        sign
                        className="text-sm"
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
          {data.pagination.total > data.items.length && (
            <Link
              href="/transactions"
              className="flex min-h-11 items-center justify-end gap-0.5 px-2 text-sm text-accent"
            >
              ເບິ່ງທັງໝົດ <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="ແກ້ໄຂລາຍການ"
      >
        {editing && (
          <TransactionEditor
            txn={editing}
            categories={categories}
            currency={currency}
            onDone={() => {
              setEditing(null);
              onChanged();
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
