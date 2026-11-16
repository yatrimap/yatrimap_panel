"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Users } from "lucide-react";
import { mk, inr, day, ago, waMe } from "@/lib/marketing";
import { ComboEditor } from "@/components/admin/combo-editor";

/*
 * Combos: (1) requests customers paid for, waiting for the team to pick the hotel / companies and
 * confirm; (2) the combos themselves (write, publish, hide).
 */

const STATUS = {
    paid: { label: "Paid · confirm it", cls: "bg-amber-100 text-amber-800" },
    booked: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-700" },
    cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500" },
    awaiting_payment: { label: "Not paid yet", cls: "bg-slate-100 text-slate-500" },
};

export function CombosClient() {
    const [tab, setTab] = useState("requests");
    const [combos, setCombos] = useState(null);
    const [requests, setRequests] = useState(null);
    const [editing, setEditing] = useState(null); // { combo } | { combo: null }
    const [busy, setBusy] = useState("");
    const [nonce, setNonce] = useState(0);
    const load = useCallback(() => setNonce((n) => n + 1), []);
    useEffect(() => {
        let live = true;
        Promise.all([mk("GET", "/combos"), mk("GET", "/combo-bookings")]).then(([c, r]) => {
            if (!live) return;
            if (c.ok) setCombos(c.data); else toast.error(c.message);
            if (r.ok) setRequests(r.data); else toast.error(r.message);
        });
        return () => { live = false; };
    }, [nonce]);

    const setStatus = async (combo, status) => {
        setBusy(combo.id);
        const r = await mk("PUT", `/combos/${combo.id}`, { status });
        setBusy("");
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(status === "live" ? "Live on TouristGo" : status === "archived" ? "Combo removed" : "Hidden from TouristGo");
        load();
    };

    const cancel = async (b) => {
        const reason = window.prompt(`Cancel ${b.code} for ${b.guest.name}? Write the reason (the advance, if paid, must be refunded from Razorpay):`, "");
        if (reason === null) return;
        const r = await mk("POST", `/combo-bookings/${b.id}/cancel`, { reason });
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message || "Cancelled");
        load();
    };

    if (editing) {
        return <ComboEditor combo={editing.combo} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setTab("combos"); load(); }} />;
    }

    const waiting = requests?.waiting || 0;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    {[{ id: "requests", label: `Requests${waiting ? ` (${waiting})` : ""}` }, { id: "combos", label: "Combos" }].map((t) => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{t.label}</button>
                    ))}
                </div>
                <button type="button" onClick={() => setEditing({ combo: null })} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={15} /> New combo</button>
            </div>

            {tab === "requests" && (
                <div className="space-y-3">
                    {requests === null && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
                    {requests?.items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">No combo requests yet. They appear here when a customer pays the advance on TouristGo.</p>}
                    {requests?.items.map((b) => {
                        const st = STATUS[b.status] || STATUS.cancelled;
                        return (
                            <div key={b.id} className={`rounded-xl border bg-white p-4 ${b.status === "paid" ? "border-amber-300" : "border-slate-200"}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                                            <span className="font-mono text-xs font-semibold text-slate-500">{b.code}</span>
                                            <span className="text-xs text-slate-400">{ago(b.createdAt)}</span>
                                        </div>
                                        <p className="mt-1.5 break-words text-sm font-bold text-slate-900">{b.combo.title}</p>
                                        <p className="mt-0.5 text-sm text-slate-700">{b.guest.name} · <a className="underline" href={waMe(b.guest.phone)} target="_blank" rel="noopener noreferrer">{b.guest.phone}</a> · <span className="break-all">{b.guest.email}</span></p>
                                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Users size={12} /> {b.persons} people</span>
                                            <span>Starts {day(b.startDate)}</span>
                                            <span>Total {inr(b.total)}</span>
                                            <span className="font-semibold text-emerald-700">Paid online {inr(b.payment?.amount || 0)}</span>
                                            {b.packageCode && <span className="font-mono">{b.packageCode}</span>}
                                        </p>
                                        {b.cancelReason && <p className="mt-1 text-xs text-rose-600">{b.cancelReason}</p>}
                                    </div>
                                    {b.status === "paid" && (
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Link href={`/admin/custom-package?combo=${b.id}`} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600">Pick companies &amp; confirm</Link>
                                            <button type="button" onClick={() => cancel(b)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "combos" && (
                <div className="grid gap-3 md:grid-cols-2">
                    {combos === null && <div className="h-32 animate-pulse rounded-xl bg-slate-100" />}
                    {combos?.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 md:col-span-2">No combos yet. Tap “New combo” to write your first one.</p>}
                    {combos?.map((c) => (
                        <div key={c.id} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-orange-200 to-amber-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {(c.cover || c.photos?.[0]) && <img src={c.cover || c.photos[0]} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.status === "live" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.status === "live" ? "Live" : "Draft"}</span>
                                    <span className="font-mono text-[11px] text-slate-400">{c.code}</span>
                                </div>
                                <p className="mt-1 line-clamp-2 break-words text-sm font-bold text-slate-900">{c.title}</p>
                                <p className="text-xs text-slate-500">{inr(c.pricePerPerson)} per person · min {c.minPersons} · advance {inr(c.advance?.amount)} {c.advance?.per === "booking" ? "per booking" : "per person"}</p>
                                <p className="text-[11px] text-slate-400">
                                    {c.views || 0} views · {c.totalBookings ?? c.booked ?? 0} booked
                                    {c.bookingStats?.weekBookings ? ` · ${c.bookingStats.weekBookings} this week` : ""}
                                    {c.bookingStats?.monthBookings ? ` · ${c.bookingStats.monthBookings} in 30 days` : ""}
                                </p>
                                {c.feedback?.votes > 0 && (
                                    <p className="text-[11px] font-semibold text-slate-600" title="From customers' answers to “Did you like this combo?” after the trip">
                                        👍 {c.feedback.likes} · 👎 {c.feedback.dislikes} <span className="font-normal text-slate-400">({c.feedback.percent}% liked it)</span>
                                    </p>
                                )}
                                {(() => {
                                    const parts = (c.sections || []).filter((s) => ["hotel", "rental", "activity"].includes(s.kind));
                                    const linked = parts.filter((s) => (s.kind === "hotel" ? s.ref?.roomId : s.kind === "rental" ? s.ref?.vehicleModelId : s.ref?.activityId)).length;
                                    if (!parts.length) return null;
                                    return <p className={`text-[11px] ${linked === parts.length ? "text-emerald-700" : "text-amber-700"}`}>{linked === parts.length ? "All parts linked: requests open pre-filled" : `${linked} of ${parts.length} parts linked to a hotel / hub / activity`}</p>;
                                })()}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <button type="button" onClick={() => setEditing({ combo: c })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={12} /> Edit</button>
                                    <button type="button" disabled={busy === c.id} onClick={() => setStatus(c, c.status === "live" ? "draft" : "live")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                                        {c.status === "live" ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Show on TouristGo</>}
                                    </button>
                                    {c.status === "live" && <a href={c.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={12} /> Open</a>}
                                    {c.status !== "live" && <button type="button" onClick={() => window.confirm(`Remove “${c.title}”?`) && setStatus(c, "archived")} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Remove</button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
