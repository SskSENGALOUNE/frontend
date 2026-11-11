import { describe, expect, it } from "vitest";
import {
  cleanAmountInput,
  compactMoney,
  currentMonth,
  dateLabel,
  dayHeading,
  formatAmountInput,
  money,
  monthLabel,
  monthRange,
  monthRangeLabel,
  parseAmount,
  shiftMonth,
  today,
  yesterday,
} from "./format";

describe("money", () => {
  it("groups thousands and keeps up to 2 decimals", () => {
    expect(money(1234567)).toBe("1,234,567");
    expect(money(1234.5)).toBe("1,234.5");
    expect(money(0.129)).toBe("0.13");
    expect(money(null)).toBe("0");
  });
  it("compacts axis labels", () => {
    expect(compactMoney(1_500_000)).toBe("1.5M");
    expect(compactMoney(250_000)).toBe("250K");
    expect(compactMoney(900)).toBe("900");
  });
});

describe("monthRange / shiftMonth", () => {
  it("runs from the 25th of the previous month to the 24th", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-10-25", to: "2026-11-24" });
    expect(monthRange("2026-03")).toEqual({ from: "2026-02-25", to: "2026-03-24" });
    expect(monthRange("2027-01")).toEqual({ from: "2026-12-25", to: "2027-01-24" });
    expect(monthRangeLabel("2026-11")).toBe("25/10 – 24/11");
  });
  it("follows the pay day", () => {
    expect(monthRange("2026-11", 5)).toEqual({ from: "2026-10-05", to: "2026-11-04" });
    expect(monthRange("2026-02", 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02", 1).to).toBe("2028-02-29");
    expect(monthRange("2026-03", 28)).toEqual({ from: "2026-02-28", to: "2026-03-27" });
    expect(monthRangeLabel("2026-11", 5)).toBe("5/10 – 4/11");
    expect(currentMonth(new Date(2026, 10, 4), 5)).toBe("2026-11");
    expect(currentMonth(new Date(2026, 10, 5), 5)).toBe("2026-12");
    expect(currentMonth(new Date(2026, 10, 30), 1)).toBe("2026-11");
  });
  it("picks the period containing today", () => {
    expect(currentMonth(new Date(2026, 10, 10))).toBe("2026-11");
    expect(currentMonth(new Date(2026, 10, 24))).toBe("2026-11");
    expect(currentMonth(new Date(2026, 10, 25))).toBe("2026-12");
    expect(currentMonth(new Date(2026, 11, 31))).toBe("2027-01");
  });
  it("crosses year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
  });
});

describe("dates", () => {
  const now = new Date(2026, 9, 5, 23, 30); // 5 Oct 2026, late evening local time
  it("uses local dates, not UTC", () => {
    expect(today(now)).toBe("2026-10-05");
    expect(yesterday(now)).toBe("2026-10-04");
    expect(yesterday(new Date(2026, 2, 1))).toBe("2026-02-28");
  });
  it("labels in Lao", () => {
    expect(monthLabel("2026-10")).toBe("ຕຸລາ 2026");
    expect(dateLabel("2026-07-09")).toBe("9 ກໍລະກົດ 2026");
    expect(dayHeading("2026-10-05", now)).toBe("ມື້ນີ້");
    expect(dayHeading("2026-10-04", now)).toBe("ມື້ວານ");
    expect(dayHeading("2026-10-01", now)).toBe("ວັນພະຫັດ 1 ຕຸລາ");
  });
});

describe("amount input", () => {
  it("accepts digits, commas and up to 2 decimals", () => {
    expect(cleanAmountInput("12,500")).toBe("12500");
    expect(cleanAmountInput("12500.5")).toBe("12500.5");
    expect(cleanAmountInput("12.")).toBe("12.");
    expect(cleanAmountInput("007")).toBe("7");
    expect(cleanAmountInput("")).toBe("");
  });
  it("rejects bad keystrokes", () => {
    expect(cleanAmountInput("1.234")).toBeNull();
    expect(cleanAmountInput("1e5")).toBeNull();
    expect(cleanAmountInput("-5")).toBeNull();
    expect(cleanAmountInput("1.2.3")).toBeNull();
    expect(cleanAmountInput("1234567890123456")).toBeNull(); // over NUMERIC(18,2)
  });
  it("formats while typing", () => {
    expect(formatAmountInput("1234567")).toBe("1,234,567");
    expect(formatAmountInput("1234.")).toBe("1,234.");
    expect(formatAmountInput("1234.05")).toBe("1,234.05");
    expect(formatAmountInput(".5")).toBe("0.5");
    expect(formatAmountInput("")).toBe("");
  });
  it("parses only positive amounts", () => {
    expect(parseAmount("45,000")).toBe(45000);
    expect(parseAmount("0.01")).toBe(0.01);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(".")).toBeNull();
    expect(parseAmount("1.999")).toBeNull();
  });
});
