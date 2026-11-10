import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const FOOD = "ອາຫານ ແລະ ເຄື່ອງດື່ມ";
export const TRANSPORT = "ຄ່າເດີນທາງ";
export const SALARY = "ເງິນເດືອນ";

export interface Session {
  token: string;
  email: string;
  cat: (name: string) => string;
}

export function localDate(offsetDays = 0): string {
  // tests run with timezoneId Asia/Vientiane; compute the same calendar date here
  const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function monthOffset(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  return t.toISOString().slice(0, 10);
}

/** "YYYY-MM" of the pay period (25th .. 24th, named by its end month) that contains date. */
export function periodMonth(date: string): string {
  return (Number(date.slice(8)) >= 25 ? monthOffset(`${date.slice(0, 7)}-01`, 1) : date).slice(0, 7);
}

/** Registers a fresh user through the API and returns its token and category ids. */
export async function newUser(request: APIRequestContext): Promise<Session> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.la`;
  const res = await request.post("/api/v1/auth/register", { data: { name: "ທົດສອບ", email, password: "secret123" } });
  expect(res.ok()).toBeTruthy();
  const token = (await res.json()).data.token as string;
  const cats = (await (await request.get("/api/v1/categories", { headers: { Authorization: `Bearer ${token}` } })).json()).data as { id: string; name: string }[];
  return {
    token,
    email,
    cat: (name) => {
      const c = cats.find((x) => x.name === name);
      if (!c) throw new Error(`no category ${name}`);
      return c.id;
    },
  };
}

export async function api(request: APIRequestContext, s: Session, method: string, path: string, data?: unknown) {
  const res = await request.fetch(`/api/v1${path}`, { method, data, headers: { Authorization: `Bearer ${s.token}` } });
  expect(res.ok(), `${method} ${path} -> ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

/** Opens `path` already logged in as `s`. */
export async function loginAs(page: Page, s: Session, path = "/") {
  await page.addInitScript((t) => localStorage.setItem("mm_token", t), s.token);
  await page.goto(path);
}

/** "1,234,567" -> 1234567 */
export function num(text: string | null): number {
  return Number((text ?? "").replace(/[^\d.-]/g, ""));
}
