"use client";

import { useState } from "react";
import { useAuth } from "./auth";
import { currentMonth, DEFAULT_PAY_DAY } from "./format";

/** The signed-in user's pay-period start day (1..28). */
export function usePayDay(): number {
  const { user } = useAuth();
  return user?.pay_day ?? DEFAULT_PAY_DAY;
}

/**
 * The selected period ("YYYY-MM") for a month picker. Until the user picks one it follows the
 * current period, so it is right even when the profile (and its pay day) loads after the page.
 */
export function usePeriodMonth(): [string, (m: string) => void, number] {
  const payDay = usePayDay();
  const [picked, setPicked] = useState<string | null>(null);
  return [picked ?? currentMonth(new Date(), payDay), setPicked, payDay];
}
