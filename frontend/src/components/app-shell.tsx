"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarSync, ChartPie, House, ListOrdered, LogOut, Menu, Plus, Tags, Target, UserRound, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: NavItem[] = [
  { href: "/", label: "ພາບລວມ", icon: House },
  { href: "/transactions", label: "ລາຍການ", icon: ListOrdered },
  { href: "/budgets", label: "ງົບປະມານ", icon: Target },
  { href: "/more", label: "ເພີ່ມເຕີມ", icon: Menu },
];

const SIDEBAR: NavItem[] = [
  { href: "/", label: "ພາບລວມ", icon: House },
  { href: "/transactions", label: "ລາຍການ", icon: ListOrdered },
  { href: "/budgets", label: "ງົບປະມານ", icon: Target },
  { href: "/recurring", label: "ລາຍການປະຈຳ", icon: CalendarSync },
  { href: "/categories", label: "ໝວດ", icon: Tags },
  { href: "/profile", label: "ໂປຣໄຟລ໌", icon: UserRound },
];

const MORE_PATHS = ["/more", "/recurring", "/categories", "/profile"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_PATHS.some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

/** Phones: content + bottom tab bar with a raised "add" button. Desktop: left sidebar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const fullScreen = pathname.startsWith("/entry");

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 lg:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2 text-lg font-semibold">
          <ChartPie className="size-6 text-income" aria-hidden />
          Money
        </Link>
        <Link href="/entry" className="btn btn-primary mb-3">
          <Plus className="size-5" aria-hidden />
          ບັນທຶກ
        </Link>
        <nav className="flex flex-col gap-1" aria-label="ເມນູຫຼັກ">
          {SIDEBAR.map((item) => {
            const on = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${on ? "bg-accent-bg font-medium text-accent" : "text-muted hover:bg-sunken hover:text-fg"}`}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
          <span className="truncate px-3 text-sm text-muted">{user?.name}</span>
          <button className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-sunken hover:text-fg" onClick={logout}>
            <LogOut className="size-5" aria-hidden />
            ອອກຈາກລະບົບ
          </button>
        </div>
      </aside>

      <main
        className={`mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] lg:pb-10 ${
          fullScreen ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        {children}
      </main>

      {!fullScreen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          aria-label="ເມນູຫຼັກ"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 items-end">
            {TABS.slice(0, 2).map((t) => (
              <TabLink key={t.href} item={t} on={isActive(pathname, t.href)} />
            ))}
            <div className="flex justify-center">
              <Link
                href="/entry"
                aria-label="ບັນທຶກລາຍການ"
                className="-mt-5 mb-1.5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg ring-4 ring-bg transition active:scale-95"
              >
                <Plus className="size-7" aria-hidden />
              </Link>
            </div>
            {TABS.slice(2).map((t) => (
              <TabLink key={t.href} item={t} on={isActive(pathname, t.href)} />
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function TabLink({ item, on }: { item: NavItem; on: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-medium text-accent" : "text-muted"}`}
    >
      <item.icon className="size-6" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
      {item.label}
    </Link>
  );
}
