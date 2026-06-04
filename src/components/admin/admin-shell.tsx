"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Bookings" },
  { href: "/agents", label: "Agents" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/custom-package", label: "Custom Packages" },
];

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.14),_transparent_30%),linear-gradient(180deg,#f6f8f4_0%,#eef4f1_45%,#f7f5ef_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[32px] border border-white/60 bg-white/75 p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur lg:flex lg:flex-col">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-teal-700">YatriMap</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-slate-900">Admin command deck</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              One clean place for platform bookings, agent performance, and daily action.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-slate-900 text-white shadow-lg"
                      : "bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-900"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-xs">{active ? "live" : "open"}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] bg-slate-900 p-5 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-200">Focus</p>
            <p className="mt-3 text-lg">See booking flow, revenue, and agent commission together.</p>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-[32px] border border-white/60 bg-white/75 px-5 py-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur md:px-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.35em] text-teal-700">Operations</p>
                <h2 className="mt-2 font-serif text-4xl text-slate-950">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Smart monthly calendar, booking cards, agent tracking, and business insight blocks.
              </div>
            </div>

            <div className="pt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
