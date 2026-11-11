"use client";

import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw, type LucideIcon } from "lucide-react";
import { monthLabel, monthRangeLabel, money, shiftMonth } from "@/lib/format";
import { usePayDay } from "@/lib/use-period";

export function Money({ value, type, sign, className = "" }: { value: number; type?: "income" | "expense"; sign?: boolean; className?: string }) {
  const color = type === "income" ? "text-income" : type === "expense" ? "text-expense" : "";
  const prefix = sign && type ? (type === "income" ? "+" : "−") : "";
  return (
    <span className={`num ${color} ${className}`}>
      {prefix}
      {money(value)}
    </span>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  const cls = kind === "ok" ? "bg-income-bg text-income" : "bg-expense-bg text-expense";
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${cls}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "error" && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-balance">{title}</h1>
      {children}
    </div>
  );
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const payDay = usePayDay();
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(value, -1))} aria-label="ເດືອນກ່ອນ">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <span className="flex min-w-28 flex-col items-center leading-tight" aria-live="polite">
        <span className="text-sm font-medium" data-testid="month-label">{monthLabel(value)}</span>
        <span className="num text-[11px] text-muted">{monthRangeLabel(value, payDay)}</span>
      </span>
      <button className="icon-btn" onClick={() => onChange(shiftMonth(value, 1))} aria-label="ເດືອນຖັດໄປ">
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Progress bar; percent may exceed 100. */
export function Bar({ percent, tone = "accent", label }: { percent: number; tone?: "accent" | "expense" | "income" | "warn"; label?: string }) {
  const bg = { accent: "bg-accent", expense: "bg-expense", income: "bg-income", warn: "bg-warn" }[tone];
  const clamped = Math.max(0, Math.min(percent, 100));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      data-tone={tone}
    >
      <div className={`h-full rounded-full ${bg} transition-[width]`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function budgetTone(percent: number, over: boolean): "expense" | "warn" | "accent" {
  return over ? "expense" : percent >= 80 ? "warn" : "accent";
}

export function TypeToggle({ value, onChange }: { value: "income" | "expense"; onChange: (t: "income" | "expense") => void }) {
  return (
    <div className="inline-flex rounded-xl bg-sunken p-1 text-sm" role="radiogroup" aria-label="ປະເພດ">
      {(["expense", "income"] as const).map((t) => {
        const on = value === t;
        const color = t === "income" ? "bg-income-bg text-income" : "bg-expense-bg text-expense";
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t)}
            className={`min-h-11 rounded-lg px-4 font-medium transition ${on ? `${color} shadow-sm` : "text-muted"}`}
          >
            {t === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="ກຳລັງໂຫຼດ">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-accent-bg text-accent">
        <Icon className="size-7" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center" role="alert">
      <div className="flex size-14 items-center justify-center rounded-full bg-expense-bg text-expense">
        <CircleAlert className="size-7" aria-hidden />
      </div>
      <p className="max-w-xs text-sm">{message}</p>
      <button className="btn" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden />
        ລອງໃໝ່
      </button>
    </div>
  );
}

/** A tappable list row with a leading visual, text and trailing content. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  highlight,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted">{subtitle}</span>}
      </span>
      {trailing}
    </>
  );
  const cls = `flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 ${highlight ? "bg-expense-bg ring-1 ring-expense" : ""}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition hover:bg-sunken`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
