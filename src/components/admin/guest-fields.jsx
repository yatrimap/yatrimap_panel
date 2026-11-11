"use client";

import { useEffect, useState } from "react";
import { Search, UserCheck, X, Loader2 } from "lucide-react";
import { mk } from "@/lib/marketing";
import { SegmentBadge } from "@/components/admin/marketing/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const emailOf = (v) => String(v || "").trim().toLowerCase();
const digitsOf = (v) => String(v || "").replace(/\D/g, "").slice(-10);

/** Name / email / mobile of a customer from the Customers list, for the booking form. */
export const guestFrom = (c) => ({ name: c?.name || "", email: c?.email || "", phone: digitsOf(c?.phone) });

/** The picked customer, while the email in the form is still theirs (else the booking is for a new guest). */
export const linkedCustomer = (picked, guest) => (picked && emailOf(picked.email) === emailOf(guest.email) ? picked : null);

const find = async (q, limit = 8) => {
    const r = await mk("GET", `/customers?q=${encodeURIComponent(q)}&limit=${limit}`);
    return r.ok ? r.data.rows : [];
};

/**
 * "Book now" → step 2: who the package is for. Pick an existing customer (name, email or mobile)
 * and their details fill in; or just type: a known email or mobile fills the rest by itself.
 *   value / onChange   the form ({ name, email, phone, notes }); onChange takes an updater too
 *   picked / onPick    the customer account the booking goes to (null = new guest)
 */
export function GuestFields({ value, onChange, picked, onPick }) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState({ for: "", rows: [] });
    const [suggest, setSuggest] = useState(null); // { for, customer }: a typed mobile belongs to someone else
    const [checked, setChecked] = useState(""); // the email|mobile last looked up

    const linked = linkedCustomer(picked, value);
    const typedEmail = emailOf(value.email);
    const typedPhone = digitsOf(value.phone);
    const emailKey = EMAIL.test(typedEmail) ? typedEmail : "";
    const phoneKey = typedPhone.length === 10 ? typedPhone : "";
    const lookupKey = linked ? "" : `${emailKey}|${phoneKey}`;

    // Search box
    const needle = q.trim();
    const searchFor = /^[\d\s+()-]+$/.test(needle) ? needle.replace(/\D/g, "").slice(-10) : needle;
    useEffect(() => {
        if (searchFor.length < 2) return undefined;
        let live = true;
        const t = setTimeout(async () => {
            const rows = await find(searchFor);
            if (live) setResults({ for: searchFor, rows });
        }, 250);
        return () => { live = false; clearTimeout(t); };
    }, [searchFor]);
    const shown = searchFor.length >= 2 && results.for === searchFor ? results.rows : [];

    // Typed a known email / mobile → fill the rest from their account.
    const canLook = lookupKey !== "" && lookupKey !== "|";
    useEffect(() => {
        if (!canLook) return undefined;
        let live = true;
        const t = setTimeout(async () => {
            const [byEmail, byPhone] = await Promise.all([
                emailKey ? find(emailKey, 5) : [],
                phoneKey ? find(phoneKey, 5) : [],
            ]);
            if (!live) return;
            setChecked(lookupKey);
            const hit = byEmail.find((c) => emailOf(c.email) === emailKey);
            if (hit) {
                onPick(hit);
                onChange((g) => ({ ...g, name: g.name.trim() ? g.name : hit.name, phone: digitsOf(g.phone).length === 10 ? g.phone : digitsOf(hit.phone) }));
                return;
            }
            const owner = byPhone.find((c) => digitsOf(c.phone) === phoneKey);
            if (!owner) return;
            if (!emailKey) {
                // Only the mobile so far: it's theirs, fill everything.
                onPick(owner);
                onChange((g) => ({ ...g, name: g.name.trim() ? g.name : owner.name, email: owner.email }));
            } else {
                setSuggest({ for: lookupKey, customer: owner });
            }
        }, 400);
        return () => { live = false; clearTimeout(t); };
    }, [canLook, lookupKey, emailKey, phoneKey, onChange, onPick]);
    const other = suggest && suggest.for === lookupKey ? suggest.customer : null;
    const looking = canLook && checked !== lookupKey;

    const pick = (c) => {
        onPick(c);
        onChange((g) => ({ ...g, ...guestFrom(c) }));
        setQ("");
    };
    const clear = () => {
        onPick(null);
        onChange((g) => ({ ...g, name: "", email: "", phone: "" }));
    };

    const input = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-colors focus:border-slate-400 focus:bg-white";
    return (
        <div className="space-y-4">
            {linked ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white"><UserCheck className="h-4 w-4" /></span>
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900"><span className="truncate">{linked.name}</span>{linked.segment && <SegmentBadge segment={linked.segment} small />}</p>
                            <p className="text-xs text-teal-800">Existing customer{linked.bookings != null ? ` · ${linked.bookings} booking${linked.bookings === 1 ? "" : "s"}` : ""} · details filled in</p>
                        </div>
                    </div>
                    <button type="button" onClick={clear} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-900"><X className="h-3.5 w-3.5" /> Change</button>
                </div>
            ) : (
                <div className="relative">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Find a customer</label>
                    <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-slate-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or mobile" className={`${input} pl-8`} autoComplete="off" />
                    {shown.length > 0 && (
                        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                            {shown.map((c) => (
                                <button type="button" key={c.id} onClick={() => pick(c)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                                    <span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.email} · {c.phone || "no mobile"}</span></span>
                                    <span className="shrink-0 text-xs text-slate-400">{c.bookings} booking{c.bookings === 1 ? "" : "s"}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {searchFor.length >= 2 && results.for === searchFor && !shown.length && <p className="mt-1 text-xs text-slate-400">No customer found. Type the details below for a new guest.</p>}
                </div>
            )}

            <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                <input type="text" placeholder="E.g. John Doe" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={input} />
            </div>
            <div className="grid gap-4 *:min-w-0 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                    <input type="email" placeholder="john@example.com" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} className={input} />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                    <input type="tel" inputMode="tel" placeholder="98765 43210" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} className={input} />
                </div>
            </div>
            {looking && <p className="flex items-center gap-1.5 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking if this is an existing customer…</p>}
            {other && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span>This mobile belongs to <b>{other.name}</b> ({other.email}).</span>
                    <button type="button" onClick={() => pick(other)} className="rounded-lg bg-amber-500 px-2.5 py-1 font-semibold text-white hover:bg-amber-600">Use their details</button>
                </div>
            )}
            {!linked && !other && emailKey && phoneKey && checked === lookupKey && <p className="text-xs text-slate-400">New guest: an account is made for them (password = last 4 digits of the mobile).</p>}
        </div>
    );
}
