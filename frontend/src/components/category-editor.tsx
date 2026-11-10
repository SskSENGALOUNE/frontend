"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { ApiError, del, errorText, post, put, type Category, type TxnType } from "@/lib/api";
import { CATEGORY_ICONS, COLOR_CHOICES, colorFor, ICON_CHOICES, suggestIcon } from "@/lib/category-icons";
import { CategoryIcon } from "./category-icon";
import { useToast } from "./toast";
import { Alert, TypeToggle } from "./ui";

/**
 * Create or edit a category; rendered inside a Sheet. `lockType` hides the income/expense toggle
 * (used when adding from the entry page, where the type is already chosen).
 * `onDone` receives the created category, or nothing after an edit or delete.
 */
export function CategoryEditor({
  category,
  defaultType,
  lockType,
  onDone,
}: {
  category: Category | null;
  defaultType: TxnType;
  lockType?: boolean;
  onDone: (created?: Category) => void;
}) {
  const toast = useToast();
  const [type, setType] = useState<TxnType>(category?.type ?? defaultType);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "dots");
  // a new category follows the name's suggested icon until the user picks one
  const [iconPicked, setIconPicked] = useState(category !== null);
  const [color, setColor] = useState<string>(colorFor(category?.color, category?.name ?? "new"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("ກະລຸນາໃສ່ຊື່ໝວດ");
    setBusy(true);
    setError("");
    try {
      if (category) {
        await put(`/categories/${category.id}`, { name: name.trim(), icon, color });
        toast("ບັນທຶກແລ້ວ");
        onDone();
      } else {
        const created = await post<Category>("/categories", { name: name.trim(), type, icon, color });
        toast(`ເພີ່ມໝວດ ${created.name} ແລ້ວ`);
        onDone(created);
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? `ມີໝວດ "${name.trim()}" ຢູ່ແລ້ວ` : errorText(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!category) return;
    setBusy(true);
    try {
      await del(`/categories/${category.id}`);
      toast(`ລຶບໝວດ ${category.name} ແລ້ວ`);
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? `ລຶບ "${category.name}" ບໍ່ໄດ້ ເພາະຍັງມີລາຍການ ຫຼື ລາຍການປະຈຳໃຊ້ໝວດນີ້ຢູ່ ໃຫ້ຍ້າຍລາຍການເຫຼົ່ານັ້ນໄປໝວດອື່ນກ່ອນ`
          : errorText(err),
      );
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} name={name || "?"} size="lg" />
        <input id="cat-name" aria-label="ຊື່ໝວດ" className="input" required autoFocus={!category} maxLength={100} placeholder="ຊື່ໝວດ" value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!iconPicked) setIcon(suggestIcon(e.target.value) ?? "dots");
          }}
        />
      </div>
      {!category && !lockType && <TypeToggle value={type} onChange={setType} />}

      <fieldset>
        <legend className="mb-2 text-sm text-muted">ສີ</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ສີ">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className="flex size-11 items-center justify-center rounded-full"
              style={{ background: `var(--cat-${c}-bg)`, color: `var(--cat-${c})`, boxShadow: color === c ? `0 0 0 2px var(--cat-${c})` : undefined }}
            >
              {color === c ? <Check className="size-5" aria-hidden /> : <span className="size-4 rounded-full" style={{ background: `var(--cat-${c})` }} />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted">ໄອຄອນ</legend>
        <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="ໄອຄອນ">
          {ICON_CHOICES.map((key) => {
            const Icon = CATEGORY_ICONS[key];
            const on = icon === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={key}
                onClick={() => {
                  setIcon(key);
                  setIconPicked(true);
                }}
                className={`flex aspect-square items-center justify-center rounded-xl border ${on ? "border-accent bg-accent-bg text-accent" : "border-transparent text-muted hover:bg-sunken"}`}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>

      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>
        {category ? "ບັນທຶກ" : "ເພີ່ມໝວດ"}
      </button>

      {category &&
        (confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-xl bg-expense-bg p-3">
            <p className="text-sm text-expense">ລຶບໝວດ “{category.name}” ບໍ? ງົບປະມານຂອງໝວດນີ້ທຸກເດືອນຈະຖືກລຶບນຳ</p>
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
            ລຶບໝວດ
          </button>
        ))}
    </form>
  );
}
