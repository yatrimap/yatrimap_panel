"use client";

import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash, Search, CheckCircle2, ArrowRight, AlertTriangle, Minus, Gift, X, ShoppingBag } from "lucide-react";
import { AdminMenuButton } from "@/components/admin/admin-shell";
import { buildBackendUrl, getApiV1BaseUrl, adminAuthHeaders } from "@/lib/api-url";
import { OfferComposer } from "@/components/admin/offer-composer";
import { mk, recallRecipients } from "@/lib/marketing";
import { GuestFields, guestFrom, linkedCustomer } from "@/components/admin/guest-fields";

const getDeep = (obj, keys) => {
    let cur = obj;
    for (const key of keys) {
        if (!cur || typeof cur !== "object" || !(key in cur)) return undefined;
        cur = cur[key];
    }
    return cur;
};

const getNestedId = (value) => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object" && "_id" in value) {
        const inner = value._id;
        if (typeof inner === "string") return inner;
        if (typeof inner === "number") return String(inner);
    }
    return "";
};

const amt = (v) => Math.max(0, Math.round(Number(v) || 0));
const inr = (n) => `₹${amt(n).toLocaleString("en-IN")}`;
const todayKey = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

const daysBetween = (a, b) => {
    const s = Date.parse(`${String(a || "").slice(0, 10)}T00:00:00Z`);
    const e = Date.parse(`${String(b || "").slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(s) || Number.isNaN(e)) return 0;
    return Math.round((e - s) / 86400000);
};

// Rooms are priced per night and rentals per day, like everywhere else on YatriMap.
const unitsOf = (item) => (item.itemType === "Activity" ? 1 : Math.max(1, daysBetween(item.checkIn, item.checkOut)));
const unitWord = (item, units) => {
    if (item.itemType === "Hotel") return units === 1 ? "night" : "nights";
    if (item.itemType === "Rental") return units === 1 ? "day" : "days";
    return "";
};

const quoteKey = (item) => `${item.itemId}:${getNestedId(item.variationId) || "base"}:${item.activityDate || ""}`;

// YatriMap's usual advance (same rule as online bookings): activity per option, ₹300 a room, ₹100/200/300 a scooty/bike/other.
const standardAdvance = (item, quote) => {
    const qty = Math.max(1, amt(item.quantity));
    if (item.itemType === "Hotel") return 300 * qty;
    if (item.itemType === "Rental") {
        const c = String(item.coreItem?.vehicleCategory || item.coreItem?.vehicleModelId?.vehicleCategory || "").toLowerCase();
        return (c.includes("scoot") ? 100 : c.includes("bike") ? 200 : 300) * qty;
    }
    return quote ? amt(quote.advancePerUnit) * qty : 0;
};

/** Everything the cart shows and sends for one line. */
const lineOf = (item, quote) => {
    const units = unitsOf(item);
    const qty = Math.max(1, amt(item.quantity));
    const slot = quote?.slots?.find((sl) => sl.label === item.activityTime) || null;
    const listPrice = item.itemType === "Activity" && quote ? (slot?.price ?? quote.listUnitPrice) : null;
    const price = item.itemType === "Activity" && !item.priceTouched && listPrice != null ? listPrice : amt(item.price);
    const subtotal = price * qty * units;
    const discount = amt(item.discount);
    const total = Math.max(0, subtotal - discount);
    const advance = item.advance === undefined ? Math.min(standardAdvance(item, quote), total) : amt(item.advance);
    return { units, qty, price, listPrice, subtotal, discount, total, advance, balance: Math.max(0, total - advance), discountTooBig: discount > subtotal, advanceTooBig: advance > total };
};

/**
 * Whole rupees: `amount` split over `weights` by largest remainders, no part above its cap
 * (what doesn't fit is offered to the others). Equal parts when every weight is 0.
 * Returns { parts, left } — `left` is what fit nowhere.
 */
const splitWhole = (amount, weights, caps = null) => {
    const parts = weights.map(() => 0);
    let left = Math.max(0, Math.round(amount));
    let open = weights.map((_, i) => i).filter((i) => !caps || caps[i] > 0);
    while (left > 0 && open.length) {
        const ws = open.map((i) => Math.max(0, Number(weights[i]) || 0));
        const sum = ws.reduce((a, b) => a + b, 0);
        const exact = ws.map((w) => (sum > 0 ? (left * w) / sum : left / open.length));
        const floors = exact.map(Math.floor);
        let rest = left - floors.reduce((a, b) => a + b, 0);
        exact.map((v, k) => [v - floors[k], k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (rest > 0) { floors[k] += 1; rest -= 1; } });
        let overflow = 0;
        const still = [];
        open.forEach((i, k) => {
            const room = caps ? caps[i] - parts[i] : Infinity;
            const add = Math.min(floors[k], room);
            parts[i] += add;
            overflow += floors[k] - add;
            if (!caps || parts[i] < caps[i]) still.push(i);
        });
        left = overflow;
        open = still;
    }
    return { parts, left };
};

/**
 * Combo requests: the price the customer agreed to and the advance they paid online, spread over
 * the package lines the team hasn't edited by hand.
 *   price    a part's share (set on the combo) is kept; the rest goes over the other lines by
 *            their list value. Each line keeps its list price and the difference becomes its
 *            discount (or the price goes up when the combo pays more than the list).
 *   advance  over the stays and activities by their totals, never above a line's total; rentals
 *            (scooty / bike) always ₹0, the online payment can't go to rentals.
 * Returns { [cart id]: { price, discount, advance } } plus what couldn't be placed.
 */
const comboSplit = (rows, comboTotal, paid) => {
    const manual = rows.filter((r) => r.item.comboManual);
    const auto = rows.filter((r) => !r.item.comboManual);
    const manualTotal = manual.reduce((s, r) => s + r.m.total, 0);
    const manualAdvance = manual.reduce((s, r) => s + r.m.advance, 0);
    const budget = Math.max(0, Math.round(comboTotal) - manualTotal);

    const target = {};
    const shared = auto.filter((r) => amt(r.item.comboShare) > 0);
    const unshared = auto.filter((r) => !(amt(r.item.comboShare) > 0));
    const sumShares = shared.reduce((s, r) => s + amt(r.item.comboShare), 0);
    if (shared.length && unshared.length && sumShares <= budget) {
        shared.forEach((r) => { target[r.item.id] = amt(r.item.comboShare); });
        const { parts } = splitWhole(budget - sumShares, unshared.map((r) => r.base.subtotal));
        unshared.forEach((r, k) => { target[r.item.id] = parts[k]; });
    } else {
        const { parts } = splitWhole(budget, auto.map((r) => (amt(r.item.comboShare) > 0 ? amt(r.item.comboShare) : r.base.subtotal)));
        auto.forEach((r, k) => { target[r.item.id] = parts[k]; });
    }

    const money = {};
    for (const r of auto) {
        const t = target[r.item.id];
        const n = Math.max(1, r.base.qty * r.base.units);
        const price = r.base.price * n >= t ? r.base.price : Math.ceil(t / n);
        money[r.item.id] = { price, discount: price * n - t, total: t, advance: 0 };
    }
    const payable = auto.filter((r) => r.item.itemType !== "Rental");
    const totals = payable.map((r) => money[r.item.id].total);
    const { parts, left } = splitWhole(Math.max(0, Math.round(paid) - manualAdvance), totals, totals);
    payable.forEach((r, k) => { money[r.item.id].advance = parts[k]; });
    return { money, advanceLeft: left, overPrice: manualTotal > comboTotal, overAdvance: manualAdvance > paid };
};

const PART_EMOJI = { hotel: "🏨", rental: "🛵", activity: "🚣", other: "✨" };

/** A combo part the server could resolve (plan entry) as a package line, already filled in. */
const cartItemFromPlan = (p) => {
    const common = { id: `combo-${p.sectionId}`, sectionId: p.sectionId, comboPart: p.title, comboShare: p.share || 0, quantity: p.quantity || 1, children: 0 };
    if (p.itemType === "Hotel") {
        return {
            ...common, key: `Hotel:${p.hotel.id}:${p.room.id}`, itemType: "Hotel", itemId: p.hotel.id,
            coreItem: { _id: p.hotel.id, name: p.hotel.name }, name: `${p.hotel.name} - ${p.room.name}`,
            hotelId: p.hotel.id, roomId: p.room.id, price: p.room.price, origPrice: p.room.price, adults: p.adults || 1,
            checkIn: p.from, checkOut: p.to, activityDate: p.from,
        };
    }
    if (p.itemType === "Rental") {
        return {
            ...common, key: `Rental:${p.hub.id}:${p.vehicle.id}`, itemType: "Rental", itemId: p.vehicle.id,
            coreItem: { _id: p.vehicle.id, vehicleModelId: p.vehicle.id, hubId: { _id: p.hub.id, name: p.hub.name, address: { city: p.hub.city } }, vehicleCategory: p.vehicle.category, vehicleModalName: p.vehicle.name },
            name: `${p.vehicle.name} (${p.hub.name})`, hubId: p.hub.id, vehicleModelId: p.vehicle.id,
            price: p.vehicle.pricePerDay, origPrice: p.vehicle.pricePerDay, adults: 1,
            checkIn: p.from, checkOut: p.to, activityDate: p.from,
        };
    }
    return {
        ...common, key: `Activity:${p.activity.id}:${p.variation?.id || "base"}`, itemType: "Activity", itemId: p.activity.id,
        coreItem: { _id: p.activity.id, activityDetails: { name: p.activity.name }, companyInfo: { name: p.activity.company } },
        name: p.variation ? `${p.activity.name} - ${p.variation.name}` : p.activity.name,
        variationId: p.variation?.id, price: p.price || 0, origPrice: p.price || 0, adults: p.adults || 1,
        checkIn: p.from, checkOut: p.from, activityDate: p.from,
    };
};

export default function CustomPackageBuilder() {
    const [activeTab, setActiveTab] = useState("hotels");
    const [inventory, setInventory] = useState({ hotels: [], rentals: [], activities: [] });
    const [loadingByType, setLoadingByType] = useState({ hotels: true, rentals: true, activities: true });
    const [search, setSearch] = useState("");
    const [selectedCity, setSelectedCity] = useState("rishikesh");
    const [vehicleCategory, setVehicleCategory] = useState("all");
    const getDefaultDates = () => {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
            startDate: today.toISOString().split('T')[0],
            endDate: tomorrow.toISOString().split('T')[0]
        };
    };

    // Global Filter State
    const [globalDates, setGlobalDates] = useState(getDefaultDates());

    // Cart State
    const [cart, setCart] = useState([]);

    // Checkout Form State
    const [guestDetails, setGuestDetails] = useState({ name: "", email: "", phone: "", notes: "" });
    // The existing customer the package is for (picked or matched in step 2); null = new guest.
    const [guestCustomer, setGuestCustomer] = useState(null);
    const [advancePayment, setAdvancePayment] = useState({ mode: "upi", reference: "" });
    // Activity slots / prices / usual advance for the chosen date, per cart line.
    const [quotes, setQuotes] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState(1);

    // Offer mode (?offer=1&to=<customer ids> from Customers): the package goes to those customers as a
    // trip offer on TouristGo (accept → admin confirms → advance) instead of being booked right now.
    const [offerMode, setOfferMode] = useState(false);
    const [recipients, setRecipients] = useState([]);
    // Phones / tablets: the package panel opens as a full-screen sheet from the bottom bar.
    const [cartOpen, setCartOpen] = useState(false);
    useEffect(() => {
        if (!cartOpen || window.innerWidth >= 1024) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [cartOpen]);
    // Combo mode (?combo=<request id> from Combos → Requests): a customer paid a combo's advance on
    // TouristGo. The parts linked on the combo come pre-filled (editable); the combo price and the
    // paid advance are split over the lines automatically; confirming books it all.
    const [comboReq, setComboReq] = useState(null);
    // The combo part the team is adding by hand ("Find it"): the next item added becomes that part.
    const [pendingPart, setPendingPart] = useState(null);
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const comboId = sp.get("combo");
        if (/^[a-f0-9]{24}$/i.test(comboId || "")) {
            mk("GET", `/combo-bookings/${comboId}`).then((r) => {
                if (!r.ok) { toast.error(r.message); return; }
                if (r.data.status !== "paid") { toast.error(r.data.status === "booked" ? `Already confirmed (${r.data.packageCode})` : "This combo request isn't waiting to be confirmed"); return; }
                setComboReq(r.data);
                setOfferMode(false);
                setGuestDetails((g) => ({ ...g, name: r.data.guest.name, email: r.data.guest.email, phone: r.data.guest.phone }));
                const start = new Date(r.data.startDate).toISOString().slice(0, 10);
                const end = new Date(new Date(r.data.startDate).getTime() + Math.max(1, r.data.combo.nights || 1) * 86400000).toISOString().slice(0, 10);
                setGlobalDates({ startDate: start, endDate: end });
                const ready = (r.data.plan || []).filter((p) => p.ready);
                setCart(ready.map(cartItemFromPlan));
                const todo = (r.data.plan || []).filter((p) => p.itemType && !p.ready).length;
                toast.success(todo
                    ? `Combo ${r.data.code}: ${ready.length} part${ready.length === 1 ? "" : "s"} filled in, ${todo} to pick`
                    : `Combo ${r.data.code}: everything is filled in. Check the slots, then confirm`);
            });
        }
        // ?book=<customer id> (customer page → "Book package"): guest details filled in for step 2.
        const bookFor = sp.get("book");
        if (/^[a-f0-9]{24}$/i.test(bookFor || "")) {
            mk("GET", `/customers/${bookFor}`).then((r) => {
                if (!r.ok) return;
                const c = { ...r.data.customer, bookings: r.data.customer.stats?.bookings || 0 };
                setGuestCustomer(c);
                setGuestDetails((g) => ({ ...g, ...guestFrom(c) }));
                toast.success(`Booking for ${c.name}: pick items, their details are filled in`);
            });
        }
        if (sp.get("offer") !== "1") return;
        setOfferMode(true);
        const ids = (sp.get("to") || "").split(",").filter((x) => /^[a-f0-9]{24}$/i.test(x));
        const known = recallRecipients().filter((c) => ids.includes(c.id));
        setRecipients(known);
        ids.filter((id) => !known.some((c) => c.id === id)).slice(0, 20).forEach(async (id) => {
            const r = await mk("GET", `/customers/${id}`);
            if (!r.ok) return;
            const c = r.data.customer;
            setRecipients((list) => (list.some((x) => x.id === id) ? list : [...list, { id, name: c.name, email: c.email, phone: c.phone, segment: c.segment }]));
        });
    }, []);

    const apiV1BaseUrl = getApiV1BaseUrl();
    const apiRootUrl = useMemo(() => apiV1BaseUrl.replace(/\/api\/v1\/?$/, ""), [apiV1BaseUrl]);

    useEffect(() => {
        fetchInventory("hotels");
        fetchInventory("rentals");
        fetchInventory("activities");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCity, vehicleCategory, globalDates.startDate, globalDates.endDate]);

    const fetchInventory = async (type) => {
        setLoadingByType(prev => ({ ...prev, [type]: true }));
        try {
            if (type === "hotels") {
                // Use same endpoint as frontend so "sold out / availableRoomsCount" is accurate.
                const params = new URLSearchParams({
                    page: "1",
                    limit: "50",
                    ...(globalDates.startDate ? { startDate: globalDates.startDate } : {}),
                    ...(globalDates.endDate ? { endDate: globalDates.endDate } : {}),
                    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                });

                const res = await axios.get(`${apiRootUrl}/hotel-admin/hotel/hotels?${params.toString()}`, { withCredentials: true });
                const hotels = res.data?.data?.hotels || [];
                setInventory(prev => ({ ...prev, hotels }));
                return;
            }

            if (type === "rentals") {
                if (!globalDates.startDate || !globalDates.endDate) {
                    setInventory(prev => ({ ...prev, [type]: [] }));
                    return;
                }
                const params = new URLSearchParams({
                    page: "1",
                    limit: "50",
                    startDate: globalDates.startDate,
                    endDate: globalDates.endDate,
                    ...(selectedCity !== "all" ? { location: selectedCity } : {}),
                    ...(vehicleCategory !== "all" ? { category: vehicleCategory } : {}),
                });
                const res = await axios.get(`${apiRootUrl}/userapp/vehicle/list?${params.toString()}`, { withCredentials: true });
                if (res.data.status === "SUCCESS") {
                    const mappedRentals = (res.data.data || []).map(r => ({
                        ...r.vehicle,
                        vehicleModelId: r.vehicle?._id,
                        availableQuantity: r.availableCount,
                        quantity: r.vehicle?.quantity || r.availableCount,
                        totalPrice: r.totalPrice,
                        hub: r.hub,
                        hubId: r.hub,
                        pricing: { rentalPrice: r.price?.vehiclePricePerDay || r.priceBreakdown?.perDay || r.totalPrice || 0 }
                    }));
                    setInventory(prev => ({ ...prev, [type]: mappedRentals }));
                }
                return;
            }

            if (type === "activities") {
                const params = new URLSearchParams({
                    page: "1",
                    limit: "50",
                    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                });
                const res = await axios.get(`${apiRootUrl}/userapp/activity/all?${params.toString()}`, { withCredentials: true });
                if (res.data.success) {
                    setInventory(prev => ({ ...prev, [type]: res.data.data?.activities || [] }));
                }
                return;
            }

        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
        } finally {
            setLoadingByType(prev => ({ ...prev, [type]: false }));
        }
    };



    const getCartKey = (itemType, item, specifics) => {
        const i = item || {};
        const s = specifics || {};
        const itemId = getNestedId(i._id);
        if (itemType === "Hotel") return `Hotel:${itemId}:${getNestedId(s.roomId)}`;
        if (itemType === "Rental") {
            const hubId = getNestedId(s.hubId) || getNestedId(i.hubId) || getNestedId(i.hub?._id);
            const vehicleModelId = getNestedId(s.vehicleModelId) || getNestedId(i.vehicleModelId) || getNestedId(i._id);
            return `Rental:${hubId}:${vehicleModelId}`;
        }
        return `Activity:${itemId}:${getNestedId(s.variationId) || 'base'}`;
    };

    const upsertCartItem = (itemType, item, specifics, delta = 1) => {
        const i = item || {};
        const s = specifics || {};
        const key = getCartKey(itemType, item, specifics);
        const part = comboReq && pendingPart && pendingPart.itemType === itemType && delta > 0 && !cart.some((c) => c.key === key) ? pendingPart : null;
        if (part) setPendingPart(null);
        setCart((prev) => {
            const idx = prev.findIndex((c) => c.key === key);
            if (idx === -1) {
                if (delta <= 0) return prev;
                const newItem = {
                    id: Date.now().toString(),
                    key,
                    itemType,
                    itemId: getNestedId(i._id),
                    coreItem: item,
                    name: (
                        (typeof getDeep(s, ["name"]) === "string" && getDeep(s, ["name"])) ||
                        (typeof getDeep(i, ["name"]) === "string" && getDeep(i, ["name"])) ||
                        (typeof getDeep(i, ["vehicleName"]) === "string" && getDeep(i, ["vehicleName"])) ||
                        (typeof getDeep(i, ["activityDetails", "name"]) === "string" && getDeep(i, ["activityDetails", "name"])) ||
                        (typeof getDeep(i, ["vehicleModelId", "vehicleModalName"]) === "string" && getDeep(i, ["vehicleModelId", "vehicleModalName"])) ||
                        "Unknown Item"
                    ),
                    price: Number(
                        getDeep(s, ["price"]) ??
                        getDeep(i, ["price"]) ??
                        getDeep(i, ["basePricing", "price"]) ??
                        0
                    ),
                    quantity: 1,
                    checkIn: globalDates.startDate || "",
                    checkOut: globalDates.endDate || "",
                    activityDate: globalDates.startDate || "",
                    adults: 1,
                    children: 0,
                    ...s,
                };
                newItem.origPrice = newItem.price;
                // Added for a combo part ("Find it"): it becomes that part, with its dates and price share.
                if (part) {
                    Object.assign(newItem, {
                        sectionId: part.sectionId, comboPart: part.title, comboShare: part.share || 0,
                        ...(part.from && { checkIn: part.from, activityDate: part.from }),
                        ...(part.to && { checkOut: part.to }),
                        ...(itemType === "Activity" && { quantity: comboReq.persons, adults: comboReq.persons }),
                        ...(itemType === "Hotel" && { adults: comboReq.persons }),
                    });
                }
                toast.success("Added to package");
                return [...prev, newItem];
            }

            const next = [...prev];
            const nextQty = Math.max(0, Number(next[idx].quantity || 0) + delta);
            if (nextQty === 0) {
                next.splice(idx, 1);
                return next;
            }
            next[idx] = { ...next[idx], quantity: nextQty };
            return next;
        });
    };

    const getCartQty = (itemType, item, specifics) => {
        const key = getCartKey(itemType, item, specifics);
        return cart.find((c) => c.key === key)?.quantity || 0;
    };

    const removeFromCart = (cartId) => setCart((prev) => prev.filter(item => item.id !== cartId));

    const updateItem = (cartId, patch) => {
        setCart((prev) => prev.map(item => item.id === cartId ? { ...item, ...patch } : item));
    };

    const handleDateChange = (cartId, field, value) => updateItem(cartId, { [field]: value });

    useEffect(() => {
        cart.filter((c) => c.itemType === "Activity" && c.activityDate).forEach((c) => {
            const key = quoteKey(c);
            if (quotes[key]) return;
            setQuotes((q) => ({ ...q, [key]: { loading: true } }));
            const params = new URLSearchParams({ activityId: c.itemId, date: c.activityDate });
            const variationId = getNestedId(c.variationId);
            if (variationId) params.set("variationId", variationId);
            axios.get(buildBackendUrl(`/admin/custom-packages/activity-quote?${params.toString()}`), { headers: adminAuthHeaders(), withCredentials: true })
                .then((res) => {
                    const data = res.data.data;
                    setQuotes((q) => ({ ...q, [key]: { data } }));
                    // A combo part with only one slot that day: picked straight away (the team can change it).
                    if (c.comboPart && !data.closed && data.slots?.length === 1) {
                        setCart((prev) => prev.map((x) => (x.id === c.id && !x.activityTime && quoteKey(x) === key ? { ...x, activityTime: data.slots[0].label } : x)));
                    }
                })
                .catch((err) => setQuotes((q) => ({ ...q, [key]: { error: err.response?.data?.message || "Could not load slots for this date" } })));
        });
    }, [cart, quotes]);

    const quoteOf = (item) => quotes[quoteKey(item)]?.data || null;
    // Combo requests: lines the team hasn't edited by hand take their price, discount and advance
    // from the combo split, so the package always adds up to the combo price and the paid advance.
    const comboPaid = comboReq ? Math.round(comboReq.payment?.amount || 0) : 0;
    const split = comboReq
        ? comboSplit(cart.map((item) => ({ item, base: lineOf({ ...item, discount: 0, advance: 0 }, quoteOf(item)), m: lineOf(item, quoteOf(item)) })), comboReq.total, comboPaid)
        : null;
    const effective = (item) => {
        const s = split?.money[item.id];
        return s ? { ...item, price: s.price, discount: s.discount, advance: s.advance, priceTouched: true } : item;
    };
    const lines = cart.map((raw) => {
        const item = effective(raw);
        return { raw, item, quote: quoteOf(raw), m: lineOf(item, quoteOf(raw)) };
    });
    // Editing a combo line's money fixes that line (its current numbers + the change); the others re-balance.
    const editMoney = (raw, m) => (patch) => {
        if (comboReq && !raw.comboManual) updateItem(raw.id, { price: m.price, discount: m.discount, advance: m.advance, priceTouched: true, comboManual: true, ...patch });
        else updateItem(raw.id, patch);
    };
    const autoLine = (c) => ({ ...c, comboManual: false, discount: undefined, advance: undefined, priceTouched: false, price: c.origPrice ?? c.price });
    const resetSplit = (id) => setCart((prev) => prev.map((c) => (!id || c.id === id ? autoLine(c) : c)));
    const totals = lines.reduce(
        (acc, { m }) => ({ subtotal: acc.subtotal + m.subtotal, discount: acc.discount + m.discount, total: acc.total + m.total, advance: acc.advance + m.advance, balance: acc.balance + m.balance }),
        { subtotal: 0, discount: 0, total: 0, advance: 0, balance: 0 }
    );
    const getTotalPrice = () => totals.total;

    /** Checks every line the way the server will; returns the problem, or "" when it books. */
    const lineProblem = () => {
        if (cart.length === 0) return "Cart is empty";
        for (const { item, quote, m } of lines) {
            if (item.itemType === "Hotel" || item.itemType === "Rental") {
                if (!item.checkIn || !item.checkOut) return `Provide Check-In and Check-Out for ${item.name}`;
                if (daysBetween(item.checkIn, item.checkOut) < 1) return `Check-out must be after check-in for ${item.name}`;
            }
            if (item.itemType === "Activity") {
                if (!item.activityDate) return `Provide Activity Date for ${item.name}`;
                const q = quotes[quoteKey(item)];
                if (!q || q.loading) return `Loading slots for ${item.name}, try again in a moment`;
                if (q.error) return `${item.name}: ${q.error}`;
                if (quote.pastDate) return `${item.name}: that date has passed`;
                if (quote.closed) return `${item.name} is closed on ${item.activityDate}${quote.closedReason ? ` (${quote.closedReason})` : ""}`;
                if (quote.slots.length && !quote.slots.some((sl) => sl.label === item.activityTime)) return `Pick a slot for ${item.name}`;
            }
            if (m.discountTooBig) return `Discount for ${item.name} is more than its price`;
            if (m.advanceTooBig) return `Advance for ${item.name} is more than its total`;
        }
        return "";
    };

    const buildItems = () => lines.map(({ item, m }) => ({
        itemType: item.itemType,
        name: item.name,
        price: m.price,
        quantity: m.qty,
        discount: m.discount,
        advance: m.advance,
        adults: item.adults || 1,
        children: item.children || 0,
        hotelId: item.itemType === "Hotel" ? getNestedId(item.coreItem._id) : undefined,
        roomId: item.itemType === "Hotel" ? getNestedId(item.roomId) : undefined,
        hubId: item.itemType === "Rental" ? getNestedId(item.coreItem.hubId) || getNestedId(item.coreItem.hub?._id) : undefined,
        vehicleModelId: item.itemType === "Rental" ? getNestedId(item.coreItem.vehicleModelId) || getNestedId(item.coreItem._id) : undefined,
        activityId: item.itemType === "Activity" ? getNestedId(item.coreItem._id) : undefined,
        variationId: item.itemType === "Activity" ? getNestedId(item.variationId) || undefined : undefined,
        activityTime: item.itemType === "Activity" ? item.activityTime || undefined : undefined,
        checkIn: item.checkIn || undefined,
        checkOut: item.checkOut || undefined,
        activityDate: item.activityDate || undefined
    }));

    const submitPackage = async () => {
        if (cart.length === 0) return toast.error("Cart is empty");
        if (!guestDetails.name || !guestDetails.email || !guestDetails.phone) return toast.error("Fill out all guest details");
        const problem = lineProblem();
        if (problem) return toast.error(problem);

        let comboPriceChanged = false;
        if (comboReq) {
            if (lines.some(({ item, m }) => item.itemType === "Rental" && m.advance > 0)) {
                return toast.error("Keep the scooty's advance at ₹0: the online payment can't go to rentals. Tap “Auto split” or move it to the stay / activity");
            }
            if (Math.round(totals.advance) !== comboPaid) {
                return toast.error(`The customer paid ${inr(comboPaid)} online. The advances add up to ${inr(totals.advance)}: make them total exactly ${inr(comboPaid)} (or tap “Auto split”)`);
            }
            if (Math.round(totals.total) !== Math.round(comboReq.total)) {
                const ok = window.confirm(`The package adds up to ${inr(totals.total)}, but the customer agreed to ${inr(comboReq.total)} for this combo.\n\nBook it at ${inr(totals.total)}? Tell the customer about the new price.`);
                if (!ok) return;
                comboPriceChanged = true;
            }
        }
        const payload = {
            guestDetails,
            customerId: linkedCustomer(guestCustomer, guestDetails)?.id || undefined,
            advancePayment,
            items: buildItems(),
            totalPrice: totals.total,
            comboBookingId: comboReq?.id || undefined,
            ...(comboPriceChanged && { comboPriceChanged: true }),
        };

        try {
            setIsSubmitting(true);
            const res = await axios.post(buildBackendUrl("/admin/custom-packages/book"), payload, {
                headers: adminAuthHeaders(),
                withCredentials: true
            });
            if (res.data.success) {
                toast.success(comboReq ? `Combo ${comboReq.code} confirmed as ${res.data.package?.bookingId || ""}. Guest and companies are notified.` : `Package ${res.data.package?.bookingId || ""} booked. Guests and companies are notified.`);
                if (comboReq) { window.location.assign("/admin/combos"); return; }
                setCart([]);
                setGuestDetails({ name: "", email: "", phone: "", notes: "" });
                setGuestCustomer(null);
                setAdvancePayment({ mode: "upi", reference: "" });
                setCheckoutStep(1);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to book package");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full bg-slate-50 lg:flex lg:h-screen lg:overflow-hidden">
            {/* Left Column: Inventory Selection */}
            <div className="flex flex-col pb-28 hide-scrollbar scroll-smooth lg:flex-1 lg:overflow-y-auto lg:border-r lg:border-slate-200 lg:pb-0">
                <div className="bg-white border-b border-slate-200 p-4 sm:p-6 lg:sticky lg:top-0 lg:z-10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <AdminMenuButton />
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{comboReq ? `Confirm combo ${comboReq.code}` : offerMode ? "Trip Offer Builder" : "Custom Package Builder"}</h1>
                                <p className="text-[13px] text-slate-500 mt-0.5 sm:mt-1 sm:text-sm">{comboReq ? "The linked parts are already in the package. Pick anything missing, check the slots, then confirm." : offerMode ? "Pick activities, stays and rides. Customers get it as a personal offer on TouristGo." : "Select items to compose a bundled suite for guests."}</p>
                            </div>
                        </div>
                        {/* A combo request is booked, never sent as a trip offer. */}
                        {!comboReq && (
                            <div className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm sm:flex sm:w-auto">
                                <button onClick={() => setOfferMode(false)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${!offerMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>Book now</button>
                                <button onClick={() => setOfferMode(true)} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${offerMode ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}><Gift className="h-4 w-4" />Send as trip offer</button>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg sm:flex sm:w-fit">
                            {[
                                { id: "all", label: "All" },
                                { id: "haridwar", label: "Haridwar" },
                                { id: "rishikesh", label: "Rishikesh" },
                            ].map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCity(c.id)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${selectedCity === c.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
                            <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <span className="text-xs text-slate-500">Start</span>
                                <input
                                    type="date"
                                    value={globalDates.startDate}
                                    onChange={(e) => setGlobalDates((p) => ({ ...p, startDate: e.target.value }))}
                                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 outline-none"
                                />
                            </label>
                            <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <span className="text-xs text-slate-500">End</span>
                                <input
                                    type="date"
                                    value={globalDates.endDate}
                                    onChange={(e) => setGlobalDates((p) => ({ ...p, endDate: e.target.value }))}
                                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 outline-none"
                                />
                            </label>
                        </div>

                        {activeTab === "rentals" && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500">Type</label>
                                <select
                                    value={vehicleCategory}
                                    onChange={(e) => setVehicleCategory(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 outline-none"
                                >
                                    <option value="all">All</option>
                                    <option value="bike">Bike</option>
                                    <option value="scooty">Scooty</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-3 bg-slate-100 p-1 rounded-lg sm:mt-6 sm:flex sm:w-fit">
                        {["hotels", "rentals", "activities"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-2 sm:px-5 text-sm font-medium rounded-md capitalize transition-colors ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-3 p-4 sm:gap-4 sm:p-6">
                    {loadingByType[activeTab] ? (
                        <div className="text-center text-slate-400 mt-10">Loading inventory...</div>
                    ) : (
                        inventory[activeTab]
                            .filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()))
                            .map((item, idx) => (
                                <InventoryCard
                                    key={idx}
                                    item={item}
                                    type={activeTab}
                                    city={selectedCity}
                                    globalDates={globalDates}
                                    apiRootUrl={apiRootUrl}
                                    onPlus={(specifics) => upsertCartItem(activeTab === 'hotels' ? 'Hotel' : activeTab === 'rentals' ? 'Rental' : 'Activity', item, specifics, +1)}
                                    onMinus={(specifics) => upsertCartItem(activeTab === 'hotels' ? 'Hotel' : activeTab === 'rentals' ? 'Rental' : 'Activity', item, specifics, -1)}
                                    getQty={(specifics) => getCartQty(activeTab === 'hotels' ? 'Hotel' : activeTab === 'rentals' ? 'Rental' : 'Activity', item, specifics)}
                                />
                            ))
                    )}
                </div>
            </div>

            {/* Phones / tablets: bottom bar that opens the package */}
            {!cartOpen && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:hidden">
                    <button onClick={() => setCartOpen(true)} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-white ${offerMode ? "bg-orange-500" : "bg-slate-900"}`}>
                        <span className="flex min-w-0 items-center gap-2.5">
                            <ShoppingBag className="h-5 w-5 shrink-0" />
                            <span className="truncate text-sm font-semibold">{offerMode ? "Your offer" : "Package"} · {cart.length} item{cart.length === 1 ? "" : "s"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">{inr(totals.total)} <ArrowRight className="h-4 w-4" /></span>
                    </button>
                </div>
            )}

            {/* Right Column: Cart & Checkout (full-screen sheet below lg) */}
            <div className={`${cartOpen ? "fixed inset-0 z-50 flex" : "hidden"} flex-col bg-white lg:relative lg:inset-auto lg:z-auto lg:flex lg:w-[420px] lg:shrink-0 lg:shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.1)] xl:w-[450px]`}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 lg:py-2">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{offerMode ? "Your offer" : "Package Contents"}</h2>
                        <p className="text-sm text-slate-500">{cart.length} items selected</p>
                    </div>
                    <button onClick={() => setCartOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 lg:hidden" aria-label="Back to items"><X className="h-4 w-4" /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-6">
                    {checkoutStep === 1 && comboReq && (
                        <ComboPanel
                            req={comboReq}
                            cart={cart}
                            totals={totals}
                            paid={comboPaid}
                            split={split}
                            pendingPart={pendingPart}
                            onFind={(p) => {
                                setPendingPart(p);
                                setActiveTab(p.itemType === "Hotel" ? "hotels" : p.itemType === "Rental" ? "rentals" : "activities");
                                setSearch(p.hint || "");
                                if (p.from) setGlobalDates({ startDate: p.from, endDate: p.to && p.to > p.from ? p.to : new Date(Date.parse(`${p.from}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) });
                                setCartOpen(false);
                                toast.message(`Add ${p.title}: tap “Add” on the right ${p.itemType === "Hotel" ? "room" : p.itemType === "Rental" ? "scooty" : "activity"}`);
                            }}
                            onRestore={(p) => setCart((prev) => (prev.some((c) => c.sectionId === p.sectionId) ? prev : [...prev, cartItemFromPlan(p)]))}
                            onReset={() => resetSplit()}
                        />
                    )}
                    {checkoutStep === 1 ? (
                        cart.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10 text-sm">Cart is empty. Select items to bundle.</div>
                        ) : (
                            lines.map(({ raw: cartItem, item: shown, m }) => (
                                <div key={cartItem.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative group hover:border-slate-300 transition-colors">
                                    <button onClick={() => removeFromCart(cartItem.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash className="w-4 h-4" />
                                    </button>

                                    <div className="mb-1 flex flex-wrap items-center gap-1.5 pr-6">
                                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{cartItem.itemType}</span>
                                        {comboReq && cartItem.comboPart && <span className="truncate rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Combo · {cartItem.comboPart}</span>}
                                    </div>
                                    <div className="font-medium text-slate-900 pr-6">{cartItem.name}</div>

                                    <div className="mt-4 space-y-3">
                                        {(cartItem.itemType === "Hotel" || cartItem.itemType === "Rental") && (
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">Check-in / Pick-up</label>
                                                    <input type="date" value={cartItem.checkIn} onChange={(e) => handleDateChange(cartItem.id, "checkIn", e.target.value)} className="w-full border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-slate-400" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">Check-out / Drop-off</label>
                                                    <input type="date" value={cartItem.checkOut} onChange={(e) => handleDateChange(cartItem.id, "checkOut", e.target.value)} className="w-full border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-slate-400" />
                                                </div>
                                            </div>
                                        )}

                                        {cartItem.itemType === "Activity" && (
                                            <ActivityFields item={cartItem} quoteState={quotes[quoteKey(cartItem)]} onChange={(patch) => updateItem(cartItem.id, patch)} />
                                        )}

                                        {cartItem.itemType === "Hotel" && (
                                            <div className="grid grid-cols-2 gap-2 text-sm mt-3 border-t border-slate-100 pt-3">
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1 font-medium text-slate-600">Adults</label>
                                                    <Stepper value={cartItem.adults || 1} min={1} onChange={(v) => updateItem(cartItem.id, { adults: v })} />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1 font-medium text-slate-600">Children</label>
                                                    <Stepper value={cartItem.children || 0} min={0} onChange={(v) => updateItem(cartItem.id, { children: v })} />
                                                </div>
                                            </div>
                                        )}

                                        <MoneyFields
                                            item={shown}
                                            quote={quoteOf(cartItem)}
                                            onChange={editMoney(cartItem, m)}
                                            combo={comboReq ? { manual: Boolean(cartItem.comboManual), onAuto: () => resetSplit(cartItem.id), lockAdvance: cartItem.itemType === "Rental" } : null}
                                        />
                                    </div>
                                </div>
                            ))
                        )
                    ) : offerMode ? (
                        <OfferComposer
                            recipients={recipients}
                            setRecipients={setRecipients}
                            totals={{ ...totals, listTotal: lines.reduce((s, { m }) => s + Math.max(amt(m.listPrice ?? m.price) * m.qty * m.units, m.subtotal), 0) }}
                            itemNames={cart.map((c) => c.name)}
                            validate={lineProblem}
                            buildItems={buildItems}
                            onSent={() => { setCart([]); setCheckoutStep(1); }}
                        />
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm sm:p-6">
                            <h3 className="font-semibold text-slate-900 mb-4 text-lg">Guest Details</h3>
                            <div className="space-y-4">
                                <GuestFields value={guestDetails} onChange={setGuestDetails} picked={guestCustomer} onPick={setGuestCustomer} />
                                {comboReq && (() => {
                                    const placed = Math.round(totals.advance);
                                    const ok = comboPaid === placed;
                                    return (
                                        <div className={`rounded-lg border p-3 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                                            <p className="font-semibold text-slate-900">Combo {comboReq.code}: {comboReq.combo.title}</p>
                                            <p className="mt-0.5 text-xs text-slate-600">{comboReq.persons} people · the customer agreed to {inr(comboReq.total)} in total and paid {inr(comboPaid)} online (Razorpay).</p>
                                            <p className={`mt-1.5 text-xs font-bold ${ok ? "text-emerald-700" : "text-rose-700"}`}>
                                                {ok ? `Advance placed: ${inr(placed)} of ${inr(comboPaid)} ✓` : `Advance placed: ${inr(placed)} of ${inr(comboPaid)}. Go back and tap “Auto split”, or set the advances so they total ${inr(comboPaid)}.`}
                                            </p>
                                            {Math.round(totals.total) !== Math.round(comboReq.total) && <p className="mt-1 text-xs font-semibold text-amber-700">Package total is {inr(totals.total)}, the combo price was {inr(comboReq.total)}. You&apos;ll be asked to confirm the new price.</p>}
                                            <ul className="mt-2 space-y-0.5 border-t border-emerald-200/70 pt-2 text-xs text-slate-700">
                                                {lines.map(({ raw, item, m }) => (
                                                    <li key={raw.id} className="flex justify-between gap-3">
                                                        <span className="min-w-0 truncate">{item.name}</span>
                                                        <span className="shrink-0 font-semibold">pays {inr(m.balance)} at the {item.itemType === "Hotel" ? "hotel" : item.itemType === "Rental" ? "hub" : "company"}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}
                                {totals.advance > 0 && !comboReq && (
                                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <div className="text-xs font-semibold text-amber-800 mb-2">Advance {inr(totals.advance)} received by YatriMap</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select value={advancePayment.mode} onChange={e => setAdvancePayment({ ...advancePayment, mode: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400">
                                                <option value="upi">UPI</option>
                                                <option value="cash">Cash</option>
                                                <option value="bank">Bank transfer</option>
                                                <option value="card">Card</option>
                                                <option value="online">Payment link</option>
                                                <option value="other">Other</option>
                                            </select>
                                            <input type="text" placeholder="Txn / UTR (optional)" value={advancePayment.reference} onChange={e => setAdvancePayment({ ...advancePayment, reference: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400" />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-slate-500 font-medium mb-1 block">Internal Notes</label>
                                    <textarea placeholder="Any special requests or admin notes..." value={guestDetails.notes} onChange={e => setGuestDetails({ ...guestDetails, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 min-h-[100px] outline-none focus:border-slate-400 focus:bg-white transition-colors resize-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="border-t border-slate-200 bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                        <div className="mb-4 space-y-1 text-sm">
                            {totals.discount > 0 && (
                                <div className="flex justify-between text-slate-500"><span>Before discount</span><span className="line-through">{inr(totals.subtotal)}</span></div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-500 text-sm uppercase tracking-wider">Total Package Value</span>
                                <span className="font-bold text-slate-900 text-2xl">{inr(getTotalPrice())}</span>
                            </div>
                            <div className="flex justify-between text-amber-700 font-semibold"><span>Advance to YatriMap now</span><span>{inr(totals.advance)}</span></div>
                            <div className="flex justify-between text-slate-600"><span>Guest pays at hotel / hub / company</span><span>{inr(totals.balance)}</span></div>
                        </div>

                        {checkoutStep === 1 ? (
                            <button
                                onClick={() => {
                                    // Book now for a customer picked on the Customers page: their details are already known.
                                    const who = recipients[0];
                                    if (!offerMode && who && !guestDetails.name && !guestDetails.email && !guestDetails.phone) {
                                        setGuestCustomer(who);
                                        setGuestDetails((g) => ({ ...g, ...guestFrom(who) }));
                                    }
                                    setCheckoutStep(2);
                                }}
                                className="w-full bg-slate-900 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                {offerMode ? "Next: who gets it" : "Next Step"} <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCheckoutStep(1)}
                                    className={`px-4 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors ${offerMode ? "flex-1" : ""}`}
                                >
                                    {offerMode ? "Back to items" : "Back"}
                                </button>
                                {!offerMode && <button
                                    disabled={isSubmitting}
                                    onClick={submitPackage}
                                    className="flex-1 bg-slate-900 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? "Generating..." : "Generate Booking"}
                                    {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                                </button>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const QtyButton = ({ qty, onPlus, onMinus, disabledPlus, disabledMinus }) => {
    if (qty > 0) {
        return (
            <div className="inline-flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                <button
                    onClick={onMinus}
                    disabled={disabledMinus}
                    className="w-8 h-8 rounded-md bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                    -
                </button>
                <span className="min-w-6 text-center font-semibold text-slate-900">{qty}</span>
                <button
                    onClick={onPlus}
                    disabled={disabledPlus}
                    className="w-8 h-8 rounded-md bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                    +
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={onPlus}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-medium transition-colors"
        >
            <Plus className="w-4 h-4" /> Add
        </button>
    );
};

const getAvailableRoomsForSelectedDates = (room, startDate, endDate) => {
    const r = room || {};
    const checkIn = new Date(startDate);
    const checkOut = new Date(endDate);
    const availability = r.availability;

    let roomAvailability = 0;

    if (Array.isArray(availability) && availability.length > 0) {
        // Check if explicitly blocked for the required period
        const isBlocked = availability.some((period) => {
            const p = period || {};
            const start = new Date(String(p.startDate));
            const end = new Date(String(p.endDate));
            return p.isAvailable === false && checkIn <= end && checkOut >= start;
        });

        if (isBlocked) return 0;

        const matchingAvailabilities = availability.filter((period) => {
            const p = period || {};
            const start = new Date(String(p.startDate));
            const end = new Date(String(p.endDate));
            return p.isAvailable === true && checkIn <= end && checkOut >= start;
        });

        if (matchingAvailabilities.length > 0) {
            // Calculate availableRooms resolving from explicit numbers or defaulting appropriately.
            let validMatches = matchingAvailabilities.map(p => {
                const availableRooms = (p || {}).availableRooms;
                return typeof availableRooms === "number" ? availableRooms : Infinity;
            }).filter(val => val !== Infinity);

            if (validMatches.length > 0) {
                roomAvailability = Math.min(...validMatches);
            } else {
                const min = r.minAvailableForPeriod;
                roomAvailability = typeof min === "number" ? min : 0;
            }
        } else {
            const min = r.minAvailableForPeriod;
            roomAvailability = typeof min === "number" ? min : 0;
        }
    } else {
        const min = r.minAvailableForPeriod;
        roomAvailability = typeof min === "number" ? min : 0;
    }

    // Explicit fallback enforcing qrRoomStatus availability limit (exactly as done in UI components)
    const qrRoomStatus = r.qrRoomStatus;
    if (qrRoomStatus && typeof qrRoomStatus.available === "number") {
        roomAvailability = Math.min(roomAvailability, qrRoomStatus.available);
    }

    return roomAvailability > 0 ? roomAvailability : 0;
};

const InventoryCard = ({ item, type, onPlus, onMinus, getQty, city, globalDates, apiRootUrl }) => {
    // Handling rendering specifics based on backend schema structures
    if (type === "hotels") {
        return (
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-slate-300 transition-colors">
                <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{item.name}</h3>
                    <p className="text-slate-500">{item.address?.fullAddress || item.address?.city}</p>
                    <div className="mt-2 text-xs text-slate-400 uppercase tracking-widest">{item.rooms?.length || 0} Room Types</div>
                    <div className="mt-3 flex flex-col gap-2">
                        {item.rooms?.map((r, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-lg">
                                <div className="pr-3">
                                    <div className="font-medium text-slate-900">{r.name || r.type}</div>
                                    <div className="text-xs text-slate-500">
                                        ₹{r.averageNightlyPrice || r.price}
                                        {globalDates.startDate && globalDates.endDate && (
                                            <>
                                                {" • "}
                                                <span className={getAvailableRoomsForSelectedDates(r, globalDates.startDate, globalDates.endDate) > 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                                                    {getAvailableRoomsForSelectedDates(r, globalDates.startDate, globalDates.endDate) > 0
                                                        ? `${getAvailableRoomsForSelectedDates(r, globalDates.startDate, globalDates.endDate)} left`
                                                        : "Not available"}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <QtyButton
                                    qty={getQty({ roomId: r._id, hotelId: item.propertyId || item._id })}
                                    onPlus={async () => {
                                        if (!globalDates.startDate || !globalDates.endDate) return toast.error("Select start/end dates first");

                                        const available = getAvailableRoomsForSelectedDates(r, globalDates.startDate, globalDates.endDate);
                                        const already = getQty({ roomId: r._id, hotelId: item.propertyId || item._id });
                                        if (available <= already) return toast.error("Room not available for selected dates");

                                        onPlus({ roomId: r._id, hotelId: item.propertyId || item._id, price: r.averageNightlyPrice || r.price, name: `${item.name} - ${r.name || r.type}` });
                                    }}
                                    onMinus={() => onMinus({ roomId: r._id, hotelId: item.propertyId || item._id })}
                                    disabledPlus={false}
                                    disabledMinus={false}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (type === "rentals") {
        const title = `${item.vehicleCompanyName || item.vehicleModelId?.vehicleCompanyName || ""} ${item.vehicleModalName || item.vehicleModelId?.vehicleModalName || ""}`.trim() || "Unknown Vehicle";
        const qty = getQty({ hubId: getNestedId(item.hubId), vehicleModelId: getNestedId(item.vehicleModelId) });
        return (
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4 md:items-center hover:border-slate-300 transition-colors shadow-sm">
                <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{title}</h3>
                    <p className="text-slate-500">Hub: {item.hubId?.name || item.hub?.name} ({item.hubId?.address?.city || item.hub?.address?.city})</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                        Available: {typeof item.availableQuantity === "number" ? item.availableQuantity : item.quantity}
                        {" / "}
                        Total: {typeof item.quantity === "number" ? item.quantity : 0}
                    </p>
                </div>
                <div className="flex flex-col md:items-end gap-3 text-left md:text-right">
                    <span className="font-bold text-lg text-slate-900">₹{item.pricing?.rentalPrice || item.totalPrice || 0}/day</span>
                    <QtyButton
                        qty={qty}
                        onPlus={() => {
                            if (!globalDates.startDate || !globalDates.endDate) return toast.error("Select start/end dates first");

                            const available = typeof item.availableQuantity === "number" ? item.availableQuantity : item.quantity;
                            if (qty >= available) return toast.error("Max quantity reached or not available");

                            onPlus({
                                hubId: getNestedId(item.hubId) || getNestedId(item.hub?._id),
                                vehicleModelId: getNestedId(item.vehicleModelId) || getNestedId(item._id),
                                price: item.pricing?.rentalPrice || item.totalPrice || 0,
                                name: `${title} (${item.hubId?.name || item.hub?.name})`,
                            });
                        }}
                        onMinus={() => onMinus({ hubId: getNestedId(item.hubId) || getNestedId(item.hub?._id), vehicleModelId: getNestedId(item.vehicleModelId) || getNestedId(item._id) })}
                        disabledPlus={false}
                        disabledMinus={false}
                    />
                </div>
            </div>
        );
    }

    if (type === "activities") {
        return (
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors shadow-sm flex flex-col">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div>
                        <h3 className="font-semibold text-slate-900 text-lg">{item.activityDetails?.name || "Unknown"}</h3>
                        <p className="text-slate-500 text-sm mt-1">{item.companyInfo?.name}</p>
                        <span className="inline-block mt-2 text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md uppercase">{item.activityDetails?.category}</span>
                    </div>
                    {(!item.variations || item.variations.length === 0) && (
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900 text-lg">₹{item.basePricing?.price || 0}</span>
                            <QtyButton
                                qty={getQty({})}
                                onPlus={() => onPlus({ price: item.basePricing?.price || 0 })}
                                onMinus={() => onMinus({})}
                                disabledPlus={false}
                                disabledMinus={false}
                            />
                        </div>
                    )}
                </div>
                {item.variations && item.variations.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
                        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Variations</span>
                        {item.variations.map((v, i) => (
                            <div key={i} className="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm hover:border-slate-200 transition-colors gap-3">
                                <span className="font-medium text-slate-800">{v.name}</span>
                                <div className="flex items-center gap-4 self-end md:self-auto">
                                    <span className="font-bold text-slate-900 text-base">₹{v.basePrice}</span>
                                    <QtyButton
                                        qty={getQty({ variationId: v._id || i.toString() })}
                                        onPlus={() => onPlus({ price: v.basePrice, name: `${item.activityDetails?.name} - ${v.name}`, variationId: v._id || i.toString() })}
                                        onMinus={() => onMinus({ variationId: v._id || i.toString() })}
                                        disabledPlus={false}
                                        disabledMinus={false}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return null;
}

const Stepper = ({ value, min = 0, onChange }) => (
    <div className="flex items-center">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="bg-slate-100 px-2.5 py-1 rounded-l border border-slate-200 hover:bg-slate-200 transition-colors"><Minus className="w-3 h-3" /></button>
        <div className="w-10 text-center border-y border-slate-200 py-1 bg-white">{value}</div>
        <button type="button" onClick={() => onChange(value + 1)} className="bg-slate-100 px-2.5 py-1 rounded-r border border-slate-200 hover:bg-slate-200 transition-colors"><Plus className="w-3 h-3" /></button>
    </div>
);

const minutesLabel = (m) => {
    if (m == null) return "";
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "AM" : "PM"}`;
};

/** Date, slot and count for an activity line, from that day's real slots (same as customers see). */
const ActivityFields = ({ item, quoteState, onChange }) => {
    const quote = quoteState?.data || null;
    const unit = quote?.unit || { mode: "persons", label: "Persons" };
    return (
        <div className="space-y-3 text-sm">
            <div>
                <label className="text-xs text-slate-500 block mb-1">Activity Date</label>
                <input type="date" min={todayKey()} value={item.activityDate} onChange={(e) => onChange({ activityDate: e.target.value, activityTime: "" })} className="w-full border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-slate-400" />
            </div>

            {quoteState?.loading && <div className="text-xs text-slate-400">Loading slots…</div>}
            {quoteState?.error && <div className="flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {quoteState.error}</div>}
            {quote?.pastDate && <div className="flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> This date has passed</div>}
            {quote?.closed && (
                <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Closed on this date{quote.closedReason ? ` · ${quote.closedReason}` : ""}
                </div>
            )}

            {quote && !quote.closed && quote.slots.length > 0 && (
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Slot</label>
                    <select value={item.activityTime || ""} onChange={(e) => onChange({ activityTime: e.target.value })} className={`w-full border rounded-md px-2 py-1.5 outline-none bg-white ${item.activityTime ? "border-slate-200" : "border-amber-300"}`}>
                        <option value="">Pick a slot</option>
                        {quote.slots.map((sl) => (
                            <option key={sl.label} value={sl.label}>
                                {sl.label}{sl.start != null ? ` · ${minutesLabel(sl.start)}` : ""}{sl.price != null ? ` · ₹${sl.price}` : ""}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {quote && !quote.closed && quote.slots.length === 0 && (
                <div className="text-xs text-slate-400">No fixed slots on this date</div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <div>
                    <label className="text-xs text-slate-600 block mb-1 font-medium">{unit.label}</label>
                    <Stepper value={Math.max(1, amt(item.quantity))} min={1} onChange={(v) => onChange({ quantity: v })} />
                </div>
                {unit.mode === "group" && (
                    <div>
                        <label className="text-xs text-slate-600 block mb-1 font-medium">People{unit.groupSize ? ` (up to ${unit.groupSize} each)` : ""}</label>
                        <Stepper value={item.adults || 1} min={1} onChange={(v) => onChange({ adults: v, children: 0 })} />
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Price, discount and advance for any line, with what the guest pays where.
 * `combo` (combo requests): { manual, onAuto, lockAdvance } — numbers come from the combo split
 * until the team edits one; a rental's advance stays ₹0 (no online payment for rentals).
 */
const MoneyFields = ({ item, quote, onChange, combo = null }) => {
    const m = lineOf(item, quote);
    const per = item.itemType === "Hotel" ? "/ room / night" : item.itemType === "Rental" ? "/ vehicle / day" : `/ ${(quote?.unit?.label || "person").toLowerCase().replace(/s$/, "")}`;
    const field = "w-full border border-slate-200 rounded-md px-2 py-1 text-right font-semibold text-slate-900 outline-none focus:border-slate-400";
    // What the company normally keeps on an online booking: price minus YatriMap's usual advance.
    const usualShare = item.itemType === "Activity" && quote ? Math.max(0, amt(m.listPrice) * m.qty - standardAdvance(item, quote)) : null;
    return (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-sm">
            {combo && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    {combo.manual
                        ? <span className="font-semibold text-violet-700">Edited by hand: the other lines balance the combo</span>
                        : <span className="font-semibold text-emerald-700">Auto: share of the combo price and the paid advance</span>}
                    {combo.manual && <button type="button" onClick={combo.onAuto} className="rounded-md border border-slate-200 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50">↺ Auto split</button>}
                </div>
            )}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Price {per}</label>
                    <input type="number" min="0" value={m.price} onChange={(e) => onChange({ price: e.target.value, priceTouched: true })} className={field} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Discount (₹)</label>
                    <input type="number" min="0" value={item.discount ?? ""} placeholder="0" onChange={(e) => onChange({ discount: e.target.value })} className={`${field} ${m.discountTooBig ? "border-red-400" : ""}`} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Advance (₹)</label>
                    <input type="number" min="0" disabled={Boolean(combo?.lockAdvance)} title={combo?.lockAdvance ? "The online payment can't go to rentals" : undefined} value={item.advance === undefined ? m.advance : item.advance} onChange={(e) => onChange({ advance: e.target.value })} className={`${field} ${m.advanceTooBig ? "border-red-400" : ""} disabled:bg-slate-50 disabled:text-slate-400`} />
                </div>
            </div>
            {combo?.lockAdvance && <p className="text-[11px] text-slate-500">Advance stays ₹0: the customer&apos;s online payment can&apos;t go to a rental. They pay the scooty at the hub.</p>}
            {item.itemType === "Activity" && item.priceTouched && m.listPrice != null && amt(item.price) !== m.listPrice && (
                <button type="button" onClick={() => onChange({ price: m.listPrice, priceTouched: false })} className="text-[11px] font-medium text-slate-500 underline">
                    Use this slot&apos;s price ₹{m.listPrice}
                </button>
            )}
            <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-500">
                    <span>{inr(m.price)} × {m.qty}{item.itemType !== "Activity" ? ` × ${m.units} ${unitWord(item, m.units)}` : ""}</span>
                    <span>{inr(m.subtotal)}</span>
                </div>
                {m.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{inr(m.discount)}</span></div>}
                <div className="flex justify-between font-semibold text-slate-900"><span>Total</span><span>{inr(m.total)}</span></div>
                <div className="flex justify-between text-amber-700"><span>Advance to YatriMap now</span><span>{inr(m.advance)}</span></div>
                <div className="flex justify-between text-slate-700"><span>Pay at {item.itemType === "Hotel" ? "hotel" : item.itemType === "Rental" ? "hub" : "company"}</span><span>{inr(m.balance)}</span></div>
                {usualShare != null && m.balance < usualShare && (
                    <div className="pt-1 text-[11px] text-amber-700">Company collects {inr(usualShare - m.balance)} less than its usual share ({inr(usualShare)}).</div>
                )}
            </div>
        </div>
    );
};

const dayText = (key) => (key ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");

/**
 * Combo request summary above the package: the price the customer agreed to and paid, whether the
 * lines add up to it, and every part of the combo: in the package, still to pick, or not booked here.
 */
const ComboPanel = ({ req, cart, totals, paid, split, pendingPart, onFind, onRestore, onReset }) => {
    const priceOk = Math.round(totals.total) === Math.round(req.total);
    const advanceOk = Math.round(totals.advance) === paid;
    const manual = cart.some((c) => c.comboManual);
    const start = new Date(req.startDate).toISOString().slice(0, 10);
    const stat = (labelText, value, tone = "text-slate-900") => (
        <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-amber-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{labelText}</p>
            <p className={`text-sm font-bold ${tone}`}>{value}</p>
        </div>
    );
    return (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Combo request {req.code}</p>
                <p className="font-semibold text-slate-900">{req.combo.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{req.guest.name} · {req.persons} {req.persons === 1 ? "person" : "people"} · starts {dayText(start)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                {stat("Combo price", inr(req.total))}
                {stat("Paid online", inr(paid), "text-emerald-700")}
                {stat("To collect", inr(Math.max(0, req.total - paid)), "text-amber-700")}
            </div>
            <div className="space-y-1 text-xs">
                <p className={`font-semibold ${priceOk ? "text-emerald-700" : "text-rose-700"}`}>
                    {priceOk ? `✓ The items add up to the combo price, ${inr(req.total)}` : `The items add up to ${inr(totals.total)}; the combo price is ${inr(req.total)}`}
                </p>
                <p className={`font-semibold ${advanceOk ? "text-emerald-700" : "text-rose-700"}`}>
                    {advanceOk ? `✓ The paid ${inr(paid)} is placed on the stay and activities` : `Advance placed: ${inr(totals.advance)} of the ${inr(paid)} paid`}
                </p>
                {split?.advanceLeft > 0 && <p className="text-rose-700">{inr(split.advanceLeft)} of the paid advance has nowhere to go. Add the stay or an activity: a rental can&apos;t take it.</p>}
                {(split?.overPrice || split?.overAdvance) && <p className="text-rose-700">The lines you edited by hand are already more than the combo allows. Tap “Auto split”.</p>}
                {manual && (
                    <button type="button" onClick={onReset} className="mt-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100">↺ Auto split everything again</button>
                )}
            </div>
            <ul className="space-y-1.5 border-t border-amber-200 pt-2.5">
                {(req.plan || []).map((p) => {
                    const emoji = PART_EMOJI[p.kind] || "✨";
                    if (!p.itemType) {
                        return (
                            <li key={p.sectionId} className="flex items-start gap-2 text-xs text-slate-500">
                                <span>{emoji}</span><span className="min-w-0"><span className="font-semibold text-slate-700">{p.title}</span> · not booked here, give it by hand</span>
                            </li>
                        );
                    }
                    const inCart = cart.find((c) => c.sectionId === p.sectionId);
                    if (inCart) {
                        return (
                            <li key={p.sectionId} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="text-emerald-600">✓</span>
                                <span className="min-w-0">{emoji} <span className="font-semibold">{p.title}</span> → {inCart.name}{p.day > 1 ? ` · day ${p.day}` : ""}</span>
                            </li>
                        );
                    }
                    const adding = pendingPart?.sectionId === p.sectionId;
                    return (
                        <li key={p.sectionId} className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-xs ring-1 ring-amber-200">
                            <span className="min-w-0">
                                <span className="text-amber-600">⚠</span> {emoji} <span className="font-semibold text-slate-900">{p.title}</span>
                                <span className="block text-slate-500">{p.ready ? "Removed from the package" : p.todo}{p.from ? ` · ${dayText(p.from)}` : ""}</span>
                            </span>
                            <button type="button" onClick={() => (p.ready ? onRestore(p) : onFind(p))} className={`shrink-0 rounded-md px-2.5 py-1 font-bold ${adding ? "bg-amber-200 text-amber-900" : "bg-amber-500 text-white hover:bg-amber-600"}`}>
                                {p.ready ? "Add back" : adding ? "Pick it on the left" : "Find it"}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
