"use client";

import Link from "next/link";
import { CalendarSync, ChevronRight, LogOut, PiggyBank, Tags, UserRound, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";

const LINKS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/goals", label: "ເປົ້າໝາຍອອມ", hint: "ອອມເງິນຊື້ຂອງ, ກັນເງິນອັດຕະໂນມັດທຸກວັນເງິນເດືອນ", icon: PiggyBank },
  { href: "/recurring", label: "ລາຍການປະຈຳ", hint: "ເງິນເດືອນ, ຄ່າເຊົ່າ ແລະ ລາຍການທີ່ເກີດຊ້ຳ", icon: CalendarSync },
  { href: "/categories", label: "ໝວດ", hint: "ເພີ່ມ, ແກ້ຊື່, ປ່ຽນໄອຄອນ ແລະ ສີ", icon: Tags },
  { href: "/profile", label: "ໂປຣໄຟລ໌", hint: "ຊື່, ສະກຸນເງິນ, ລະຫັດຜ່ານ", icon: UserRound },
];

export default function MorePage() {
  const { user, logout } = useAuth();
  return (
    <>
      <div className="card flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-bg text-lg font-semibold text-accent" aria-hidden>
          {user?.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{user?.name}</span>
          <span className="block truncate text-sm text-muted">{user?.email}</span>
        </span>
      </div>
      <nav className="card p-2" aria-label="ເພີ່ມເຕີມ">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-16 items-center gap-3 rounded-xl px-2 hover:bg-sunken">
            <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-muted">
              <l.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{l.label}</span>
              <span className="block truncate text-xs text-muted">{l.hint}</span>
            </span>
            <ChevronRight className="size-5 text-muted" aria-hidden />
          </Link>
        ))}
      </nav>
      <button className="btn text-expense" onClick={logout}>
        <LogOut className="size-5" aria-hidden />
        ອອກຈາກລະບົບ
      </button>
    </>
  );
}
