"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X, CheckCircle2, MessageCircle, AlertTriangle, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { openWa, when } from "@/lib/marketing";

export const SEGMENT_STYLE = {
    champion: "bg-amber-100 text-amber-900 ring-amber-200",
    loyal: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    promising: "bg-lime-50 text-lime-800 ring-lime-200",
    new: "bg-sky-50 text-sky-800 ring-sky-200",
    attention: "bg-orange-50 text-orange-800 ring-orange-200",
    at_risk: "bg-rose-50 text-rose-800 ring-rose-200",
    hibernating: "bg-slate-100 text-slate-600 ring-slate-200",
    prospect: "bg-violet-50 text-violet-800 ring-violet-200",
};

const SEGMENT_NAME = {
    champion: ["🏆", "Champions"], loyal: ["💛", "Loyal"], promising: ["🌱", "Promising"], new: ["✨", "New"],
    attention: ["👀", "Needs attention"], at_risk: ["⚠️", "At risk"], hibernating: ["💤", "Hibernating"], prospect: ["🎯", "Prospect"],
};

export function SegmentBadge({ segment, info, small = false }) {
    const fallback = SEGMENT_NAME[segment] ? { emoji: SEGMENT_NAME[segment][0], label: SEGMENT_NAME[segment][1] } : {};
    const i = info?.[segment] || (info?.label ? info : null) || fallback;
    return (
        <span title={i.tip || ""} className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${SEGMENT_STYLE[segment] || SEGMENT_STYLE.prospect} ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
            <span>{i.emoji || "•"}</span>
            {i.label || segment}
        </span>
    );
}

export const OFFER_STYLE = {
    sent: "bg-orange-50 text-orange-700 ring-orange-200",
    accepted: "bg-emerald-500 text-white ring-emerald-500",
    awaiting_payment: "bg-violet-50 text-violet-700 ring-violet-200",
    booking: "bg-sky-50 text-sky-700 ring-sky-200",
    booked: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    attention: "bg-red-500 text-white ring-red-500",
    expired: "bg-slate-100 text-slate-500 ring-slate-200",
    declined: "bg-slate-100 text-slate-500 ring-slate-200",
    cancelled: "bg-slate-100 text-slate-400 ring-slate-200",
};

export function OfferStatus({ status, label }) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${OFFER_STYLE[status] || OFFER_STYLE.sent}`}>{label || status}</span>;
}

export function Tile({ label, value, hint, tone = "text-slate-900" }) {
    return (
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
            <p className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">{label}</p>
            <p className={`mt-1 truncate text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
            {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs">{hint}</p>}
        </div>
    );
}

/** Renders on <body>, so fixed popups/bars never sit inside a scrolled or transformed card. */
export function Portal({ children }) {
    return typeof document === "undefined" ? null : createPortal(children, document.body);
}

/** Locks the page behind a popup (restores on close). */
export function useScrollLock(active) {
    useEffect(() => {
        if (!active) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [active]);
}

/** Bottom sheet on phones, centred dialog from tablets up. */
export function Modal({ open, onClose, title, children, wide = false }) {
    useScrollLock(open);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <Portal>
            <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
                <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
                    <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
                    <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        <button onClick={onClose} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">{children}</div>
                </div>
            </div>
        </Portal>
    );
}

const clocks = new Map();
const clockOf = (step) => {
    if (!clocks.has(step)) {
        clocks.set(step, {
            subscribe: (cb) => { const t = setInterval(cb, step); return () => clearInterval(t); },
            read: () => Math.floor(Date.now() / step) * step,
        });
    }
    return clocks.get(step);
};
/** The current time, refreshed every `step` ms (for countdowns). 0 while rendering on the server. */
export function useNow(step = 1000) {
    const c = clockOf(step);
    return useSyncExternalStore(c.subscribe, c.read, () => 0);
}

export const copy = async (text, what = "Link") => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Couldn't copy"); }
};

/**
 * Result of a WhatsApp send for several customers. "api" went out through Twilio; "link"
 * (template not approved yet, or sending off) opens WhatsApp with the message ready to send.
 */
export function Deliveries({ rows = [] }) {
    if (!rows.length) return null;
    const pending = rows.filter((r) => r.via === "link");
    return (
        <div className="space-y-2">
            {pending.length > 1 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{pending.length} messages to send from your WhatsApp. Tap each one (your browser may block opening many at once).</p>
            )}
            {rows.map((r, i) => (
                <div key={r.offerId || r.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{r.customer || r.name || "Customer"}{r.code ? <span className="ml-2 font-mono text-xs text-slate-400">{r.code}</span> : null}</p>
                        <p className="truncate text-xs text-slate-500">
                            {r.via === "api" ? "Sent on WhatsApp" : r.via === "link" ? (r.reason || "Send it from your WhatsApp") : (r.error || "Not sent")}
                        </p>
                    </div>
                    {r.via === "api" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                    {r.via === "link" && (
                        <div className="flex shrink-0 gap-1.5">
                            {r.text && <button onClick={() => copy(r.text, "Message")} className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200" title="Copy message"><Copy className="h-4 w-4" /></button>}
                            <button onClick={() => openWa(r.waLink)} className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white"><MessageCircle className="h-4 w-4" /> Open WhatsApp</button>
                        </div>
                    )}
                    {r.via === "none" && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />}
                </div>
            ))}
        </div>
    );
}

/** How long an offer stays open: days / hours / minutes (10 min … 60 days). */
export function WindowFields({ value, onChange }) {
    const chips = [["2h", { days: 0, hours: 2, minutes: 0 }], ["6h", { days: 0, hours: 6, minutes: 0 }], ["24h", { days: 1, hours: 0, minutes: 0 }], ["48h", { days: 2, hours: 0, minutes: 0 }], ["3 days", { days: 3, hours: 0, minutes: 0 }], ["7 days", { days: 7, hours: 0, minutes: 0 }]];
    const now = useNow(30000);
    const ms = ((Number(value.days) || 0) * 1440 + (Number(value.hours) || 0) * 60 + (Number(value.minutes) || 0)) * 60000;
    const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold outline-none focus:border-slate-400";
    return (
        <div>
            <div className="grid grid-cols-3 gap-2">
                {[["days", "Days", 60], ["hours", "Hours", 23], ["minutes", "Minutes", 59]].map(([k, label, max]) => (
                    <label key={k} className="text-[11px] text-slate-500">{label}<input type="number" min="0" max={max} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className={field} /></label>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map(([label, v]) => <button key={label} type="button" onClick={() => onChange(v)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">{label}</button>)}
            </div>
            <p className={`mt-2 text-xs ${ms < 600000 || ms > 60 * 86400000 ? "text-rose-600" : "text-slate-500"}`}>
                {ms < 600000 ? "At least 10 minutes" : ms > 60 * 86400000 ? "At most 60 days" : now ? `Ends ${when(now + ms)} · the customer sees a live countdown` : ""}
            </p>
        </div>
    );
}
