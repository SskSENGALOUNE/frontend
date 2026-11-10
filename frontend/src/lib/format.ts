export function money(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Short form for chart axes: 1.5M, 250K. */
export function compactMoney(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${+(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local date as YYYY-MM-DD (not UTC). */
export function today(now = new Date()): string {
  return toISODate(now);
}

export function yesterday(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/**
 * Salary arrives on the 25th, so a "month" is a pay period: 25th of the previous month to the 24th.
 * A period is named after the month it ends in: "2026-11" = 2026-10-25 .. 2026-11-24.
 */
export const PAY_DAY = 25;

/** The period that contains today: from the 25th on, that is next month's period. */
export function currentMonth(now = new Date()): string {
  const month = today(now).slice(0, 7);
  return now.getDate() >= PAY_DAY ? shiftMonth(month, 1) : month;
}

/** "2026-11" -> { from: "2026-10-25", to: "2026-11-24" } */
export function monthRange(month: string): { from: string; to: string } {
  const pad = (d: number) => String(d).padStart(2, "0");
  return { from: `${shiftMonth(month, -1)}-${pad(PAY_DAY)}`, to: `${month}-${pad(PAY_DAY - 1)}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return toISODate(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

const LAO_MONTHS = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];
const LAO_WEEKDAYS = ["ວັນອາທິດ", "ວັນຈັນ", "ວັນອັງຄານ", "ວັນພຸດ", "ວັນພະຫັດ", "ວັນສຸກ", "ວັນເສົາ"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${LAO_MONTHS[m - 1]} ${y}`;
}

/** "2026-11" -> "25/10 – 24/11", the dates a period covers. */
export function monthRangeLabel(month: string): string {
  const { from, to } = monthRange(month);
  const short = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
  return `${short(from)} – ${short(to)}`;
}

export function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${LAO_MONTHS[m - 1]} ${y}`;
}

/** "ມື້ນີ້", "ມື້ວານ", or weekday + date, for list group headers. */
export function dayHeading(date: string, now = new Date()): string {
  if (date === today(now)) return "ມື້ນີ້";
  if (date === yesterday(now)) return "ມື້ວານ";
  const [y, m, d] = date.split("-").map(Number);
  return `${LAO_WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${LAO_MONTHS[m - 1]}`;
}

export const FREQ_LABEL: Record<string, string> = {
  daily: "ທຸກມື້",
  weekly: "ທຸກອາທິດ",
  monthly: "ທຸກເດືອນ",
  yearly: "ທຸກປີ",
};

/** Amounts as the user types them: digits, optional "." and at most 2 decimals. Commas are ignored. */
const AMOUNT_RE = /^\d*(\.\d{0,2})?$/;

/** Cleans typed input; returns null when the keystroke should be rejected. */
export function cleanAmountInput(raw: string): string | null {
  const s = raw.replace(/,/g, "").trim();
  if (!AMOUNT_RE.test(s)) return null;
  if (s.replace(".", "").length > 15) return null; // NUMERIC(18,2)
  return s.replace(/^0+(?=\d)/, "");
}

/** "1234567.5" -> "1,234,567.5" while keeping a trailing "." the user just typed. */
export function formatAmountInput(clean: string): string {
  if (!clean) return "";
  const [int, dec] = clean.split(".");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

/** Positive amount with at most 2 decimals, or null. */
export function parseAmount(raw: string): number | null {
  const clean = cleanAmountInput(raw);
  if (clean === null || clean === "" || clean === ".") return null;
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}
