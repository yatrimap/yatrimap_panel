"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bike, ExternalLink, KeyRound, Pencil, Plus, Search, Star, UserPlus, X } from "lucide-react";
import { buildBackendUrl, adminAuthHeaders } from "@/lib/api-url";
import { inr, ago } from "@/lib/marketing";
import { HubEditor, ModelEditor, CATEGORY_LABEL, haGet } from "@/components/admin/rental-hub-editors";

/*
 * Rental hubs (replaces the old hubadmin app; hubs run day to day in TouristGo /hub):
 *   Hubs            add / edit hubs (address, map location, photos), short code, owner login, online
 *                   advance per vehicle (customers pay it on TouristGo; the rest at the hub), deposit.
 *   Vehicle models  the catalogue hubs pick from (Honda Activa 6G…), with photos.
 *   Owner logins    create (phone + password), link hubs, reset password, turn off.
 */

async function ha(method, path, body) {
    try {
        const res = await fetch(buildBackendUrl(`/admin/hub-admin${path}`), {
            method,
            credentials: "include",
            headers: adminAuthHeaders(body ? { "Content-Type": "application/json" } : {}),
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json.success !== false, data: json.data, message: json.message || (res.ok ? "" : "Something went wrong") };
    } catch {
        return { ok: false, data: null, message: "Can't reach the server" };
    }
}

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function HubRow({ hub, onSaved, onEdit, onCreateOwner }) {
    const [advance, setAdvance] = useState(hub.advancePerVehicle ?? "");
    const [deposit, setDeposit] = useState(String(hub.depositPerVehicle || 0));
    const [busy, setBusy] = useState(false);
    const dirty = String(advance) !== String(hub.advancePerVehicle ?? "") || String(deposit) !== String(hub.depositPerVehicle || 0);
    const save = async (extra = {}) => {
        setBusy(true);
        const r = await ha("PATCH", `/hubs/${hub.id}`, { advancePerVehicle: advance === "" ? null : Number(advance), depositPerVehicle: Number(deposit || 0), ...extra });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(`${hub.name}: saved`);
        onSaved();
    };
    return (
        <tr className="border-b border-slate-100 align-top last:border-0">
            <td className="px-3 py-3">
                <p className="font-semibold text-slate-900">{hub.name}</p>
                <p className="text-xs text-slate-500">{hub.city} · <span className="font-mono font-bold text-slate-700">{hub.code}</span></p>
                {hub.rating && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Star size={11} className="fill-amber-400 text-amber-400" />{hub.rating.avg} ({hub.rating.count})</p>}
            </td>
            <td className="px-3 py-3 text-xs">
                {hub.owner ? (
                    <><p className="font-semibold text-slate-800">{hub.owner.name}</p><p className="text-slate-500">{hub.owner.phone}{hub.owner.isActive ? "" : " · off"}</p></>
                ) : <button onClick={() => onCreateOwner(hub.id)} className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-200">+ Create login</button>}
            </td>
            <td className="px-3 py-3">
                <div className="relative w-28">
                    <input value={advance} onChange={(e) => setAdvance(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="default" className={`${input} pr-14`} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">/vehicle</span>
                </div>
                {advance === "" && <p className="mt-1 text-[10px] text-slate-400">Default: scooty {inr(hub.defaultAdvance.scooty)}, bike {inr(hub.defaultAdvance.bike)}</p>}
            </td>
            <td className="px-3 py-3"><input value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, "").slice(0, 5))} className={`${input} w-24`} /></td>
            <td className="px-3 py-3 text-xs text-slate-600">
                <p>{hub.vehicles} vehicles</p>
                <p>{hub.bookings} bookings{hub.liveBookings ? ` · ${hub.liveBookings} live` : ""}</p>
                {hub.lastBookingAt && <p className="text-slate-400">last {ago(hub.lastBookingAt)}</p>}
            </td>
            <td className="px-3 py-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={hub.acceptOnline} onChange={(e) => save({ acceptOnline: e.target.checked })} className="h-4 w-4 accent-emerald-600" /> Online
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={hub.isActive} onChange={(e) => save({ isActive: e.target.checked })} className="h-4 w-4 accent-emerald-600" /> Active
                </label>
            </td>
            <td className="px-3 py-3 text-right">
                <div className="flex justify-end gap-2">
                    <a href={hub.pageUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-800" title="Hub page"><ExternalLink size={14} /></a>
                    <button onClick={() => onEdit(hub.id)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-800" title="Edit hub" aria-label={`Edit ${hub.name}`}><Pencil size={14} /></button>
                    <button onClick={() => save()} disabled={!dirty || busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                </div>
            </td>
        </tr>
    );
}

function OwnerForm({ hubs, owner, presetHubIds = [], onClose, onSaved }) {
    const [f, setF] = useState(() => owner
        ? { name: owner.name, email: owner.email, hubIds: owner.hubs.map((h) => h.id), password: "" }
        : { name: "", phone: "", email: "", hubIds: presetHubIds, password: "" });
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const free = hubs.filter((h) => !h.owner || (owner && h.owner?.id === owner.id));
    const shown = free.filter((h) => `${h.name} ${h.city} ${h.code}`.toLowerCase().includes(q.toLowerCase()));
    const save = async () => {
        setBusy(true);
        const r = owner
            ? await ha("PATCH", `/owners/${owner.id}`, { name: f.name, email: f.email, hubIds: f.hubIds, ...(f.password ? { password: f.password } : {}) })
            : await ha("POST", "/owners", f);
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message || "Saved");
        onSaved();
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">{owner ? owner.name : "New hub owner login"}</h3>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Owner name" className={input} />
                    {owner ? <input value={owner.phone} disabled className={`${input} bg-slate-50`} /> : <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(-10) })} placeholder="Mobile (login)" className={input} />}
                    <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email (optional)" className={input} />
                    <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={owner ? "New password (to reset)" : "First password (6+)"} className={input} />
                </div>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase text-slate-500">Hubs ({f.hubIds.length})</p>
                <div className="relative mb-2"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hubs" className={`${input} pl-8`} /></div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                    {shown.map((h) => {
                        const on = f.hubIds.includes(h.id);
                        return (
                            <label key={h.id} className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${on ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                                <span><span className="font-semibold">{h.name}</span> <span className="text-xs text-slate-500">{h.city} · {h.code}</span></span>
                                <input type="checkbox" checked={on} onChange={() => setF({ ...f, hubIds: on ? f.hubIds.filter((x) => x !== h.id) : [...f.hubIds, h.id] })} className="h-4 w-4 accent-emerald-600" />
                            </label>
                        );
                    })}
                    {!shown.length && <p className="text-xs text-slate-400">No hubs without an owner.</p>}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                    {owner ? (
                        <button onClick={async () => { const r = await ha("PATCH", `/owners/${owner.id}`, { isActive: !owner.isActive }); if (r.ok) { toast.success(owner.isActive ? "Login turned off" : "Login turned on"); onSaved(); } else toast.error(r.message); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                            {owner.isActive ? "Turn off login" : "Turn on login"}
                        </button>
                    ) : <span className="text-xs text-slate-400">They log in at touristgo.in/hub and must set their own password.</span>}
                    <button onClick={save} disabled={busy || !f.name || (!owner && (!f.phone || f.password.length < 6)) || !f.hubIds.length} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{owner ? "Save" : "Create login"}</button>
                </div>
            </div>
        </div>
    );
}

export function RentalHubsClient() {
    const [tab, setTab] = useState("hubs");
    const [hubs, setHubs] = useState(null);
    const [owners, setOwners] = useState(null);
    const [q, setQ] = useState("");
    const [form, setForm] = useState(undefined); // undefined closed, null new, owner = edit
    const [preset, setPreset] = useState([]);
    const [editHub, setEditHub] = useState(undefined); // undefined closed, null new, id = edit
    const [models, setModels] = useState(null);
    const [categories, setCategories] = useState(null);
    const [editModel, setEditModel] = useState(undefined);
    const [nonce, setNonce] = useState(0);
    const reload = useCallback(() => setNonce((n) => n + 1), []);
    const closeHub = useCallback(() => setEditHub(undefined), []);
    useEffect(() => {
        let live = true;
        Promise.all([ha("GET", "/hubs"), ha("GET", "/owners"), haGet("/models")]).then(([h, o, m]) => {
            if (!live) return;
            if (h.ok) setHubs(h.data); else toast.error(h.message);
            if (o.ok) setOwners(o.data); else toast.error(o.message);
            if (m.ok) { setModels(m.data); setCategories(m.categories); } else toast.error(m.message);
        });
        return () => { live = false; };
    }, [nonce]);
    const shown = useMemo(() => (hubs || []).filter((h) => `${h.name} ${h.city} ${h.code} ${h.owner?.name || ""}`.toLowerCase().includes(q.toLowerCase())), [hubs, q]);
    const noLogin = (hubs || []).filter((h) => !h.owner).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {[["hubs", `Hubs${hubs ? ` (${hubs.length})` : ""}`], ["models", `Vehicle models${models ? ` (${models.length})` : ""}`], ["owners", `Owner logins${owners ? ` (${owners.length})` : ""}`]].map(([id, l]) => (
                    <button key={id} onClick={() => setTab(id)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>
                ))}
                <div className="relative ml-auto"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${input} w-56 pl-8`} /></div>
                {tab === "hubs" && <button onClick={() => setEditHub(null)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add hub</button>}
                {tab === "models" && <button onClick={() => setEditModel(null)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add model</button>}
                {tab === "owners" && <button onClick={() => { setPreset([]); setForm(null); }} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><UserPlus size={15} /> Owner login</button>}
            </div>
            {tab === "hubs" ? (
                <>
                    {noLogin > 0 && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{noLogin} hub{noLogin > 1 ? "s have" : " has"} no owner login yet — tap “+ Create login” on the hub so they can use the hub dashboard.</p>}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                <tr><th className="px-3 py-2">Hub</th><th className="px-3 py-2">Owner login</th><th className="px-3 py-2">Online advance</th><th className="px-3 py-2">Deposit</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
                            </thead>
                            <tbody>
                                {hubs === null ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr> : shown.map((h) => <HubRow key={`${h.id}-${nonce}`} hub={h} onSaved={reload} onEdit={setEditHub} onCreateOwner={(id) => { setPreset([id]); setForm(null); }} />)}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-500">Online advance = what a customer pays on TouristGo per vehicle (Razorpay); YatriMap keeps it. Empty = the default for the vehicle type. The customer pays the rest at the hub.</p>
                </>
            ) : tab === "models" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {models === null ? <p className="text-slate-400">Loading…</p> : models.filter((m) => `${m.fullName} ${m.category}`.toLowerCase().includes(q.toLowerCase())).map((m) => (
                        <button key={m.id} onClick={() => setEditModel(m)} className={`overflow-hidden rounded-2xl border bg-white text-left hover:border-emerald-300 ${m.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                            <div className="flex h-28 items-center justify-center bg-slate-50">{m.images[0] ? <img src={m.images[0]} alt="" className="h-full w-full object-contain" /> : <Bike size={28} className="text-slate-300" />}</div>
                            <div className="p-3">
                                <p className="font-semibold text-slate-900">{m.fullName}</p>
                                <p className="text-xs text-slate-500">{CATEGORY_LABEL[m.category] || m.category} · helmet {inr(m.helmetPrice)} · {m.images.length} photo{m.images.length === 1 ? "" : "s"}</p>
                                <p className="mt-1 text-[11px] text-slate-400">Used by {m.hubs} hub{m.hubs === 1 ? "" : "s"}{m.allowBooking ? "" : " · not bookable"}</p>
                            </div>
                        </button>
                    ))}
                    <button onClick={() => setEditModel(null)} className="flex min-h-44 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500"><Plus size={16} /> New model</button>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {owners === null ? <p className="text-slate-400">Loading…</p> : owners.filter((o) => `${o.name} ${o.phone}`.toLowerCase().includes(q.toLowerCase())).map((o) => (
                        <button key={o.id} onClick={() => setForm(o)} className={`rounded-2xl border bg-white p-4 text-left hover:border-emerald-300 ${o.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                            <div className="flex items-start justify-between"><p className="font-semibold text-slate-900">{o.name}</p><KeyRound size={14} className="text-slate-300" /></div>
                            <p className="text-xs text-slate-500">{o.phone}{o.email ? ` · ${o.email}` : ""}</p>
                            <p className="mt-2 text-xs text-slate-700">{o.hubs.map((h) => `${h.name} (${h.code})`).join(", ") || "No hubs"}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{o.staff} staff · {o.lastLoginAt ? `last login ${ago(o.lastLoginAt)}` : "never logged in"}{o.mustChangePassword ? " · still on first password" : ""}</p>
                        </button>
                    ))}
                    <button onClick={() => { setPreset([]); setForm(null); }} className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500"><Plus size={16} /> New owner login</button>
                </div>
            )}
            {form !== undefined && hubs && <OwnerForm hubs={hubs} owner={form} presetHubIds={preset} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); reload(); }} />}
            {editHub !== undefined && (
                <HubEditor
                    hubId={editHub}
                    onClose={closeHub}
                    onSaved={(hub, created) => {
                        setEditHub(undefined);
                        reload();
                        // A new hub needs someone to run it: open the owner login form with it picked.
                        if (created && hub?.id) { setHubs((list) => [...(list || []), { ...hub, owner: null }]); setPreset([hub.id]); setForm(null); }
                    }}
                />
            )}
            {editModel !== undefined && <ModelEditor model={editModel} categories={categories} onClose={() => setEditModel(undefined)} onSaved={() => { setEditModel(undefined); reload(); }} />}
        </div>
    );
}
