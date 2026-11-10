"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Search, Sparkles, Send, Megaphone, CheckCircle2, Info } from "lucide-react";
import { mk, inr } from "@/lib/marketing";
import { Modal, Deliveries, WindowFields, SegmentBadge } from "@/components/admin/marketing/ui";

const first = (name) => String(name || "there").trim().split(/\s+/)[0] || "there";
const leftText = (ms) => {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d) return `${d} day${d > 1 ? "s" : ""}${h ? ` ${h} hr` : ""}`;
    if (h) return `${h} hr${m ? ` ${m} min` : ""}`;
    return `${Math.max(1, m)} min`;
};
const NOTE_IDEAS = ["Prices held just for you until the timer ends.", "Pick-up from your hotel is included.", "Weekend slots fill fast, so grab it soon!", "Made around what you loved last time 😊"];

/** WhatsApp bubble with *bold* like the real message. */
function Bubble({ text }) {
    const parts = text.split(/(\*[^*\n]+\*)/g);
    return (
        <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-3 py-2 text-[12.5px] leading-relaxed text-slate-800 shadow-sm">
            <p className="whitespace-pre-wrap">{parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>))}</p>
        </div>
    );
}

/**
 * Step 2 of the package builder in offer mode: who gets it, the title, which WhatsApp message,
 * how long it stays open. Every customer gets their own offer (own link, own countdown).
 */
export function OfferComposer({ recipients, setRecipients, totals, itemNames, validate, buildItems, onSent }) {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [note, setNote] = useState("");
    const [kind, setKind] = useState("marketing");
    const [win, setWin] = useState({ days: 2, hours: 0, minutes: 0 });
    const [find, setFind] = useState("");
    const [found, setFound] = useState([]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const needle = find.trim();
        if (needle.length < 2) return undefined;
        const t = setTimeout(async () => {
            const r = await mk("GET", `/customers?q=${encodeURIComponent(needle)}&limit=8`);
            if (r.ok) setFound(r.data.rows);
        }, 250);
        return () => clearTimeout(t);
    }, [find]);

    const suggestion = useMemo(() => {
        const names = [...new Set(itemNames.map((n) => String(n).split(" - ")[0].split(" (")[0].trim()).filter(Boolean))];
        if (!names.length) return "";
        const head = names.slice(0, 2).join(" + ");
        return `${head}${names.length > 2 ? ` & ${names.length - 2} more` : ""}`.slice(0, 80);
    }, [itemNames]);

    const ms = ((Number(win.days) || 0) * 1440 + (Number(win.hours) || 0) * 60 + (Number(win.minutes) || 0)) * 60000;
    const who = recipients[0];
    const shownTitle = title || suggestion || "Your trip";
    // Same as the server: usual price = list price × qty (activities), so a lowered price counts as savings.
    const usual = Math.max(totals.listTotal || 0, totals.subtotal);
    const savings = Math.max(0, usual - totals.total);
    const save = savings > 0 ? `${inr(savings)} (${Math.round((savings / Math.max(1, usual)) * 100)}% off)` : "a special YatriMap price";
    const preview = kind === "marketing"
        ? `🎉 Great news, ${first(who?.name)}!\n*YatriMap* has unlocked a special trip just for you ✨\n\n🧳 *${shownTitle}*\n💰 Usual ${inr(usual)} → now *${inr(totals.total)}*\n🏷️ You save ${save}\n⏳ Offer ends in ${leftText(ms)}\n\n👉 See your trip & grab it: touristgo…/trips?offer=…\n\nLog in with your email · password = last 4 digits of your mobile.\n\n— Team YatriMap 🏔️`
        : `Hi ${first(who?.name)}, your trip is ready ✅\n*${shownTitle}* has been put together for you by YatriMap.\n\n💰 Total ${inr(totals.total)} · discount ${inr(savings)}\n🔒 Advance to confirm: ${inr(totals.advance)}\n\nReview & accept here 👉 touristgo…/trips?offer=…\n\nLog in with your email · password = last 4 digits of your mobile.\n— YatriMap`;

    const add = (c) => {
        if (!c.phone) { toast.error(`${c.name} has no mobile number`); return; }
        if (!recipients.some((x) => x.id === c.id)) setRecipients([...recipients, c]);
        setFind("");
    };
    const matches = find.trim().length >= 2 ? found : [];

    const send = async () => {
        const problem = validate();
        if (problem) { toast.error(problem); return; }
        if (!recipients.length) { toast.error("Add at least one customer"); return; }
        if (ms < 600000 || ms > 60 * 86400000) { toast.error("Offer time must be between 10 minutes and 60 days"); return; }
        const finalTitle = (title || suggestion).trim();
        if (finalTitle.length < 3) { toast.error("Give the trip a title"); return; }
        setBusy(true);
        const r = await mk("POST", "/offers", { userIds: recipients.map((c) => c.id), items: buildItems(), title: finalTitle, note, kind, expiresIn: win });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        setResult(r.data);
    };

    return (
        <div className="space-y-4">
            {/* Recipients */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Send to</h3>
                    <span className="text-xs text-slate-500">{recipients.length} customer{recipients.length === 1 ? "" : "s"} · each gets their own link</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {recipients.map((c) => (
                        <span key={c.id} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
                            {c.name}{c.segment && <span className="ml-0.5 scale-90"><SegmentBadge segment={c.segment} small /></span>}
                            <button onClick={() => setRecipients(recipients.filter((x) => x.id !== c.id))} className="rounded-full p-0.5 hover:bg-slate-200" aria-label={`Remove ${c.name}`}><X className="h-3 w-3" /></button>
                        </span>
                    ))}
                </div>
                <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Add a customer: name, email or mobile" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400 focus:bg-white" />
                    {matches.length > 0 && (
                        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                            {matches.map((c) => (
                                <button key={c.id} onClick={() => add(c)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                                    <span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.email} · {c.phone || "no mobile"}</span></span>
                                    <span className="shrink-0 text-xs text-slate-400">{c.bookings} bookings</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Title + note */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Trip title (customers see this)</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder={suggestion || "e.g. Rishikesh adventure weekend"} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white" />
                    {!title && suggestion && <button onClick={() => setTitle(suggestion)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-700"><Sparkles className="h-3 w-3" />Use “{suggestion}”</button>}
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Note from the team (optional, shown on the trip page)</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="A friendly line about this trip" className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white" />
                    <div className="mt-1 flex flex-wrap gap-1">{NOTE_IDEAS.map((n) => <button key={n} onClick={() => setNote(n)} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{n.length > 34 ? `${n.slice(0, 34)}…` : n}</button>)}</div>
                </div>
            </div>

            {/* Message type */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 font-semibold text-slate-900">WhatsApp message</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setKind("marketing")} className={`rounded-xl border-2 p-3 text-left ${kind === "marketing" ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}>
                        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Megaphone className="h-4 w-4 text-orange-500" />Marketing</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">“Great news! A special offer” · discount + countdown · YatriMap brand</span>
                    </button>
                    <button onClick={() => setKind("booking")} className={`rounded-xl border-2 p-3 text-left ${kind === "booking" ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}>
                        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><CheckCircle2 className="h-4 w-4 text-teal-600" />Trip ready</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">“Your trip is ready” · for a trip they asked for · total + advance</span>
                    </button>
                </div>
                <div className="mt-3 rounded-2xl bg-[#ece5dd] p-3"><Bubble text={preview} /></div>
                <p className="mt-1.5 text-[11px] text-slate-400">{"Preview. If the template isn't approved in Twilio yet, you'll get a one-tap WhatsApp link to send it yourself."}</p>
            </div>

            {/* Window */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 font-semibold text-slate-900">Offer stays open for</h3>
                <WindowFields value={win} onChange={setWin} />
                <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-500"><Info className="mt-0.5 h-3 w-3 shrink-0" />Not accepted in time → it closes by itself and shows as “Not accepted (expired)”. One reminder goes out when ~20% of the time is left.</p>
            </div>

            <button disabled={busy || !recipients.length} onClick={send} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                <Send className="h-4 w-4" />{busy ? "Checking prices & sending…" : `Send offer to ${recipients.length} customer${recipients.length === 1 ? "" : "s"}`}
            </button>
            <p className="text-center text-[11px] text-slate-400">Online advance on TouristGo covers activities and rooms; rental advances are paid at pick-up.</p>

            <Modal open={Boolean(result)} onClose={() => { setResult(null); onSent(); }} title={`${result?.offers?.length || 0} offer${result?.offers?.length === 1 ? "" : "s"} made`} wide>
                <Deliveries rows={result?.deliveries || []} />
                <div className="mt-4 flex gap-2">
                    <button onClick={() => { setResult(null); onSent(); router.push("/admin/offers?focus=" + (result?.offers?.[0]?.id || "")); }} className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800">Open Offers board</button>
                    <button onClick={() => { setResult(null); onSent(); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Make another</button>
                </div>
            </Modal>
        </div>
    );
}
