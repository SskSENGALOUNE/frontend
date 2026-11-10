"use client";

import { useState } from "react";
import { errorText, put, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast";

const CURRENCIES = [
  ["LAK", "ກີບ (LAK)"],
  ["THB", "ບາດ (THB)"],
  ["USD", "ໂດລາ (USD)"],
];

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [currency, setCurrency] = useState(user?.currency ?? "LAK");
  const [profileError, setProfileError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileError("");
    try {
      setUser(await put<User>("/me", { name: name.trim(), currency }));
      toast("ບັນທຶກໂປຣໄຟລ໌ແລ້ວ");
    } catch (err) {
      setProfileError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return setPwError("ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວ");
    setBusy(true);
    setPwError("");
    try {
      await put("/me/password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      toast("ປ່ຽນລະຫັດຜ່ານແລ້ວ");
    } catch (err) {
      setPwError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="ໂປຣໄຟລ໌" />
      <form onSubmit={saveProfile} className="card flex flex-col gap-3">
        <h2 className="font-semibold">ຂໍ້ມູນສ່ວນຕົວ</h2>
        <label className="label">
          ຊື່
          <input id="profile-name" className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="label">
          ອີເມວ
          <input id="profile-email" className="input opacity-70" value={user?.email ?? ""} disabled />
        </label>
        <label className="label">
          ສະກຸນເງິນ
          <select id="profile-currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <Alert>{profileError}</Alert>
        <button className="btn btn-primary" disabled={busy}>
          ບັນທຶກ
        </button>
      </form>

      <form onSubmit={changePassword} className="card flex flex-col gap-3">
        <h2 className="font-semibold">ປ່ຽນລະຫັດຜ່ານ</h2>
        <PasswordInput id="pw-current" label="ລະຫັດຜ່ານປັດຈຸບັນ" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput id="pw-new" label="ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 6 ຕົວ)" value={next} onChange={setNext} autoComplete="new-password" />
        <Alert>{pwError}</Alert>
        <button className="btn" disabled={busy || !current || !next}>
          ປ່ຽນລະຫັດຜ່ານ
        </button>
      </form>
    </>
  );
}
