"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Gift, Camera, Star, Send, Copy, MessageCircle, Phone, Mail, BadgeCheck, Tent, Building2, Car, Package, Crown, Clock3, CheckCircle2, AlertTriangle, BellOff, Bell } from "lucide-react";
import { mk, inr, ago, day, when, waMe, openWa, offerBuilderHref } from "@/lib/marketing";
import { SegmentBadge, OfferStatus, Tile, copy } from "@/components/admin/marketing/ui";

const TYPE_ICON = { activity: Tent, hotel: Building2, rental: Car };
const STATUS_TONE = (s) => {
    const v = String(s || "").toLowerCase();
    if (["confirmed", "completed", "checked-in", "checked-out", "paid"].includes(v)) return "bg-emerald-50 text-emerald-700";
    if (["cancelled", "canceled", "rejected", "failed"].includes(v)) return "bg-rose-50 text-rose-700";
    return "bg-amber-50 text-amber-700";
};

function Score({ label, value }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-4 font-mono text-xs font-bold text-slate-500">{label}</span>
            <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-2 w-5 rounded-full ${i <= value ? "bg-teal-600" : "bg-slate-200"}`} />)}</div>
        </div>
    );
}

export function CustomerDetailClient({ customerId }) {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let live = true;
        mk("GET", `/customers/${customerId}`).then((r) => {
            if (!live) return;
            if (!r.ok) { setError(r.message); return; }
            setData(r.data);
        });
        return () => { live = false; };
    }, [customerId, nonce]);
    const load = () => setNonce((n) => n + 1);

    if (error) return <div className="rounded-2xl bg-rose-50 p-6 text-rose-700">{error} · <Link href="/admin/customers" className="underline">Back to customers</Link></div>;
    if (!data) return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>;

    const c = data.customer;
    const ex = data.explorer;

    const reviewRequest = async (b) => {
        setBusy(`rv:${b.id}`);
        const r = await mk("POST", `/customers/${c.id}/review-request`, { bookingId: b.id });
        setBusy("");
        if (!r.ok) { toast.error(r.message); return; }
        if (r.data?.via === "link") openWa(r.data.waLink);
        else if (r.data?.via === "none") { toast.error(r.data.error || "Not sent"); return; }
        toast.success(r.message);
        load();
    };
    const invite = async () => {
        setBusy("invite");
        const r = await mk("POST", `/customers/${c.id}/explorer-invite`);
        setBusy("");
        if (!r.ok) { toast.error(r.message); return; }
        const d = r.data?.[0];
        if (d?.via === "link") openWa(d.waLink);
        else if (d?.via === "none") { toast.error(d.error || "Not sent"); return; }
        toast.success(r.message);
        load();
    };
    const toggleMarketing = async () => {
        setBusy("optout");
        const r = await mk("PATCH", `/customers/${c.id}`, { marketingOptOut: !c.optedOut });
        setBusy("");
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        load();
    };

    const openOffers = data.offers.filter((o) => ["sent", "accepted", "awaiting_payment", "booking", "attention"].includes(o.status));

    return (
        <div className="space-y-5">
            <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Customers</Link>

            {/* Header */}
            <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 bg-gradient-to-br from-teal-600 to-slate-900 text-xl font-bold text-white">{(c.name || "?").charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold text-slate-900 sm:text-2xl">
                                    {c.name}
                                    {c.vip && <Crown className="h-5 w-5 text-amber-500" />}
                                    {c.verified ? <BadgeCheck className="h-5 w-5 text-teal-600" /> : <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold uppercase text-amber-700">pending verification</span>}
                                </h3>
                                <p className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                    <a href={`mailto:${c.email}`} className="flex min-w-0 items-center gap-1 break-all hover:text-slate-900"><Mail className="h-3.5 w-3.5" />{c.email}</a>
                                    {c.phone && <a href={`tel:+91${String(c.phone).slice(-10)}`} className="flex items-center gap-1 hover:text-slate-900"><Phone className="h-3.5 w-3.5" />{c.phone}</a>}
                                    {c.phone && <a href={waMe(c.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">Joined {ago(c.joinedAt)} · via {c.source}{c.verifiedAt ? ` · verified ${ago(c.verifiedAt)}` : ""}</p>
                            </div>
                        </div>
                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                            <button disabled={!c.phone} onClick={() => router.push(offerBuilderHref([c]))} className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40"><Gift className="h-4 w-4" /> Create trip offer</button>
                            <button disabled={busy === "optout"} onClick={toggleMarketing} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold ${c.optedOut ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`} title="Marketing messages (offers, reminders, explorer invite)">
                                {c.optedOut ? <><BellOff className="h-4 w-4" /> Marketing off</> : <><Bell className="h-4 w-4" /> Marketing on</>}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                        <Tile label="Bookings" value={c.stats.bookings} hint={c.stats.firstBookingAt ? `first ${ago(c.stats.firstBookingAt)}` : "none yet"} />
                        <Tile label="Spent" value={inr(c.stats.spent)} tone="text-teal-800" />
                        <Tile label="Last booking" value={c.stats.lastBookingAt ? ago(c.stats.lastBookingAt) : "—"} />
                        <Tile label="Reviews" value={c.stats.reviews} hint={c.stats.toReview ? `${c.stats.toReview} to ask for` : "all caught up"} tone={c.stats.toReview ? "text-amber-700" : "text-slate-900"} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Segment</p>
                        <div className="mt-2"><SegmentBadge segment={c.segment} info={c.segmentInfo} /></div>
                        <p className="mt-2 text-sm text-slate-600">{c.segmentInfo?.tip}</p>
                        {c.rfm && (
                            <div className="mt-3 space-y-1.5">
                                <Score label="R" value={c.rfm.R} />
                                <Score label="F" value={c.rfm.F} />
                                <Score label="M" value={c.rfm.M} />
                                <p className="pt-1 text-[11px] text-slate-400">Recency ({c.rfm.days} days since last booking) · Frequency · Monetary value, each 1–5.</p>
                            </div>
                        )}
                    </div>

                    {/* Explorer */}
                    <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4 sm:p-5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-600"><Camera className="h-3.5 w-3.5" /> YatriMap Explorer</p>
                        {ex && ex.stories > 0 ? (
                            <div className="mt-3 flex gap-3">
                                {ex.lastStory?.photo && <img src={ex.lastStory.photo} alt="" className="h-20 w-20 rounded-2xl object-cover" />}
                                <div className="min-w-0 text-sm">
                                    <p className="font-bold text-slate-900">{ex.handle ? `@${ex.handle}` : ex.name}{ex.verified && <BadgeCheck className="ml-1 inline h-4 w-4 text-sky-500" />}</p>
                                    <p className="text-slate-600">{ex.stories} stories · {ex.followers} followers · {ex.following} following</p>
                                    <p className="text-slate-500">{ex.xp} XP{ex.lastStory ? ` · last story ${ago(ex.lastStory.at)}` : ""}</p>
                                    {ex.lastStory?.caption && <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">“{ex.lastStory.caption}”</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2">
                                <p className="text-sm text-slate-700">{ex ? "Has a profile but hasn't posted yet." : "Not an explorer yet."}{c.explorerInvitedAt ? ` Invited ${ago(c.explorerInvitedAt)}.` : ""}</p>
                                <button disabled={busy === "invite" || !c.phone || c.optedOut} onClick={invite} className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><MessageCircle className="h-4 w-4" />{c.explorerInvitedAt ? "Invite again" : "Invite to become an Explorer"}</button>
                                {c.optedOut && <p className="mt-1.5 text-xs text-rose-600">Marketing messages are off for this customer.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Open offers */}
            {openOffers.length > 0 && (
                <div className="rounded-3xl border border-orange-200 bg-orange-50/60 p-4">
                    <p className="mb-2 text-sm font-bold text-orange-900">Open offers</p>
                    <div className="space-y-2">
                        {openOffers.map((o) => (
                            <Link key={o.id} href={`/admin/offers?focus=${o.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-3.5 py-3 hover:shadow-sm sm:gap-3 sm:px-4">
                                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{o.title}</span><span className="text-xs text-slate-500">{o.code} · {inr(o.totals.total)} · viewed {o.views}×</span></span>
                                <OfferStatus status={o.status} label={o.statusLabel} />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid gap-5 *:min-w-0 xl:grid-cols-[1.6fr_1fr]">
                {/* Bookings */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h4 className="text-lg font-bold text-slate-900">Bookings <span className="text-sm font-medium text-slate-400">· what, where, when</span></h4>
                    {!data.bookings.length && <p className="mt-4 text-sm text-slate-400">No bookings yet. A first-trip offer works well here.</p>}
                    <div className="mt-4 space-y-3">
                        {data.bookings.map((b) => {
                            const I = TYPE_ICON[b.type] || Tent;
                            return (
                                <div key={`${b.type}:${b.id}`} className="rounded-2xl border border-slate-100 p-3">
                                    <div className="flex gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">{b.image ? <img src={b.image} alt="" className="h-full w-full object-cover" /> : <I className="h-5 w-5" />}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{b.type}</span>
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE(b.status)}`}>{b.status}</span>
                                                {b.fromPackage && <span className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"><Package className="h-3 w-3" />{b.fromPackage}</span>}
                                                <span className="font-mono text-[11px] text-slate-400">{b.code}</span>
                                            </div>
                                            <p className="mt-0.5 truncate font-semibold text-slate-900">{b.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {b.place}{b.city ? ` · ${b.city}` : ""} · {day(b.date)}{b.endDate ? ` → ${day(b.endDate)}` : ""}{b.time ? ` · ${b.time}` : ""}{b.guests ? ` · ${b.guests} ${b.type === "rental" ? "vehicle(s)" : "guest(s)"}` : ""}
                                            </p>
                                            <p className="text-xs text-slate-400">Booked {when(b.createdAt)} · {inr(b.total)}{b.advance ? ` · advance ${inr(b.advance)}` : ""}</p>
                                        </div>
                                    </div>
                                    {b.type === "activity" && (
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                                            {b.review ? (
                                                <span className="flex items-center gap-1 text-xs text-slate-700">
                                                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= b.review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}
                                                    <span className="ml-1 line-clamp-1 italic text-slate-500">{b.review.comment ? `“${b.review.comment}”` : "Rated"} · {ago(b.review.at)}</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                                    {b.reviewRequestedAt ? <><Clock3 className="h-3.5 w-3.5" />Review asked {ago(b.reviewRequestedAt)}, not reviewed yet</> : b.canRequestReview ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Done, not reviewed</> : <>Review opens after the activity</>}
                                                </span>
                                            )}
                                            {!b.review && (
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => copy(b.reviewLink, "Review link")} className="rounded-lg bg-white p-1.5 text-slate-500 ring-1 ring-slate-200 hover:text-slate-900" title="Copy review link"><Copy className="h-3.5 w-3.5" /></button>
                                                    {b.canRequestReview && (
                                                        <button disabled={busy === `rv:${b.id}`} onClick={() => reviewRequest(b)} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"><Send className="h-3.5 w-3.5" />{b.reviewRequestedAt ? "Ask again" : "Send review request"}</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-5">
                    {/* Offers history */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                        <h4 className="text-lg font-bold text-slate-900">Trip offers</h4>
                        {!data.offers.length && <p className="mt-3 text-sm text-slate-400">None sent yet.</p>}
                        <div className="mt-3 space-y-2">
                            {data.offers.map((o) => (
                                <Link key={o.id} href={`/admin/offers?focus=${o.id}`} className="block rounded-2xl border border-slate-100 px-3 py-2.5 hover:border-slate-300">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{o.title}</span>
                                        <OfferStatus status={o.status} label={o.statusLabel} />
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-500">{o.code} · {o.kind} · {inr(o.totals.total)} · sent {ago(o.createdAt)} · viewed {o.views}×</p>
                                </Link>
                            ))}
                        </div>
                        {data.packages.length > 0 && (
                            <>
                                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Packages</p>
                                <div className="mt-2 space-y-1.5">
                                    {data.packages.map((p) => (
                                        <div key={p.id} className="flex justify-between text-xs text-slate-600"><span className="font-mono">{p.code}{p.offer ? ` · ${p.offer}` : ""}</span><span>{p.items} items · {inr(p.total)} · {ago(p.createdAt)}</span></div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                        <h4 className="text-lg font-bold text-slate-900">WhatsApp log</h4>
                        {!data.messages.length && <p className="mt-3 text-sm text-slate-400">No messages yet.</p>}
                        <div className="mt-3 space-y-1.5">
                            {data.messages.map((m) => (
                                <div key={m._id} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                                        {m.status === "failed" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                                        <span className="truncate">{String(m.event || m.template).replace(/_/g, " ")}</span>
                                        <span className="text-slate-400">{m.status === "skipped" ? "via your WhatsApp" : m.status}</span>
                                    </span>
                                    <span className="shrink-0 text-slate-400" title={m.errorMessage || ""}>{ago(m.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
