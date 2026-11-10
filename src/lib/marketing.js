import { buildBackendUrl, adminAuthHeaders } from "@/lib/api-url";

/** Booking panel → /admin/marketing (customers + trip offers). */
export async function mk(method, path, body) {
    try {
        const res = await fetch(buildBackendUrl(`/admin/marketing${path}`), {
            method,
            credentials: "include",
            headers: adminAuthHeaders(body ? { "Content-Type": "application/json" } : {}),
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json.success !== false, status: res.status, data: json.data, message: json.message || (res.ok ? "" : "Something went wrong") };
    } catch {
        return { ok: false, status: 0, data: null, message: "Can't reach the server" };
    }
}

export const inr = (n) => `₹${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("en-IN")}`;

export const ago = (d) => {
    if (!d) return "";
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};

export const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "");
export const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** "2d 4h", "3h 12m", "12m 05s" */
export const left = (ms) => {
    if (ms <= 0) return "ended";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}m ${String(s % 60).padStart(2, "0")}s`;
};

export const waMe = (phone, text = "") => {
    const digits = String(phone || "").replace(/\D/g, "");
    const full = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

export const openWa = (link) => {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
};

/** Recipients picked on Customers, carried to the package builder (ids are also in the URL). */
const RECIPIENTS_KEY = "ym_offer_recipients_v1";
export const rememberRecipients = (list) => {
    try { sessionStorage.setItem(RECIPIENTS_KEY, JSON.stringify(list.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, segment: c.segment })))); } catch { /* ignore */ }
};
export const recallRecipients = () => {
    try { return JSON.parse(sessionStorage.getItem(RECIPIENTS_KEY) || "[]"); } catch { return []; }
};
export const offerBuilderHref = (customers) => {
    rememberRecipients(customers);
    return `/admin/custom-package?offer=1&to=${customers.map((c) => c.id).join(",")}`;
};
