"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { errorText, put, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { APP_VERSION, CHANGELOG, versionLabel } from "@/lib/changelog";
import { currentMonth, DEFAULT_PAY_DAY, monthLabel, monthRangeLabel } from "@/lib/format";
import { Alert, ListSkeleton, PageHeader } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast";

const CURRENCIES = [
  ["LAK", "ກີບ (LAK)"],
  ["THB", "ບາດ (THB)"],
  ["USD", "ໂດລາ (USD)"],
];

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);

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
      {/* the form starts from the saved profile, so wait for it (a reload loads it after the page) */}
      {user ? (
        <ProfileForm key={user.id} user={user} />
      ) : (
        <div className="card">
          <ListSkeleton rows={4} />
        </div>
      )}

      <form onSubmit={changePassword} className="card flex flex-col gap-3">
        <h2 className="font-semibold">ປ່ຽນລະຫັດຜ່ານ</h2>
        <PasswordInput id="pw-current" label="ລະຫັດຜ່ານປັດຈຸບັນ" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput id="pw-new" label="ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 6 ຕົວ)" value={next} onChange={setNext} autoComplete="new-password" />
        <Alert>{pwError}</Alert>
        <button className="btn" disabled={busy || !current || !next}>
          ປ່ຽນລະຫັດຜ່ານ
        </button>
      </form>
      <ReleaseNotes />
    </>
  );
}

/** Which version is running, when it was deployed, and what changed in each release. */
function ReleaseNotes() {
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="release-notes">
      <div className="flex flex-col gap-1">
        <h2 id="release-notes" className="flex items-center gap-2 font-semibold">
          <Rocket className="size-5 text-accent" aria-hidden />
          ເວີຊັນ ແລະ ສິ່ງທີ່ອັບເດດ
        </h2>
        <p className="text-sm">
          Deploy ລ່າສຸດ: <span className="num font-medium" data-testid="deployed-at">{versionLabel(APP_VERSION)}</span>
        </p>
        <p className="num text-xs text-muted">ເວີຊັນ {APP_VERSION}</p>
      </div>
      <ol className="flex flex-col gap-4">
        {CHANGELOG.map((entry, i) => {
          const version = entry.version ?? APP_VERSION;
          return (
            <li key={version} className="flex flex-col gap-1.5">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                {versionLabel(version)}
                {i === 0 && <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent">ລຸ້ນປັດຈຸບັນ</span>}
              </h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted marker:text-line">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Explains what the chosen pay day means, using the current period as the example. */
function payDayHint(day: number): string {
  const month = currentMonth(new Date(), day);
  const range = monthRangeLabel(month, day);
  if (day === 1) return `ນັບຕາມເດືອນປົກກະຕິ ວັນທີ 1 ຫາ ທ້າຍເດືອນ · ຕອນນີ້: ${monthLabel(month)} (${range})`;
  return `ນັບແຕ່ວັນທີ ${day} ຫາ ວັນທີ ${day - 1} ຂອງເດືອນຖັດໄປ · ຕອນນີ້: ${monthLabel(month)} (${range}). ການອອມອັດຕະໂນມັດຈະຍ້າຍໄປວັນທີ ${day} ນຳ`;
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency);
  const [payDay, setPayDay] = useState(user.pay_day ?? DEFAULT_PAY_DAY);
  const [profileError, setProfileError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileError("");
    try {
      setUser(await put<User>("/me", { name: name.trim(), currency, pay_day: payDay }));
      toast("ບັນທຶກໂປຣໄຟລ໌ແລ້ວ");
    } catch (err) {
      setProfileError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
      <form onSubmit={saveProfile} className="card flex flex-col gap-3">
        <h2 className="font-semibold">ຂໍ້ມູນສ່ວນຕົວ</h2>
        <label className="label">
          ຊື່
          <input id="profile-name" className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="label">
          ອີເມວ
          <input id="profile-email" className="input opacity-70" value={user.email} disabled />
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
        <label className="label">
          ວັນເລີ່ມຮອບເດືອນ (ວັນເງິນເດືອນອອກ)
          <select id="profile-pay-day" className="input" value={payDay} onChange={(e) => setPayDay(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                ວັນທີ {d}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">{payDayHint(payDay)}</span>
        </label>
        <Alert>{profileError}</Alert>
        <button className="btn btn-primary" disabled={busy}>
          ບັນທຶກ
        </button>
      </form>
  );
}
