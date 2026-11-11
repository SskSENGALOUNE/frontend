// Thin client for the Go API. Every response is { success, message?, data?, errors? }.

export type TxnType = "income" | "expense";

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
}

export interface Category {
  id: string;
  name: string;
  type: TxnType;
  color: string | null;
  icon: string | null;
}

export interface Transaction {
  id: string;
  type: TxnType;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  amount: number;
  txn_date: string;
  note: string | null;
  recurring_id: string | null;
  goal_id: string | null;
}

export interface TransactionList {
  items: Transaction[];
  totals: { income: number; expense: number; net: number };
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  income_count: number;
  expense_count: number;
  avg_daily_expense: number;
  days: number;
}

export interface CategoryTotal {
  category_id: string;
  category_name: string;
  color: string | null;
  total: number;
  count: number;
  percent: number;
}

export interface PeriodTotal {
  period: string;
  income: number;
  expense: number;
  net: number;
}

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  month: string;
  amount: number;
}

export interface BudgetStatus {
  budget_id: string;
  category_id: string;
  category_name: string;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  over_budget: boolean;
}

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurring {
  id: string;
  type: TxnType;
  category_id: string;
  category_name: string;
  amount: number;
  note: string | null;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  run_count: number;
  /** transactions this item has created that still exist */
  generated_count: number;
  next_run_date: string;
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  category_id: string;
  saved: number;
  deposit_count: number;
  /** automatic deposit on each payday, or null */
  monthly_amount: number | null;
  next_deposit: string | null;
}

export interface Favorite {
  id: string;
  type: TxnType;
  category_id: string;
  category_name: string;
  amount: number;
  note: string | null;
}

export interface FrequentAmounts {
  category_id: string;
  /** most used amounts in the last 180 days, smallest first */
  amounts: number[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "mm_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// Called on 401 so the auth provider can send the user back to /login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້");
  }

  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) {
    const msg = res.status >= 500 && !json.message ? "ເຊີບເວີບໍ່ຕອບ ກວດເບິ່ງວ່າເປີດ backend ແລ້ວ" : json.message;
    throw new ApiError(res.status, msg || res.statusText, json.errors);
  }
  return json.data as T;
}

export const get = <T>(path: string) => api<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => api<T>("POST", path, body);
export const put = <T>(path: string, body?: unknown) => api<T>("PUT", path, body);
export const del = <T>(path: string) => api<T>("DELETE", path);

// Backend messages are English; show the Lao equivalent where one is known.
const MESSAGES: Record<string, string> = {
  "invalid email or password": "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ",
  "email already registered": "ອີເມວນີ້ມີບັນຊີແລ້ວ ລອງເຂົ້າສູ່ລະບົບແທນ",
  "category not found or its type does not match": "ໝວດບໍ່ຖືກຕ້ອງ ລອງເລືອກໝວດໃໝ່",
  "expense category not found for some items": "ບາງລາຍການມີໝວດທີ່ບໍ່ມີແລ້ວ ກະລຸນາເລືອກໝວດໃໝ່",
  "array must have 1 to 100 items": "ບັນທຶກໄດ້ 1–100 ລາຍການຕໍ່ຄັ້ງ",
  "still in use": "ຍັງມີລາຍການໃຊ້ຢູ່",
  "already exists": "ມີຢູ່ແລ້ວ",
  "not found": "ບໍ່ພົບຂໍ້ມູນ ອາດຖືກລຶບໄປແລ້ວ",
  "current password is incorrect": "ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ",
  "invalid or expired token": "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່",
  "missing bearer token": "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່",
  "internal server error": "ລະບົບຂັດຂ້ອງ ລອງໃໝ່ອີກຄັ້ງ",
  "end_date must not be before start_date": "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ",
  "limit reached": "ຄົບຈຳນວນສູງສຸດແລ້ວ ລຶບອັນເກົ່າອອກກ່ອນ",
};

const FIELD_NAMES: Record<string, string> = {
  amount: "ຈຳນວນເງິນ",
  category_id: "ໝວດ",
  txn_date: "ວັນທີ",
  email: "ອີເມວ",
  password: "ລະຫັດຜ່ານ",
  new_password: "ລະຫັດຜ່ານໃໝ່",
  name: "ຊື່",
  note: "ໝາຍເຫດ",
  start_date: "ວັນເລີ່ມ",
  end_date: "ວັນສິ້ນສຸດ",
  target_amount: "ຍອດເປົ້າໝາຍ",
  monthly_amount: "ຍອດອອມຕໍ່ເດືອນ",
};

/** Lao, human-readable message for an error, including field errors. */
export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return "ເກີດຂໍ້ຜິດພາດ ລອງໃໝ່ອີກຄັ້ງ";
  if (e.errors && !("invalid_items" in e.errors)) {
    const fields = [...new Set(Object.keys(e.errors).map((k) => k.replace(/^\[\d+\]\./, "")))]
      .map((k) => FIELD_NAMES[k] ?? k)
      .join(", ");
    return `ກະລຸນາກວດຂໍ້ມູນ: ${fields}`;
  }
  return MESSAGES[e.message] ?? e.message;
}
