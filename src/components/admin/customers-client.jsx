"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, Gift, Camera, ChevronLeft, ChevronRight, BadgeCheck, Clock3, Tent, Building2, Car, Crown, X, Lightbulb } from "lucide-react";
import { mk, inr, ago, offerBuilderHref } from "@/lib/marketing";
import { SegmentBadge, Tile, Modal, Deliveries, Portal } from "@/components/admin/marketing/ui";

const FILTERS = [
    { id: "", label: "Everyone" },
    { id: "booked", label: "Booked before" },
    { id: "never", label: "Never booked" },
    { id: "explorer", label: "Explorers" },
    { id: "not_explorer", label: "Not explorers yet" },
    { id: "pending", label: "Not verified" },
    { id: "has_offer", label: "Has an open offer" },
    { id: "vip", label: "VIP (top spenders)" },
    { id: "opted_out", label: "Marketing off" },
];
const SORTS = [
    { id: "recent", label: "Newest first" },
    { id: "last_booking", label: "Last booking" },
    { id: "value", label: "Most spent" },
    { id: "bookings", label: "Most bookings" },
    { id: "name", label: "Name A–Z" },
];
const TYPE_ICON = { activity: Tent, hotel: Building2, rental: Car };

function TypeIcons({ types = [] }) {
    return types.map((t) => { const I = TYPE_ICON[t] || Tent; return <I key={t} className="h-3.5 w-3.5 text-slate-400" />; });
}

function ExplorerChip({ c }) {
    if (c.explorer?.active) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700"><Camera className="h-3 w-3" />{c.explorer.handle ? `@${c.explorer.handle}` : "Explorer"} · {c.explorer.stories}</span>;
    if (c.explorerInvitedAt) return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3 w-3" />invited {ago(c.explorerInvitedAt)}</span>;
    return <span className="text-xs text-slate-300">not an explorer</span>;
}

function NameLine({ c }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-900">
            <span className="truncate">{c.name}</span>
            {c.vip && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            {c.verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" /> : <span className="shrink-0 rounded bg-amber-50 px-1.5 text-[10px] font-bold uppercase text-amber-700">pending</span>}
        </span>
    );
}

export function CustomersClient() {
    const router = useRouter();
    const [q, setQ] = useState("");
    const [query, setQuery] = useState("");
    const [segment, setSegment] = useState("");
    const [filter, setFilter] = useState("");
    const [sort, setSort] = useState("recent");
    const [page, setPage] = useState(1);
    const [res, setRes] = useState({ key: "", data: null });
    const [nonce, setNonce] = useState(0);
    const [picked, setPicked] = useState(() => new Map());
    const [adding, setAdding] = useState(false);
    const [invites, setInvites] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [q]);

    const params = new URLSearchParams({ q: query, segment, filter, sort, page: String(page), limit: "30" }).toString();
    const key = `${params}#${nonce}`;
    useEffect(() => {
        let live = true;
        const k = `${params}#${nonce}`;
        mk("GET", `/customers?${params}`).then((r) => {
            if (!live) return;
            if (!r.ok) toast.error(r.message);
            setRes((prev) => ({ key: k, data: r.ok ? r.data : prev.data }));
        });
        return () => { live = false; };
    }, [params, nonce]);
    const load = () => setNonce((n) => n + 1);
    const data = res.data;
    const loading = res.key !== key;

    const rows = data?.rows || [];
    const info = data?.segmentInfo || {};
    const allOnPage = rows.length > 0 && rows.every((c) => picked.has(c.id));
    const toggle = (c) => setPicked((m) => { const n = new Map(m); if (n.has(c.id)) n.delete(c.id); else n.set(c.id, c); return n; });
    const togglePage = () => setPicked((m) => { const n = new Map(m); if (allOnPage) rows.forEach((c) => n.delete(c.id)); else rows.forEach((c) => n.set(c.id, c)); return n; });
    const chosen = useMemo(() => [...picked.values()], [picked]);
    const reachable = chosen.filter((c) => c.phone);

    const makeOffer = (list = chosen) => {
        const ok = list.filter((c) => c.phone);
        if (!ok.length) { toast.error("These customers have no mobile number yet"); return; }
        if (ok.length < list.length) toast(`${list.length - ok.length} without a mobile number were left out`);
        router.push(offerBuilderHref(ok));
    };

    const invite = async () => {
        const ids = chosen.filter((c) => !c.explorer?.active).map((c) => c.id);
        if (!ids.length) { toast("They're all explorers already 🎉"); return; }
        setBusy(true);
        const r = await mk("POST", "/customers/explorer-invite", { userIds: ids });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        setInvites(r.data);
        load();
    };

    const s = data?.summary;
    const segTip = segment && info[segment];

    return (
        <div className={`space-y-5 ${chosen.length ? "pb-36 sm:pb-28" : ""}`}>
            <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] *:w-[9.5rem] *:shrink-0 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:*:w-auto xl:grid-cols-6">
                <Tile label="Customers" value={s ? s.customers.toLocaleString("en-IN") : "…"} hint={s ? `${s.booked} have booked` : ""} />
                <Tile label="Revenue (all time)" value={s ? inr(s.revenue) : "…"} tone="text-teal-800" />
                <Tile label="Explorers" value={s ? s.explorers : "…"} hint="posted a story" />
                <Tile label="Not verified" value={s ? s.pending : "…"} hint="verify on first login" tone="text-amber-700" />
                <Tile label="Open offers" value={s ? s.openOffers : "…"} tone="text-orange-600" />
                <Tile label="Never booked" value={s ? s.customers - s.booked : "…"} hint="first-trip offer" tone="text-violet-700" />
            </div>

            {/* Segments (RFM) */}
            <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">Segments · recency, frequency, value</p>
                    {segment && <button onClick={() => { setSegment(""); setPage(1); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Clear</button>}
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                    {Object.entries(info).map(([k, v]) => (
                        <button key={k} title={v.tip} onClick={() => { setSegment(segment === k ? "" : k); setPage(1); }} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border px-3 py-2 text-sm transition ${segment === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                            <span>{v.emoji}</span>
                            <span className="font-semibold">{v.label}</span>
                            <span className={`rounded-full px-1.5 text-xs font-bold ${segment === k ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{data?.segments?.[k] ?? 0}</span>
                        </button>
                    ))}
                </div>
                {segTip && (
                    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-start gap-2 text-sm text-teal-900"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /><span><b>{segTip.label}:</b> {segTip.tip}</span></p>
                        {rows.length > 0 && <button onClick={() => makeOffer(rows)} className="shrink-0 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">Offer to this page ({rows.length})</button>}
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <div className="relative col-span-2 sm:min-w-[16rem] sm:flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, mobile or @handle" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
                </div>
                <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label="Filter" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                    {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                    {SORTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <button onClick={() => setAdding(true)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 sm:col-span-1"><UserPlus className="h-4 w-4" /> Add customer</button>
            </div>

            {/* Phones: cards */}
            <div className="space-y-2.5 md:hidden">
                {rows.length > 0 && (
                    <label className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-500"><input type="checkbox" checked={allOnPage} onChange={togglePage} /> Select all on this page</label>
                )}
                {loading && !rows.length && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
                {!loading && !rows.length && <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">No customers match.</p>}
                {rows.map((c) => (
                    <div key={c.id} className={`flex gap-3 rounded-2xl border bg-white p-3.5 ${picked.has(c.id) ? "border-teal-300 bg-teal-50/40" : "border-slate-200"}`}>
                        <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c)} aria-label={`Select ${c.name}`} className="mt-1 h-4 w-4 shrink-0" />
                        <Link href={`/admin/customers/${c.id}`} className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <NameLine c={c} />
                                {c.spent > 0 && <span className="shrink-0 text-sm font-bold text-slate-900">{inr(c.spent)}</span>}
                            </div>
                            <p className="truncate text-xs text-slate-500">{c.email} · {c.phone || "no mobile"}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500">
                                <SegmentBadge segment={c.segment} info={info} small />
                                <span className="inline-flex items-center gap-1"><b className="text-slate-800">{c.bookings}</b> booking{c.bookings === 1 ? "" : "s"} <TypeIcons types={c.types} /></span>
                                {c.lastBookingAt && <span>last {ago(c.lastBookingAt)}</span>}
                                <ExplorerChip c={c} />
                                {c.offers?.open > 0 && <span className="font-bold text-orange-600">{c.offers.open} open offer{c.offers.open > 1 ? "s" : ""}</span>}
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Tablets and up: table (less important columns appear as space allows) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-400">
                        <tr>
                            <th className="w-10 px-3 py-3"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select page" /></th>
                            <th className="px-3 py-3">Customer</th>
                            <th className="px-3 py-3">Segment</th>
                            <th className="px-3 py-3">Bookings</th>
                            <th className="px-3 py-3 text-right">Spent</th>
                            <th className="hidden px-3 py-3 xl:table-cell">Last booking</th>
                            <th className="hidden px-3 py-3 lg:table-cell">Explorer</th>
                            <th className="hidden px-3 py-3 xl:table-cell">Offers</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !rows.length && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-3 py-4"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>)}
                        {!loading && !rows.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">No customers match.</td></tr>}
                        {rows.map((c) => (
                            <tr key={c.id} className={`hover:bg-slate-50/70 ${picked.has(c.id) ? "bg-teal-50/40" : ""}`}>
                                <td className="px-3 py-3"><input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c)} aria-label={`Select ${c.name}`} /></td>
                                <td className="max-w-[18rem] px-3 py-3">
                                    <Link href={`/admin/customers/${c.id}`} className="group block min-w-0">
                                        <NameLine c={c} />
                                        <span className="block truncate text-xs text-slate-500">{c.email}</span>
                                        <span className="block truncate text-xs text-slate-400">{c.phone || "no mobile"} · joined {ago(c.joinedAt)} · {c.source}</span>
                                    </Link>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3"><SegmentBadge segment={c.segment} info={info} small />{c.rfm && <span className="ml-1.5 hidden font-mono text-[10px] text-slate-400 xl:inline" title="Recency · Frequency · Value (1–5)">{c.rfm}</span>}</td>
                                <td className="whitespace-nowrap px-3 py-3">
                                    <span className="font-semibold text-slate-900">{c.bookings}</span>
                                    <span className="ml-2 inline-flex gap-1 align-middle"><TypeIcons types={c.types} /></span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{c.spent ? inr(c.spent) : <span className="text-slate-300">—</span>}</td>
                                <td className="hidden whitespace-nowrap px-3 py-3 text-slate-600 xl:table-cell">{c.lastBookingAt ? ago(c.lastBookingAt) : <span className="text-slate-300">never</span>}</td>
                                <td className="hidden px-3 py-3 lg:table-cell"><ExplorerChip c={c} /></td>
                                <td className="hidden px-3 py-3 text-xs xl:table-cell">
                                    {c.offers ? (
                                        <span className="text-slate-600">{c.offers.open > 0 && <b className="text-orange-600">{c.offers.open} open · </b>}{c.offers.booked} booked / {c.offers.total}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data && data.pages > 1 && (
                <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                    <span>{data.total.toLocaleString("en-IN")} customers · page {data.page} of {data.pages}</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                        <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                </div>
            )}

            {/* Selection bar: pinned to the bottom of the screen (full width on phones) */}
            {chosen.length > 0 && (
                <Portal>
                    <div className="fixed inset-x-0 bottom-0 z-50 bg-slate-900 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-12px_40px_rgba(15,23,42,0.25)] sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[min(760px,calc(100%-2rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:pb-3 lg:left-[calc(50%+8rem)] lg:w-[min(760px,calc(100%-20rem))]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setPicked(new Map())} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" aria-label="Clear selection"><X className="h-4 w-4" /></button>
                                <div>
                                    <p className="text-sm font-semibold">{chosen.length} selected</p>
                                    <p className="text-xs text-slate-400">{reachable.length} with a mobile number</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                <button disabled={busy} onClick={invite} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"><Camera className="h-4 w-4 shrink-0" /> Invite to Explorer</button>
                                <button onClick={() => makeOffer()} className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold hover:bg-orange-600"><Gift className="h-4 w-4 shrink-0" /> Create trip offer</button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            <AddCustomer open={adding} onClose={() => setAdding(false)} onAdded={(c) => { load(); if (c) router.push(`/admin/customers/${c.id}`); }} />

            <Modal open={Boolean(invites)} onClose={() => setInvites(null)} title="Explorer invites">
                <Deliveries rows={invites || []} />
            </Modal>
        </div>
    );
}

function AddCustomer({ open, onClose, onAdded }) {
    const [form, setForm] = useState({ name: "", email: "", phone: "" });
    const [busy, setBusy] = useState(false);
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    const submit = async (e) => {
        e.preventDefault();
        if ((form.name.match(/\p{L}/gu) || []).length < 2) { toast.error("Enter the customer's full name"); return; }
        setBusy(true);
        const r = await mk("POST", "/customers", { ...form, name: form.name.trim() });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        setForm({ name: "", email: "", phone: "" });
        onClose();
        onAdded(r.data);
    };
    const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:bg-white";
    const label = "mb-1 block text-xs font-semibold text-slate-600";
    return (
        <Modal open={open} onClose={onClose} title="Add a customer">
            <form onSubmit={submit} className="space-y-3">
                <label className="block"><span className={label}>Full name</span><input required minLength={2} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 60) })} placeholder="e.g. Vaibhav Sutar" className={field} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className={label}>Email</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" className={field} /></label>
                    <label className="block"><span className={label}>Mobile number</span><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" inputMode="tel" className={field} /></label>
                </div>
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                    Their TouristGo password is the last 4 digits of the mobile{digits.length === 10 ? <> (<b className="font-mono">{digits.slice(-4)}</b>)</> : ""}. The account stays <b>pending</b> until they verify their email with a code on first login.
                </p>
                <button disabled={busy} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? "Adding…" : "Add customer"}</button>
            </form>
        </Modal>
    );
}
