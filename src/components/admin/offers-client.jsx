"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, CheckCircle2, QrCode, CreditCard, Clock3, Eye, EyeOff, MessageCircle, Copy, TimerReset, Ban, ChevronDown, Tent, Building2, Car, AlertTriangle, Gift, Send, RefreshCw } from "lucide-react";
import { mk, inr, ago, when, left, openWa } from "@/lib/marketing";
import { OfferStatus, Tile, Modal, useNow, copy, WindowFields } from "@/components/admin/marketing/ui";

const TABS = [
    { id: "action", label: "Needs action", match: (o) => o.status === "accepted" || o.status === "attention" },
    { id: "sent", label: "Waiting for customer", match: (o) => o.status === "sent" },
    { id: "awaiting_payment", label: "Waiting for payment", match: (o) => o.status === "awaiting_payment" || o.status === "booking" },
    { id: "booked", label: "Booked", match: (o) => o.status === "booked" },
    { id: "expired", label: "Not accepted", match: (o) => o.status === "expired" },
    { id: "declined", label: "Declined", match: (o) => o.status === "declined" },
    { id: "cancelled", label: "Withdrawn", match: (o) => o.status === "cancelled" },
    { id: "all", label: "All", match: () => true },
];
const TYPE_ICON = { Activity: Tent, Hotel: Building2, Rental: Car };

export function OffersClient() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [tab, setTab] = useState("action");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState("");
    const [confirming, setConfirming] = useState(null);
    const [extending, setExtending] = useState(null);
    const lastAccepted = useRef(null);
    const focused = useRef(false);

    const [nonce, setNonce] = useState(0);
    const load = () => setNonce((n) => n + 1);

    useEffect(() => {
        let live = true;
        mk("GET", `/offers?status=all&days=${days}`).then((r) => {
            if (!live) return;
            if (!r.ok) { toast.error(r.message); return; }
            const items = r.data.items;
            // New acceptances since the last refresh: tell the admin right away.
            const accepted = items.filter((o) => o.status === "accepted").map((o) => o.id);
            if (lastAccepted.current) {
                items.filter((o) => o.status === "accepted" && !lastAccepted.current.includes(o.id))
                    .forEach((o) => toast.success(`${o.guest?.name} accepted “${o.title}”. Tap Done to confirm`, { duration: 10000 }));
            }
            lastAccepted.current = accepted;
            setData(r.data);
            // First load: ?focus=<offer id> (from a customer page) opens that card on its tab;
            // otherwise start where the work is.
            if (focused.current) return;
            focused.current = true;
            const id = new URLSearchParams(window.location.search).get("focus");
            const o = id && items.find((x) => x.id === id);
            if (!o) { if (!items.some(TABS[0].match)) setTab(items.some(TABS[1].match) ? "sent" : "all"); return; }
            setTab(TABS.find((t) => t.id !== "all" && t.match(o))?.id || "all");
            setOpen(o.id);
            setTimeout(() => document.getElementById(`offer-${o.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
        });
        return () => { live = false; };
    }, [days, nonce]);

    // Live board: re-check every 20 s while the tab is visible.
    useEffect(() => {
        const t = setInterval(() => { if (document.visibilityState === "visible") setNonce((n) => n + 1); }, 20000);
        return () => clearInterval(t);
    }, []);

    const needsAction = data ? data.items.filter(TABS[0].match).length : 0;
    useEffect(() => {
        const base = "YatriMap Admin Panel";
        document.title = needsAction ? `(${needsAction}) Offers · ${base}` : `Offers · ${base}`;
        return () => { document.title = base; };
    }, [needsAction]);

    const list = useMemo(() => {
        const t = TABS.find((x) => x.id === tab) || TABS[0];
        const needle = q.trim().toLowerCase();
        return (data?.items || []).filter(t.match).filter((o) => !needle || [o.code, o.title, o.guest?.name, o.guest?.email, o.guest?.phone].some((v) => String(v || "").toLowerCase().includes(needle)));
    }, [data, tab, q]);

    const upsert = (view) => setData((d) => (d ? { ...d, items: d.items.map((o) => (o.id === view.id ? view : o)) } : d));

    const act = async (o, path, body, after) => {
        const r = await mk("POST", `/offers/${o.id}/${path}`, body);
        if (!r.ok) { toast.error(r.message); return null; }
        toast.success(r.message);
        after?.(r.data);
        load();
        return r.data;
    };
    const resend = async (o, kind) => {
        const r = await mk("POST", `/offers/${o.id}/resend`, { kind });
        if (!r.ok) { toast.error(r.message); return; }
        if (r.data?.via === "link") openWa(r.data.waLink);
        if (r.data?.via === "none") toast.error(r.data.error || "Not sent"); else toast.success(r.message);
        load();
    };
    const withdraw = async (o) => {
        if (!window.confirm(`Withdraw “${o.title}” for ${o.guest?.name}? The customer's link stops working.`)) return;
        await act(o, "cancel", { reason: "Withdrawn by admin" }, upsert);
    };

    const f = data?.funnel;
    const counts = data ? Object.fromEntries(TABS.map((t) => [t.id, data.items.filter(t.match).length])) : {};

    return (
        <div className="space-y-5">
            {/* Funnel */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Offer funnel · last {days} days</p>
                <div className="flex items-center gap-2">
                    {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{d}d</button>)}
                    <button onClick={load} className="rounded-lg bg-white p-1.5 text-slate-500 ring-1 ring-slate-200 hover:text-slate-900" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
                </div>
            </div>
            <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] *:w-[9.5rem] *:shrink-0 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:*:w-auto md:grid-cols-4 2xl:grid-cols-7">
                <Tile label="Sent" value={f ? f.sent : "…"} />
                <Tile label="Opened" value={f ? `${f.viewRate}%` : "…"} hint={f ? `${f.viewed} customers` : ""} />
                <Tile label="Accepted" value={f ? `${f.acceptRate}%` : "…"} hint={f ? `${f.accepted} offers` : ""} tone="text-emerald-700" />
                <Tile label="Booked" value={f ? `${f.bookRate}%` : "…"} hint={f ? `${f.booked} trips` : ""} tone="text-teal-800" />
                <Tile label="Revenue booked" value={f ? inr(f.revenue) : "…"} tone="text-teal-800" />
                <Tile label="Advance collected" value={f ? inr(f.advanceCollected) : "…"} />
                <Tile label="Time to accept" value={f?.medianHoursToAccept == null ? "—" : f.medianHoursToAccept < 1 ? `${Math.max(1, Math.round(f.medianHoursToAccept * 60))}m` : `${f.medianHoursToAccept}h`} hint="median" />
            </div>

            {/* Tabs + search */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                    {TABS.map((t) => (
                        <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
                            {t.label}
                            <span className={`rounded-full px-1.5 text-xs ${tab === t.id ? "bg-white/20" : t.id === "action" && counts.action ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{counts[t.id] ?? 0}</span>
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1 xl:w-64 xl:flex-none">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, trip or customer" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
                    </div>
                    <Link href="/admin/customers" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"><Gift className="h-4 w-4" /> New offer</Link>
                </div>
            </div>

            {!data && <div className="grid gap-3 lg:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-slate-100" />)}</div>}
            {data && !list.length && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500 sm:p-10">
                    {tab === "action" ? "Nothing waiting on you. Accepted offers show up here." : "No offers here."} <Link href="/admin/customers" className="font-semibold text-teal-700 underline">Pick customers</Link> to send one.
                </div>
            )}
            <div className="grid gap-3 2xl:grid-cols-2">
                {list.map((o) => (
                    <OfferCard key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? "" : o.id)} onDone={() => setConfirming(o)} onExtend={() => setExtending(o)} onResend={(k) => resend(o, k)} onWithdraw={() => withdraw(o)} />
                ))}
            </div>

            <ConfirmDialog key={confirming?.id || "none"} offer={confirming} onClose={() => setConfirming(null)} onDone={(out) => { setConfirming(null); if (out?.delivery?.via === "link") openWa(out.delivery.waLink); load(); }} />
            <ExtendDialog key={extending?.id || "none"} offer={extending} onClose={() => setExtending(null)} onDone={(view) => { setExtending(null); upsert(view); load(); }} />
        </div>
    );
}

function Countdown({ o }) {
    const now = useNow(o.status === "sent" ? 1000 : 60000);
    const ms = new Date(o.expiresAt).getTime() - now;
    if (o.status === "expired") return <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock3 className="h-3.5 w-3.5" />Ended {ago(o.expiresAt)} · not accepted</span>;
    if (o.status !== "sent" || !now) return null;
    const tone = ms < 3600000 ? "bg-red-50 text-red-700" : ms < 6 * 3600000 ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600";
    return <span className={`flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs font-bold ${tone}`}><Clock3 className="h-3.5 w-3.5" />{left(ms)}</span>;
}

function OfferCard({ o, open, onToggle, onDone, onExtend, onResend, onWithdraw }) {
    const t = o.totals || {};
    const lastMsg = o.messages?.[o.messages.length - 1];
    const urgent = o.status === "accepted" || o.status === "attention";
    return (
        <div id={`offer-${o.id}`} className={`overflow-hidden rounded-3xl border bg-white transition ${urgent ? "border-emerald-300 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" : "border-slate-200"} ${open ? "ring-2 ring-slate-900/10" : ""}`}>
            <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-24 sm:w-24">
                    {o.cover ? <img src={o.cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><Gift className="h-7 w-7" /></div>}
                    <span className={`absolute left-1 top-1 rounded-md px-1 py-0.5 text-[8px] font-bold uppercase sm:left-1.5 sm:top-1.5 sm:px-1.5 sm:text-[9px] ${o.kind === "booking" ? "bg-teal-700 text-white" : "bg-orange-500 text-white"}`}>{o.kind === "booking" ? "Trip ready" : "Marketing"}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col-reverse items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-2">
                        <div className="min-w-0 max-w-full">
                            <p className="line-clamp-2 break-words font-bold text-slate-900">{o.title}</p>
                            <p className="text-xs leading-relaxed text-slate-500 sm:truncate"><Link href={`/admin/customers/${o.user}`} className="font-semibold text-slate-700 hover:underline">{o.guest?.name}</Link> · {o.guest?.phone} · <span className="font-mono">{o.code}</span></p>
                        </div>
                        <OfferStatus status={o.status} label={o.statusLabel} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <span className="text-lg font-bold text-slate-900">{inr(t.total)}</span>
                        {t.savings > 0 && <span className="text-xs text-slate-400 line-through">{inr(t.listTotal)}</span>}
                        {t.savings > 0 && <span className="text-xs font-bold text-emerald-600">−{t.savingsPct}%</span>}
                        <span className="text-xs text-amber-700">advance {inr(t.advance)}</span>
                        {o.dates && <span className="text-xs text-slate-500">{o.dates}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Countdown o={o} />
                        <span className="flex items-center gap-1">{o.views ? <Eye className="h-3.5 w-3.5 text-teal-600" /> : <EyeOff className="h-3.5 w-3.5" />}{o.views ? `Opened ${o.views}× · ${ago(o.lastViewedAt || o.firstViewedAt)}` : "Not opened yet"}</span>
                        {lastMsg && <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{lastMsg.kind} · {lastMsg.via === "api" ? "sent" : lastMsg.via === "link" ? "via your WhatsApp" : "not sent"} · {ago(lastMsg.at || lastMsg.createdAt)}</span>}
                    </div>
                </div>
            </div>

            {o.status === "attention" && (
                <div className="mx-4 mb-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><b>Paid {inr(o.payment?.amount)} online ({o.payment?.paymentId}) but the booking failed:</b> {o.problem || "unknown error"}. Book it by hand in Custom Packages or refund in Razorpay.</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 sm:px-4">
                {o.status === "accepted" && <button onClick={onDone} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 sm:flex-none sm:py-2"><CheckCircle2 className="h-4 w-4" /> Done · confirm trip</button>}
                {o.status === "sent" && <ResendMenu onPick={onResend} defaultKind={o.kind} />}
                {o.status === "awaiting_payment" && <button onClick={() => onResend("payment")} className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"><Send className="h-4 w-4" /> Resend pay link</button>}
                {(o.status === "sent" || o.status === "expired") && <button onClick={onExtend} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"><TimerReset className="h-4 w-4" />{o.status === "expired" ? "Reopen" : "Extend"}</button>}
                {["sent", "accepted", "awaiting_payment", "booking", "attention"].includes(o.status) && <button onClick={() => copy(o.link, "Offer link")} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"><Copy className="h-4 w-4" /> Link</button>}
                {o.status === "booked" && <span className="text-sm text-slate-600">Package <b className="font-mono">{o.packageCode}</b> · booked {ago(o.bookedAt)} · {o.collect === "online" ? "advance paid online" : "advance on QR"}</span>}
                <div className="ml-auto flex items-center gap-2">
                    {["sent", "accepted", "awaiting_payment", "expired"].includes(o.status) && <button onClick={onWithdraw} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Withdraw"><Ban className="h-4 w-4" /></button>}
                    <button onClick={onToggle} className="flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Details <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>
                </div>
            </div>

            {open && (
                <div className="grid gap-4 border-t border-slate-100 p-3.5 *:min-w-0 sm:p-4 md:grid-cols-2">
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Items · {(o.lines || []).length}</p>
                        <div className="space-y-2">
                            {(o.lines || []).map((l, i) => { const I = TYPE_ICON[l.itemType] || Tent; return (
                                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                                    <span className="flex min-w-0 items-start gap-1.5 text-slate-700">
                                        <I className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <span className="min-w-0">
                                            <span className="line-clamp-2 break-words leading-snug">{l.name}</span>
                                            <span className="block text-xs text-slate-400">×{l.quantity}{l.activityTime ? ` · ${l.activityTime}` : ""}</span>
                                        </span>
                                    </span>
                                    <span className="shrink-0 tabular-nums text-slate-900">{inr(l.total)}</span>
                                </div>
                            ); })}
                        </div>
                        <div className="mt-3 space-y-0.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <div className="flex justify-between"><span>Advance online (no rentals)</span><span>{inr(t.advanceOnline)}</span></div>
                            {t.advanceAtHub > 0 && <div className="flex justify-between"><span>Rental advance at pick-up</span><span>{inr(t.advanceAtHub)}</span></div>}
                            <div className="flex justify-between"><span>Balance at venues</span><span>{inr(t.balance)}</span></div>
                        </div>
                        {o.note && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs italic text-orange-900">“{o.note}”</p>}
                    </div>
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timeline</p>
                        <ol className="space-y-1.5 border-l-2 border-slate-100 pl-3">
                            {(o.timeline || []).map((e, i) => (
                                <li key={i} className="text-xs"><span className="font-semibold capitalize text-slate-800">{String(e.event).replace(/_/g, " ")}</span> <span className="text-slate-400">· {e.by} · {when(e.at || e.createdAt)}</span>{e.note && <span className="block text-slate-500">{e.note}</span>}</li>
                            ))}
                        </ol>
                        <p className="mt-3 text-[11px] text-slate-400">Made by {o.createdBy?.name || "YatriMap team"} {ago(o.createdAt)}{o.batch ? ` · batch ${o.batch}` : ""}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function ResendMenu({ onPick, defaultKind }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Send className="h-4 w-4" /> Send again <ChevronDown className="h-3.5 w-3.5" /></button>
            {open && (
                <div className="absolute left-0 top-full z-20 mt-1 w-[min(15rem,80vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {[["marketing", "🎉 Marketing message", "Offer + discount, YatriMap brand"], ["booking", "✅ Trip-ready message", "Your trip is ready + link"], ["reminder", "⏳ Reminder", "Ends soon, don't miss it"]].map(([k, label, hint]) => (
                        <button key={k} onClick={() => { setOpen(false); onPick(k); }} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                            <span className="block text-sm font-semibold text-slate-900">{label}{k === defaultKind ? <span className="ml-1 text-[10px] font-bold uppercase text-teal-600">sent first</span> : null}</span>
                            <span className="block text-xs text-slate-500">{hint}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CollectOption({ id, current, onPick, icon: I, title, body, disabled }) {
    return (
        <button type="button" disabled={disabled} onClick={() => onPick(id)} className={`w-full rounded-2xl border-2 p-4 text-left transition disabled:opacity-40 ${current === id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
            <span className="flex items-center gap-2 font-bold text-slate-900"><I className="h-5 w-5" />{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">{body}</span>
        </button>
    );
}

/** "Done": how is the advance collected? QR → book everything now. Online → the customer pays on TouristGo. */
function ConfirmDialog({ offer, onClose, onDone }) {
    const [collect, setCollect] = useState("qr");
    const [reference, setReference] = useState("");
    const [busy, setBusy] = useState(false);
    if (!offer) return null;
    const t = offer.totals || {};
    const nothingOnline = !t.advanceOnline;
    const submit = async () => {
        setBusy(true);
        const r = await mk("POST", `/offers/${offer.id}/confirm`, { collect, reference });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        onDone(r.data);
    };
    return (
        <Modal open onClose={onClose} title={`Confirm “${offer.title}”`}>
            <p className="mb-4 text-sm text-slate-600">{offer.guest?.name} accepted. Trip total <b>{inr(t.total)}</b>, advance <b>{inr(t.advance)}</b>. How will the advance be collected?</p>
            <div className="space-y-3">
                <CollectOption id="qr" current={collect} onPick={setCollect} icon={QrCode} title={`Advance on our QR · ${inr(t.advance)}`} body="You collect it on the YatriMap QR / UPI. Everything is booked right now and tickets go to the customer." />
                <CollectOption id="online" current={collect} onPick={setCollect} icon={CreditCard} disabled={nothingOnline} title={`Collect online · ${inr(t.advanceOnline)}`} body={nothingOnline ? "Nothing to collect online here (rental advances are paid at pick-up)." : `The customer sees “Pay advance” on TouristGo (Razorpay). Booked automatically after payment.${t.advanceAtHub ? ` Rental advance ${inr(t.advanceAtHub)} is paid at pick-up.` : ""}`} />
            </div>
            {collect === "qr" && <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / reference (optional)" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />}
            <button disabled={busy} onClick={submit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />{busy ? "Working…" : collect === "qr" ? "Book it now" : "Ask the customer to pay"}
            </button>
        </Modal>
    );
}

function ExtendDialog({ offer, onClose, onDone }) {
    const [win, setWin] = useState({ days: 1, hours: 0, minutes: 0 });
    const [busy, setBusy] = useState(false);
    if (!offer) return null;
    const submit = async () => {
        setBusy(true);
        const r = await mk("POST", `/offers/${offer.id}/extend`, { expiresIn: win });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        onDone(r.data);
    };
    return (
        <Modal open onClose={onClose} title={offer.status === "expired" ? "Reopen this offer" : "Give more time"}>
            <p className="mb-3 text-sm text-slate-600">From now, keep <b>{offer.title}</b> open for:</p>
            <WindowFields value={win} onChange={setWin} />
            <button disabled={busy} onClick={submit} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? "Saving…" : offer.status === "expired" ? "Reopen" : "Extend"}</button>
            <p className="mt-2 text-center text-xs text-slate-400">Then tap “Send again” so the customer knows.</p>
        </Modal>
    );
}
