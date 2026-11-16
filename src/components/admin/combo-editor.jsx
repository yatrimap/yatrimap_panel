"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { buildBackendUrl, adminAuthHeaders } from "@/lib/api-url";
import { mk, inr } from "@/lib/marketing";

/*
 * Write / edit one combo package. Every part is free text + photos + a video link. A part can also
 * be linked to the real thing (hotel room, scooty at a hub, activity option) with its day, nights
 * and price share: then a customer's request opens in "Pick companies & confirm" with that part
 * already in the package, priced from the combo price. Unlinked parts are picked by hand there.
 */

const KINDS = [
    { id: "hotel", label: "🏨 Stay" },
    { id: "activity", label: "🚣 Activity" },
    { id: "rental", label: "🛵 Scooty / rental" },
    { id: "other", label: "✨ Other" },
];
const BOOKABLE = ["hotel", "rental", "activity"];
const blankPlan = () => ({ day: 1, units: "", peoplePer: "", priceShare: "" });
const blankSection = (kind = "activity") => ({ kind, title: "", subtitle: "", timing: "", includes: "", excludes: "", details: "", photos: [], videoUrl: "", ref: {}, plan: blankPlan() });
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const num = (v) => Number(v) || 0;
const blank = () => ({
    title: "", tagline: "", city: "rishikesh", pricePerPerson: "", mrpPerPerson: "", minPersons: 2, maxPersons: 20, days: 1, nights: 0,
    badge: "", highlights: "", cover: "", photos: [], videoUrl: "", terms: "", contactPhone: "9569465803",
    advance: { amount: "", per: "person" }, sections: [blankSection("hotel")],
});
const toText = (list) => (Array.isArray(list) ? list.join("\n") : list || "");
const fromCombo = (c) => ({
    ...blank(), ...c,
    highlights: toText(c.highlights), terms: toText(c.terms),
    advance: { amount: c.advance?.amount ?? "", per: c.advance?.per || "person" },
    sections: (c.sections || []).map((s) => ({
        ...blankSection(s.kind), ...s,
        includes: toText(s.includes), excludes: toText(s.excludes), details: toText(s.details), ref: s.ref || {},
        // 0 means "not set" on the server: show it as an empty box with the default as placeholder.
        plan: { day: s.plan?.day || 1, units: s.plan?.units || "", peoplePer: s.plan?.peoplePer || "", priceShare: s.plan?.priceShare || "" },
    })),
});

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400";
const label = "mb-1 block text-xs font-semibold text-slate-600";

async function uploadPhoto(file) {
    const body = new FormData();
    body.append("photo", file);
    try {
        const res = await fetch(buildBackendUrl("/admin/marketing/combos/photo"), { method: "POST", credentials: "include", headers: adminAuthHeaders(), body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) return { ok: false, message: json.message || "Could not upload the photo" };
        return { ok: true, url: json.data?.url };
    } catch {
        return { ok: false, message: "Can't reach the server" };
    }
}

/** Photos: upload from the device or paste a link. */
function PhotoList({ value, onChange, max = 12 }) {
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState("");
    const add = async (files) => {
        setBusy(true);
        const next = [...value];
        for (const f of [...files].slice(0, max - next.length)) {
            const r = await uploadPhoto(f);
            if (r.ok) next.push(r.url); else toast.error(r.message);
        }
        onChange(next);
        setBusy(false);
    };
    const addLink = () => {
        const u = link.trim();
        if (!/^https?:\/\/\S+$/i.test(u)) { toast.error("Paste a full link starting with https://"); return; }
        onChange([...value, u]);
        setLink("");
    };
    return (
        <div>
            <div className="flex flex-wrap gap-2">
                {value.map((u, i) => (
                    <div key={`${u}${i}`} className="relative h-20 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} /></button>
                    </div>
                ))}
                {value.length < max && (
                    <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                        {busy ? "Uploading…" : "Add photos"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={busy} onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ""; }} />
                    </label>
                )}
            </div>
            <div className="mt-2 flex gap-2">
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a photo link" className={input} />
                <button type="button" onClick={addLink} className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Add</button>
            </div>
        </div>
    );
}

const pick = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-slate-400";
const small = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-slate-400";

/**
 * "Book it with": the real hotel room / scooty at a hub / activity option this part is booked as,
 * plus its day, nights or days, people per room or scooty and its share of the price.
 */
function PartLink({ s, catalog, combo, onChange }) {
    const ref = s.ref || {};
    const plan = s.plan || blankPlan();
    const setRef = (patch) => onChange({ ref: { ...ref, ...patch } });
    const setPlan = (patch) => onChange({ plan: { ...plan, ...patch } });
    const days = Math.max(1, num(combo.days) || 1);
    const defaultUnits = Math.max(1, num(combo.nights));
    const minPeople = Math.max(1, num(combo.minPersons) || 1);
    const units = num(plan.units) || defaultUnits;
    const per = num(plan.peoplePer) || 2;
    const city = String(combo.city || "").toLowerCase();
    // Same city first, then the rest (a Haridwar hotel in a Rishikesh combo is allowed, just lower).
    const byCity = (list) => [...list].sort((a, b) => Number(String(b.city || "").toLowerCase().includes(city)) - Number(String(a.city || "").toLowerCase().includes(city)));

    if (!catalog) return <p className="text-xs text-slate-400"><Loader2 size={12} className="mr-1 inline animate-spin" />Loading hotels, hubs and activities…</p>;

    let linkFields = null;
    let preview = "";
    let linked = false;
    if (s.kind === "hotel") {
        const hotel = catalog.hotels.find((h) => h.id === ref.hotelId);
        const room = hotel?.rooms.find((r) => r.id === ref.roomId);
        linked = Boolean(room);
        linkFields = (
            <>
                <div>
                    <label className={label}>Hotel</label>
                    <select value={ref.hotelId || ""} onChange={(e) => { const h = catalog.hotels.find((x) => x.id === e.target.value); onChange({ ref: h ? { hotelId: h.id, name: h.name, ...(h.rooms.length === 1 && { roomId: h.rooms[0].id }) } : {}, ...(h && !s.subtitle && { subtitle: h.name }) }); }} className={pick}>
                        <option value="">Not linked: pick the hotel when confirming</option>
                        {byCity(catalog.hotels).map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` · ${h.city}` : ""}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Room</label>
                    <select value={ref.roomId || ""} disabled={!hotel} onChange={(e) => setRef({ roomId: e.target.value || undefined })} className={`${pick} ${hotel && !room ? "border-amber-300" : ""}`}>
                        <option value="">{hotel ? "Pick the room" : "Pick a hotel first"}</option>
                        {(hotel?.rooms || []).map((r) => <option key={r.id} value={r.id}>{r.name} · {inr(r.price)}/night{r.maxLimit ? ` · up to ${r.maxLimit}` : ""}</option>)}
                    </select>
                </div>
                <div><label className={label}>Nights</label><input inputMode="numeric" value={plan.units} onChange={(e) => setPlan({ units: digits(e.target.value) })} placeholder={String(defaultUnits)} className={small} /></div>
                <div><label className={label}>People per room</label><input inputMode="numeric" value={plan.peoplePer} onChange={(e) => setPlan({ peoplePer: digits(e.target.value) })} placeholder="2" className={small} /></div>
            </>
        );
        if (room) preview = `${Math.ceil(minPeople / per)} room${Math.ceil(minPeople / per) > 1 ? "s" : ""} × ${units} night${units > 1 ? "s" : ""} (list ${inr(room.price * Math.ceil(minPeople / per) * units)})`;
    } else if (s.kind === "rental") {
        const hub = catalog.hubs.find((h) => h.id === ref.hubId);
        const vehicle = hub?.vehicles.find((v) => v.id === ref.vehicleModelId);
        linked = Boolean(vehicle);
        const scooties = Math.ceil(minPeople / per);
        linkFields = (
            <>
                <div>
                    <label className={label}>Hub</label>
                    <select value={ref.hubId || ""} onChange={(e) => { const h = catalog.hubs.find((x) => x.id === e.target.value); const only = h?.vehicles.length === 1 ? h.vehicles[0].id : undefined; onChange({ ref: h ? { hubId: h.id, name: h.name, ...(only && { vehicleModelId: only }) } : {} }); }} className={pick}>
                        <option value="">Not linked: pick the hub when confirming</option>
                        {byCity(catalog.hubs).map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` · ${h.city}` : ""}{!h.active ? " (inactive)" : ""}{h.vehicles.length ? ` · ${h.vehicles.length} vehicle${h.vehicles.length > 1 ? "s" : ""}` : " · no vehicles"}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Scooty / bike</label>
                    <select value={ref.vehicleModelId || ""} disabled={!hub} onChange={(e) => setRef({ vehicleModelId: e.target.value || undefined })} className={`${pick} ${hub && !vehicle ? "border-amber-300" : ""}`}>
                        <option value="">{hub ? (hub.vehicles.length ? "Pick the vehicle" : "This hub has no vehicles") : "Pick a hub first"}</option>
                        {(hub?.vehicles || []).map((v) => <option key={v.id} value={v.id}>{v.name}{v.category ? ` · ${v.category}` : ""} · {inr(v.pricePerDay)}/day</option>)}
                    </select>
                </div>
                <div><label className={label}>Days</label><input inputMode="numeric" value={plan.units} onChange={(e) => setPlan({ units: digits(e.target.value) })} placeholder={String(defaultUnits)} className={small} /></div>
                <div><label className={label}>People per scooty</label><input inputMode="numeric" value={plan.peoplePer} onChange={(e) => setPlan({ peoplePer: digits(e.target.value) })} placeholder="2" className={small} /></div>
            </>
        );
        if (vehicle) preview = `${scooties} × ${vehicle.name} for ${units} day${units > 1 ? "s" : ""} (list ${inr(vehicle.pricePerDay * scooties * units)})`;
    } else if (s.kind === "activity") {
        const act = catalog.activities.find((a) => a.id === ref.activityId);
        const option = act?.options.find((o) => o.id === ref.variationId);
        const needsOption = Boolean(act?.options.length) && !option;
        linked = Boolean(act) && !needsOption;
        linkFields = (
            <>
                <div className="sm:col-span-2">
                    <label className={label}>Activity and company</label>
                    <select value={ref.activityId || ""} onChange={(e) => { const a = catalog.activities.find((x) => x.id === e.target.value); onChange({ ref: a ? { activityId: a.id, name: a.company, ...(a.options.length === 1 && { variationId: a.options[0].id }) } : {} }); }} className={pick}>
                        <option value="">Not linked: pick the company when confirming</option>
                        {byCity(catalog.activities).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.company || "—"}{a.city ? ` · ${a.city}` : ""}</option>)}
                    </select>
                </div>
                {Boolean(act?.options.length) && (
                    <div className="sm:col-span-2">
                        <label className={label}>Option</label>
                        <select value={ref.variationId || ""} onChange={(e) => setRef({ variationId: e.target.value || undefined })} className={`${pick} ${needsOption ? "border-amber-300" : ""}`}>
                            <option value="">Pick the option (needed to pre-fill the booking)</option>
                            {act.options.map((o) => <option key={o.id} value={o.id}>{o.name} · {inr(o.price)}</option>)}
                        </select>
                    </div>
                )}
            </>
        );
        if (act && !needsOption) preview = `${minPeople} ticket${minPeople > 1 ? "s" : ""} of ${option ? option.name : act.name} (list ${inr((option?.price ?? act.price) * minPeople)})`;
    }

    return (
        <div className={`space-y-3 rounded-lg border p-3 ${linked ? "border-emerald-200 bg-emerald-50/40" : "border-dashed border-slate-300 bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">Book it with {linked ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Linked · pre-filled when confirming</span> : <span className="ml-1 font-normal text-slate-400">(optional)</span>}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {linkFields}
                <div>
                    <label className={label}>{s.kind === "hotel" ? "Check-in on" : s.kind === "rental" ? "Pick-up on" : "On"}</label>
                    <select value={plan.day || 1} onChange={(e) => setPlan({ day: Number(e.target.value) })} className={small}>
                        {Array.from({ length: Math.max(days, num(plan.day)) }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}{i === 0 ? " (start date)" : ""}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Price share per person (₹)</label>
                    <input inputMode="numeric" value={plan.priceShare} onChange={(e) => setPlan({ priceShare: digits(e.target.value) })} placeholder="Auto: by list prices" className={small} />
                </div>
            </div>
            {preview && <p className="text-[11px] text-slate-500">For {minPeople} {minPeople > 1 ? "people" : "person"}: {preview}{num(plan.priceShare) ? ` → charged ${inr(num(plan.priceShare) * minPeople)} in the combo` : ""}</p>}
        </div>
    );
}

export function ComboEditor({ combo, onClose, onSaved }) {
    const [f, setF] = useState(combo ? fromCombo(combo) : blank());
    const [saving, setSaving] = useState("");
    const [catalog, setCatalog] = useState(null);
    const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
    const setSection = (i, patch) => setF((cur) => ({ ...cur, sections: cur.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    const move = (i, d) => setF((cur) => {
        const list = [...cur.sections];
        const j = i + d;
        if (j < 0 || j >= list.length) return cur;
        [list[i], list[j]] = [list[j], list[i]];
        return { ...cur, sections: list };
    });

    // Hotels + rooms, hubs + scooties, activities + options for the "Book it with" pickers.
    useEffect(() => {
        let alive = true;
        mk("GET", "/combos/catalog").then((r) => {
            if (!alive) return;
            if (r.ok) setCatalog(r.data);
            else { toast.error(r.message); setCatalog({ hotels: [], hubs: [], activities: [] }); }
        });
        return () => { alive = false; };
    }, []);

    const price = Number(f.pricePerPerson) || 0;
    const adv = Number(f.advance.amount) || 0;
    const minPeople = Number(f.minPersons) || 1;
    const example = f.advance.per === "booking" ? adv : adv * minPeople;
    const bookable = f.sections.filter((s) => BOOKABLE.includes(s.kind));
    const shares = bookable.reduce((sum, s) => sum + num(s.plan?.priceShare), 0);
    const unshared = bookable.filter((s) => !num(s.plan?.priceShare)).length;

    const save = async (status) => {
        setSaving(status);
        const payload = {
            ...f, status,
            sections: f.sections.map((s) => ({ ...s, plan: { day: num(s.plan?.day) || 1, units: num(s.plan?.units), peoplePer: num(s.plan?.peoplePer), priceShare: num(s.plan?.priceShare) } })),
        };
        const r = combo?.id ? await mk("PUT", `/combos/${combo.id}`, payload) : await mk("POST", "/combos", payload);
        setSaving("");
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(status === "live" ? "Combo is live on TouristGo" : "Saved as a draft");
        onSaved(r.data);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{combo ? "Edit combo" : "New combo"}</h2>
                    <p className="text-xs text-slate-500">Customers see exactly what you write here on TouristGo → Offers.</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Back to list</button>
            </div>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">1. The offer</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><label className={label}>Title *</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={90} placeholder="Hotel + Scooty + Rafting" className={input} /></div>
                    <div className="sm:col-span-2"><label className={label}>One line under the title</label><input value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={140} placeholder="2 days in Rishikesh with a 3-star stay, a scooty and 16 km rafting" className={input} /></div>
                    <div><label className={label}>Price per person (₹) *</label><input inputMode="numeric" value={f.pricePerPerson} onChange={(e) => set({ pricePerPerson: e.target.value.replace(/\D/g, "") })} placeholder="1500" className={input} /></div>
                    <div><label className={label}>Usual price per person (₹)</label><input inputMode="numeric" value={f.mrpPerPerson || ""} onChange={(e) => set({ mrpPerPerson: e.target.value.replace(/\D/g, "") })} placeholder="Shown crossed out, e.g. 2500" className={input} /></div>
                    <div><label className={label}>Minimum people</label><input inputMode="numeric" value={f.minPersons} onChange={(e) => set({ minPersons: e.target.value.replace(/\D/g, "") })} className={input} /></div>
                    <div><label className={label}>Maximum people</label><input inputMode="numeric" value={f.maxPersons} onChange={(e) => set({ maxPersons: e.target.value.replace(/\D/g, "") })} className={input} /></div>
                    <div><label className={label}>Days</label><input inputMode="numeric" value={f.days} onChange={(e) => set({ days: e.target.value.replace(/\D/g, "") })} className={input} /></div>
                    <div><label className={label}>Nights</label><input inputMode="numeric" value={f.nights} onChange={(e) => set({ nights: e.target.value.replace(/\D/g, "") })} className={input} /></div>
                    <div><label className={label}>City</label><input value={f.city} onChange={(e) => set({ city: e.target.value })} className={input} /></div>
                    <div><label className={label}>Badge on the card</label><input value={f.badge} onChange={(e) => set({ badge: e.target.value })} maxLength={40} placeholder="Limited-time offer" className={input} /></div>
                    <div className="sm:col-span-2">
                        <label className={label}>Selling points (one per line)</label>
                        <textarea value={f.highlights} onChange={(e) => set({ highlights: e.target.value })} rows={3} placeholder={"Save ₹1,000 on this combo\nFree ₹500 YatriMap voucher for your next booking"} className={input} />
                    </div>
                </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">2. Photos and video</h3>
                <div><label className={label}>Cover photo link (or the first photo below is used)</label><input value={f.cover} onChange={(e) => set({ cover: e.target.value })} placeholder="https://…" className={input} /></div>
                <div><label className={label}>Photos</label><PhotoList value={f.photos} onChange={(photos) => set({ photos })} max={16} /></div>
                <div><label className={label}>Video link (YouTube, Instagram or Drive)</label><input value={f.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://…" className={input} /></div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">3. What&apos;s in the combo</h3>
                    <span className="text-xs text-slate-500">Link a part to book it straight away when confirming</span>
                </div>
                {f.sections.map((s, i) => (
                    <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={s.kind} onChange={(e) => setSection(i, { kind: e.target.value, ref: {} })} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold">
                                {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                            </select>
                            <input value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} maxLength={90} placeholder={s.kind === "hotel" ? "Private 3-star hotel · 1 night" : s.kind === "rental" ? "125 cc scooty · 1 day" : "16 km Shivpuri river rafting"} className={`${input} min-w-0 flex-1`} />
                            <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500"><ArrowUp size={14} /></button>
                            <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500"><ArrowDown size={14} /></button>
                            <button type="button" onClick={() => set({ sections: f.sections.filter((_, j) => j !== i) })} aria-label="Remove this part" className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600"><Trash2 size={14} /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div><label className={label}>Name (optional)</label><input value={s.subtitle} onChange={(e) => setSection(i, { subtitle: e.target.value })} maxLength={90} placeholder={s.kind === "hotel" ? "Strawbell Residency" : "Leave empty to decide later"} className={input} /></div>
                            <div><label className={label}>Timing</label><input value={s.timing} onChange={(e) => setSection(i, { timing: e.target.value })} maxLength={120} placeholder={s.kind === "hotel" ? "Check-in 1 PM · Check-out 11 AM" : "8 AM to 8 PM"} className={input} /></div>
                            <div><label className={label}>Included (one per line)</label><textarea value={s.includes} onChange={(e) => setSection(i, { includes: e.target.value })} rows={4} placeholder={"AC double bed room\nSwimming pool access"} className={input} /></div>
                            <div><label className={label}>Not included (one per line)</label><textarea value={s.excludes} onChange={(e) => setSection(i, { excludes: e.target.value })} rows={4} placeholder="Video charges (optional)" className={input} /></div>
                            <div className="sm:col-span-2"><label className={label}>More details (one per line)</label><textarea value={s.details} onChange={(e) => setSection(i, { details: e.target.value })} rows={3} placeholder={"600 metres from Triveni Ghat\nRishikesh bus stand: 1.5 km"} className={input} /></div>
                            <div className="sm:col-span-2"><label className={label}>Photos of this part</label><PhotoList value={s.photos} onChange={(photos) => setSection(i, { photos })} /></div>
                            <div><label className={label}>Video link</label><input value={s.videoUrl} onChange={(e) => setSection(i, { videoUrl: e.target.value })} placeholder="https://…" className={input} /></div>
                        </div>
                        {BOOKABLE.includes(s.kind) && <PartLink s={s} catalog={catalog} combo={f} onChange={(patch) => setSection(i, patch)} />}
                    </div>
                ))}
                {bookable.length > 0 && price > 0 && (
                    <p className={`rounded-lg px-3 py-2 text-xs ${shares > price ? "bg-rose-50 font-semibold text-rose-700" : shares === price ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                        {shares === 0
                            ? `No price shares: when confirming, the combo price (${inr(price)} per person) is split over the parts by their list prices.`
                            : shares > price
                                ? `The price shares add up to ${inr(shares)} per person, more than the combo price ${inr(price)}. Lower them.`
                                : shares === price
                                    ? `Price shares add up to the combo price (${inr(price)} per person) ✓`
                                    : unshared
                                        ? `Price shares: ${inr(shares)} of ${inr(price)} per person. The other ${inr(price - shares)} is split over the ${unshared} part${unshared > 1 ? "s" : ""} without a share.`
                                        : `Price shares add up to ${inr(shares)}, not ${inr(price)}: the difference is spread over the parts in the same proportion.`}
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    {KINDS.map((k) => (
                        <button key={k.id} type="button" onClick={() => set({ sections: [...f.sections, blankSection(k.id)] })} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <Plus size={13} /> {k.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">4. Advance the customer pays online</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className={label}>Advance (₹) *</label><input inputMode="numeric" value={f.advance.amount} onChange={(e) => set({ advance: { ...f.advance, amount: e.target.value.replace(/\D/g, "") } })} placeholder="300" className={input} /></div>
                    <div>
                        <label className={label}>Charged</label>
                        <select value={f.advance.per} onChange={(e) => set({ advance: { ...f.advance, per: e.target.value } })} className={input}>
                            <option value="person">Per person</option>
                            <option value="booking">Once per booking</option>
                        </select>
                    </div>
                </div>
                <p className="text-xs text-slate-600">
                    {price > 0 ? `Example: ${minPeople} people → total ${inr(price * minPeople)}, they pay ${inr(example)} now on Razorpay and ${inr(Math.max(0, price * minPeople - example))} later at the hotel / office.` : "Set the price first to see an example."}
                    {" "}When you confirm a request, this advance is split over the stay and the activities automatically (a scooty never takes any of the online payment).
                </p>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">5. Small print</h3>
                <div><label className={label}>Good to know (one per line)</label><textarea value={f.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} placeholder={"Carry a valid photo ID\nRafting depends on the river level"} className={input} /></div>
                <div className="sm:w-1/2"><label className={label}>Phone shown for questions</label><input value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className={input} /></div>
            </section>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
                <button type="button" disabled={Boolean(saving)} onClick={() => save("draft")} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{saving === "draft" ? "Saving…" : "Save as draft"}</button>
                <button type="button" disabled={Boolean(saving)} onClick={() => save("live")} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving === "live" ? "Publishing…" : "Save and show on TouristGo"}</button>
            </div>
        </div>
    );
}
