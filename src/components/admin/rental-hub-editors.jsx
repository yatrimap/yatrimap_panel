"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, ImagePlus, LocateFixed, MapPin, Trash2, X } from "lucide-react";
import { buildBackendUrl, adminAuthHeaders } from "@/lib/api-url";

/*
 * Panel editors for rental hubs (replace the old hubadmin "Add hub" / "Edit hub" / "Add vehicles"):
 *   HubEditor    name, contact, address, map location, online advance, deposit, logo + photos
 *   ModelEditor  a vehicle model in the YatriMap catalogue (Honda Activa 6G…) with photos
 */

/** Multipart (or JSON) call to /admin/hub-admin. */
export async function haForm(method, path, data, files = {}) {
    try {
        const form = new FormData();
        form.append("data", JSON.stringify(data || {}));
        for (const [field, list] of Object.entries(files)) for (const f of list || []) form.append(field, f, f.name);
        const res = await fetch(buildBackendUrl(`/admin/hub-admin${path}`), { method, credentials: "include", headers: adminAuthHeaders({}), body: form });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json.success !== false, data: json.data, message: json.message || (res.ok ? "" : "Something went wrong") };
    } catch {
        return { ok: false, data: null, message: "Can't reach the server" };
    }
}

async function haGet(path) {
    try {
        const res = await fetch(buildBackendUrl(`/admin/hub-admin${path}`), { credentials: "include", headers: adminAuthHeaders({}) });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json.success !== false, data: json.data, categories: json.categories || null, message: json.message || "" };
    } catch {
        return { ok: false, data: null, message: "Can't reach the server" };
    }
}

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const Label = ({ children }) => <span className="mb-1 block text-xs font-semibold text-slate-600">{children}</span>;

function Modal({ title, subtitle, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                    <div><h3 className="text-lg font-bold text-slate-900">{title}</h3>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
                </div>
                <div className="space-y-5 px-6 py-5">{children}</div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

/** New photos picked here (previews) + existing ones with a remove button. */
function Photos({ existing, onRemoveExisting, added, onAdd, onRemoveAdded, max, label }) {
    const urls = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
    useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
    const total = existing.length + added.length;
    return (
        <div className="flex flex-wrap gap-2">
            {existing.map((u) => (
                <div key={u} className="relative h-20 w-28 overflow-hidden rounded-lg border border-slate-200">
                    <img src={u} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => onRemoveExisting(u)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo"><Trash2 size={11} /></button>
                </div>
            ))}
            {urls.map((u, i) => (
                <div key={u} className="relative h-20 w-28 overflow-hidden rounded-lg border-2 border-emerald-300">
                    <img src={u} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => onRemoveAdded(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo"><X size={11} /></button>
                </div>
            ))}
            {total < max && (
                <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-emerald-300">
                    <ImagePlus size={18} /> {label}
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} className="hidden" onChange={(e) => { onAdd([...(e.target.files || [])].slice(0, max - total)); e.target.value = ""; }} />
                </label>
            )}
        </div>
    );
}

/** "https://maps.google.com/?q=30.13,78.32", ".../@30.13,78.32,17z", "...!3d30.13!4d78.32" → { lat, lng }. */
const fromMapsLink = (s) => {
    const t = String(s || "");
    const m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) || t.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};

const EMPTY_HUB = { name: "", managerName: "", contactNumber: "", whatsappNumber: "", description: "", street: "", city: "", state: "Uttarakhand", pincode: "", lat: "", lng: "", advancePerVehicle: "", depositPerVehicle: "0", acceptOnline: true, isActive: true };

export function HubEditor({ hubId, onClose, onSaved }) {
    const [f, setF] = useState(hubId ? null : EMPTY_HUB);
    const [logo, setLogo] = useState([]);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [keep, setKeep] = useState([]);
    const [mapsLink, setMapsLink] = useState("");
    const [busy, setBusy] = useState(false);
    const [finding, setFinding] = useState(false);

    useEffect(() => {
        if (!hubId) return;
        haGet(`/hubs/${hubId}`).then((r) => {
            if (!r.ok) { toast.error(r.message); onClose(); return; }
            const d = r.data;
            setF({ ...d, lat: d.lat ?? "", lng: d.lng ?? "", advancePerVehicle: d.advancePerVehicle ?? "", depositPerVehicle: String(d.depositPerVehicle ?? 0) });
            setKeep(d.photos || []);
        });
    }, [hubId, onClose]);

    if (!f) return <Modal title="Loading…" onClose={onClose} footer={null}><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></Modal>;
    const set = (k) => (e) => setF((o) => ({ ...o, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

    const findOnMap = async () => {
        const q = [f.street, f.city, f.state, f.pincode, "India"].filter(Boolean).join(", ");
        if (!f.city) { toast.error("Enter the city first"); return; }
        setFinding(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
            const [hit] = await res.json();
            if (!hit) { toast.error("Not found. Paste a Google Maps link instead"); return; }
            setF((o) => ({ ...o, lat: Number(hit.lat).toFixed(6), lng: Number(hit.lon).toFixed(6) }));
            toast.success("Location found — check it on the map");
        } catch {
            toast.error("Could not search the map. Paste a Google Maps link instead");
        } finally { setFinding(false); }
    };
    const applyLink = (v) => {
        setMapsLink(v);
        const p = fromMapsLink(v);
        if (p) { setF((o) => ({ ...o, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) })); toast.success("Location taken from the link"); }
    };

    const save = async () => {
        setBusy(true);
        const data = {
            ...f,
            advancePerVehicle: f.advancePerVehicle === "" ? null : Number(f.advancePerVehicle),
            depositPerVehicle: Number(f.depositPerVehicle || 0),
            keepPhotos: keep,
            removeLogo,
        };
        const r = hubId ? await haForm("PATCH", `/hubs/${hubId}`, data, { logo, photos }) : await haForm("POST", "/hubs", data, { logo, photos });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message || "Saved");
        onSaved(r.data, !hubId);
    };
    const hasPoint = f.lat !== "" && f.lng !== "";
    const existingLogo = !removeLogo && !logo.length && f.logo ? [f.logo] : [];

    return (
        <Modal
            title={hubId ? `Edit ${f.name}` : "Add a rental hub"}
            subtitle={hubId ? `Hub code ${f.code} · touristgo.in/h/${f.code}` : "It gets a short hub code and its own page on TouristGo. Then create the owner login."}
            onClose={onClose}
            footer={(
                <>
                    <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                    <button onClick={save} disabled={busy || !f.name || !f.city || !f.contactNumber || !hasPoint} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : hubId ? "Save hub" : "Add hub"}</button>
                </>
            )}
        >
            <section className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2"><Label>Hub name *</Label><input value={f.name} onChange={set("name")} placeholder="e.g. Ganga Bike Rental" className={input} /></label>
                <label className="block"><Label>Manager / owner name</Label><input value={f.managerName} onChange={set("managerName")} className={input} /></label>
                <label className="block"><Label>Hub phone * (customers call this)</Label><input value={f.contactNumber} onChange={(e) => set("contactNumber")(e.target.value.replace(/\D/g, "").slice(-10))} inputMode="tel" className={input} /></label>
                <label className="block"><Label>WhatsApp for booking alerts</Label><input value={f.whatsappNumber} onChange={(e) => set("whatsappNumber")(e.target.value.replace(/\D/g, "").slice(-10))} inputMode="tel" placeholder="Same as hub phone" className={input} /></label>
                <label className="block sm:col-span-2"><Label>About the hub (shown on TouristGo)</Label><textarea value={f.description} onChange={set("description")} rows={2} className={input} /></label>
            </section>

            <section>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><MapPin size={15} className="text-emerald-600" /> Address &amp; location</p>
                <div className="grid gap-3 sm:grid-cols-4">
                    <label className="block sm:col-span-4"><Label>Street / area</Label><input value={f.street} onChange={set("street")} placeholder="Tapovan, near Laxman Jhula" className={input} /></label>
                    <label className="block sm:col-span-2"><Label>City *</Label><input value={f.city} onChange={set("city")} placeholder="Rishikesh" className={input} /></label>
                    <label className="block"><Label>State</Label><input value={f.state} onChange={set("state")} className={input} /></label>
                    <label className="block"><Label>PIN code</Label><input value={f.pincode} onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className={input} /></label>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <div className="flex flex-wrap items-end gap-2">
                        <button type="button" onClick={findOnMap} disabled={finding} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><LocateFixed size={14} /> {finding ? "Finding…" : "Find from the address"}</button>
                        <label className="block min-w-60 flex-1"><Label>…or paste a Google Maps link</Label><input value={mapsLink} onChange={(e) => applyLink(e.target.value)} placeholder="https://maps.google.com/…" className={input} /></label>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block"><Label>Latitude *</Label><input value={f.lat} onChange={set("lat")} inputMode="decimal" className={input} /></label>
                        <label className="block"><Label>Longitude *</Label><input value={f.lng} onChange={set("lng")} inputMode="decimal" className={input} /></label>
                        {hasPoint && <a href={`https://maps.google.com/?q=${f.lat},${f.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 self-end pb-2 text-xs font-semibold text-emerald-700"><ExternalLink size={13} /> Check on Google Maps</a>}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">The location is used for &quot;near me&quot;, directions for customers and the city listing on TouristGo.</p>
                </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-4">
                <label className="block"><Label>Online advance / vehicle</Label><input value={f.advancePerVehicle} onChange={(e) => set("advancePerVehicle")(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="default" className={input} /></label>
                <label className="block"><Label>Deposit / vehicle</Label><input value={f.depositPerVehicle} onChange={(e) => set("depositPerVehicle")(e.target.value.replace(/\D/g, "").slice(0, 5))} className={input} /></label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={f.acceptOnline} onChange={set("acceptOnline")} className="h-4 w-4 accent-emerald-600" /> Online bookings</label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={f.isActive} onChange={set("isActive")} className="h-4 w-4 accent-emerald-600" /> Active</label>
                <p className="text-[11px] text-slate-500 sm:col-span-4">Advance empty = default (scooty ₹100, bike ₹200). Customers pay it online; the rest at the hub. The hub can change the deposit itself later.</p>
            </section>

            <section className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div>
                    <Label>Logo</Label>
                    <Photos existing={existingLogo} onRemoveExisting={() => setRemoveLogo(true)} added={logo} onAdd={(l) => { setLogo(l.slice(0, 1)); setRemoveLogo(false); }} onRemoveAdded={() => setLogo([])} max={1} label="Logo" />
                </div>
                <div>
                    <Label>Hub photos (up to 8)</Label>
                    <Photos existing={keep} onRemoveExisting={(u) => setKeep((k) => k.filter((x) => x !== u))} added={photos} onAdd={(l) => setPhotos((p) => [...p, ...l])} onRemoveAdded={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} max={8} label="Add photo" />
                </div>
            </section>
        </Modal>
    );
}

const CATEGORY_LABEL = { scooty: "Scooty", bike: "Bike", car: "Car", suv: "SUV", sedan: "Sedan", hatchback: "Hatchback", van: "Van", bus: "Bus", truck: "Truck" };

export function ModelEditor({ model, categories, onClose, onSaved }) {
    const [f, setF] = useState(() => model
        ? { name: model.name, company: model.company, category: model.category, description: model.description, helmetPrice: String(model.helmetPrice || 0), allowBooking: model.allowBooking, isActive: model.isActive }
        : { name: "", company: "", category: "scooty", description: "", helmetPrice: "0", allowBooking: true, isActive: true });
    const [keep, setKeep] = useState(model?.images || []);
    const [images, setImages] = useState([]);
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
    const save = async () => {
        setBusy(true);
        const data = { ...f, helmetPrice: Number(f.helmetPrice || 0), keepImages: keep };
        const r = model ? await haForm("PATCH", `/models/${model.id}`, data, { images }) : await haForm("POST", "/models", data, { images });
        setBusy(false);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message || "Saved");
        onSaved();
    };
    return (
        <Modal
            title={model ? `Edit ${model.fullName}` : "Add a vehicle model"}
            subtitle={model ? `Used by ${model.hubs} hub${model.hubs === 1 ? "" : "s"}` : "Hubs pick models from this list and add their own number plates and prices."}
            onClose={onClose}
            footer={(
                <>
                    <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                    <button onClick={save} disabled={busy || !f.name || !f.company} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : model ? "Save model" : "Add model"}</button>
                </>
            )}
        >
            <section className="grid gap-3 sm:grid-cols-3">
                <label className="block"><Label>Company *</Label><input value={f.company} onChange={set("company")} placeholder="Honda" className={input} /></label>
                <label className="block"><Label>Model *</Label><input value={f.name} onChange={set("name")} placeholder="Activa 6G" className={input} /></label>
                <label className="block"><Label>Type *</Label>
                    <select value={f.category} onChange={set("category")} className={input}>{(categories || Object.keys(CATEGORY_LABEL)).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}</select>
                </label>
                <label className="block sm:col-span-3"><Label>Description (10–500 characters, shown to customers)</Label><textarea value={f.description} onChange={set("description")} rows={2} placeholder="Easy 110cc scooty, perfect for city and Neer Garh rides" className={input} /></label>
                <label className="block"><Label>Extra helmet price</Label><input value={f.helmetPrice} onChange={(e) => setF((o) => ({ ...o, helmetPrice: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className={input} /></label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={f.allowBooking} onChange={set("allowBooking")} className="h-4 w-4 accent-emerald-600" /> Bookable online</label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={f.isActive} onChange={set("isActive")} className="h-4 w-4 accent-emerald-600" /> Active</label>
            </section>
            <section>
                <Label>Photos (up to 6, the first is the main one)</Label>
                <Photos existing={keep} onRemoveExisting={(u) => setKeep((k) => k.filter((x) => x !== u))} added={images} onAdd={(l) => setImages((p) => [...p, ...l])} onRemoveAdded={(i) => setImages((p) => p.filter((_, j) => j !== i))} max={6} label="Add photo" />
            </section>
        </Modal>
    );
}

export { CATEGORY_LABEL, haGet };
