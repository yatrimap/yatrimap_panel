"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Users, TicketPercent, PackagePlus, Contact, Gift, Layers, Bike, Menu, X, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/", label: "Bookings", icon: CalendarDays },
  { href: "/admin/customers", label: "Customers", icon: Contact },
  { href: "/admin/offers", label: "Trip Offers", icon: Gift },
  { href: "/admin/combos", label: "Combo Packages", icon: Layers },
  { href: "/admin/custom-package", label: "Custom Packages", icon: PackagePlus },
  { href: "/admin/rental-hubs", label: "Rental Hubs", icon: Bike },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

function NavList({ onPick }: { onPick?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onPick}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active ? "bg-slate-900 text-white shadow-lg" : "text-slate-600 hover:bg-teal-50 hover:text-teal-900"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-teal-300" : "text-slate-400"}`} />
            <span className="flex-1">{item.label}</span>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ className = "" }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <button onClick={logout} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 ${className}`}>
      <LogOut className="h-[18px] w-[18px]" /> Log out
    </button>
  );
}

/** ☰ on phones and tablets: the panel menu slides in from the left (rendered on <body>). */
export function AdminMenuButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 ${className}`}>
        <Menu className="h-5 w-5" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white p-5 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-teal-700">YatriMap</p>
                <p className="mt-1 font-serif text-2xl text-slate-900">Admin deck</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList onPick={() => setOpen(false)} /></div>
            <div className="border-t border-slate-100 pt-3"><LogoutButton /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.14),_transparent_30%),linear-gradient(180deg,#f6f8f4_0%,#eef4f1_45%,#f7f5ef_100%)] text-slate-900">
      {/* Phones / tablets: compact top bar with the menu */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200/70 bg-white/95 px-3 py-2.5 shadow-sm sm:px-4 lg:hidden">
        <AdminMenuButton />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-teal-700">YatriMap admin</p>
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-3 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-[32px] border border-white/60 bg-white/80 p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)] lg:flex xl:w-72">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-teal-700">YatriMap</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-slate-900">Admin command deck</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Bookings, customers, offers and agents in one place.</p>
          </div>
          <div className="mt-7 flex-1"><NavList /></div>
          <LogoutButton className="mt-4" />
        </aside>

        {/* No backdrop-filter here: it would make every position:fixed popup inside sit relative to this card. */}
        <main className="min-w-0 flex-1">
          <div className="rounded-3xl border border-white/60 bg-white/90 px-4 py-4 shadow-[0_18px_70px_rgba(15,23,42,0.08)] sm:rounded-[32px] sm:px-6 sm:py-5 md:px-8">
            <div className="border-b border-slate-200 pb-4 sm:pb-5">
              <p className="hidden font-mono text-xs uppercase tracking-[0.35em] text-teal-700 sm:block">Operations</p>
              <h2 className="font-serif text-2xl text-slate-950 sm:mt-2 sm:text-3xl lg:text-4xl">{title}</h2>
              <p className="mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-6 text-slate-600 sm:mt-2 sm:line-clamp-none sm:text-sm">{subtitle}</p>
            </div>
            <div className="pt-4 sm:pt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
