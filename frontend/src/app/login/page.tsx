"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartPie } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/api";
import { Alert } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register" && password.length < 6) return setError("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວ");
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await register(name.trim() || email.split("@")[0], email.trim(), password);
      else await login(email.trim(), password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-income-bg text-income">
            <ChartPie className="size-8" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold">Money Manager</h1>
          <p className="text-sm text-muted">ບັນທຶກລາຍຮັບ ລາຍຈ່າຍ ແລະ ເບິ່ງລາຍງານປະຈຳເດືອນ</p>
        </div>

        <div className="card flex flex-col gap-4">
          <div className="grid grid-cols-2 rounded-xl bg-sunken p-1 text-sm" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`min-h-10 rounded-lg ${mode === m ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
              >
                {m === "login" ? "ເຂົ້າສູ່ລະບົບ" : "ສະໝັກນຳໃຊ້"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "register" && (
              <label className="label">
                ຊື່
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label className="label">
              ອີເມວ
              <input id="email" className="input" type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <PasswordInput
              id="password"
              label={mode === "register" ? "ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 6 ຕົວ)" : "ລະຫັດຜ່ານ"}
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <Alert>{error}</Alert>
            <button className="btn btn-primary mt-1" disabled={busy}>
              {busy ? "ກະລຸນາລໍຖ້າ…" : mode === "login" ? "ເຂົ້າສູ່ລະບົບ" : "ສະໝັກນຳໃຊ້"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
