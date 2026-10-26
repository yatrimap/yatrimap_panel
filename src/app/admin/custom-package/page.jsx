"use client";

import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash, Search, CheckCircle2, ArrowRight, AlertTriangle, Minus } from "lucide-react";
import { buildBackendUrl, getApiV1BaseUrl, adminAuthHeaders } from "@/lib/api-url";

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
    const [advancePayment, setAdvancePayment] = useState({ mode: "upi", reference: "" });
    // Activity slots / prices / usual advance for the chosen date, per cart line.
    const [quotes, setQuotes] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState(1);

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
                .then((res) => setQuotes((q) => ({ ...q, [key]: { data: res.data.data } })))
                .catch((err) => setQuotes((q) => ({ ...q, [key]: { error: err.response?.data?.message || "Could not load slots for this date" } })));
        });
    }, [cart, quotes]);

    const quoteOf = (item) => quotes[quoteKey(item)]?.data || null;
    const lines = cart.map((item) => ({ item, quote: quoteOf(item), m: lineOf(item, quoteOf(item)) }));
    const totals = lines.reduce(
        (acc, { m }) => ({ subtotal: acc.subtotal + m.subtotal, discount: acc.discount + m.discount, total: acc.total + m.total, advance: acc.advance + m.advance, balance: acc.balance + m.balance }),
        { subtotal: 0, discount: 0, total: 0, advance: 0, balance: 0 }
    );
    const getTotalPrice = () => totals.total;

    const submitPackage = async () => {
        if (cart.length === 0) return toast.error("Cart is empty");
        if (!guestDetails.name || !guestDetails.email || !guestDetails.phone) return toast.error("Fill out all guest details");

        // Check every line the way the server will.
        for (const { item, quote, m } of lines) {
            if (item.itemType === "Hotel" || item.itemType === "Rental") {
                if (!item.checkIn || !item.checkOut) return toast.error(`Provide Check-In and Check-Out for ${item.name}`);
                if (daysBetween(item.checkIn, item.checkOut) < 1) return toast.error(`Check-out must be after check-in for ${item.name}`);
            }
            if (item.itemType === "Activity") {
                if (!item.activityDate) return toast.error(`Provide Activity Date for ${item.name}`);
                const q = quotes[quoteKey(item)];
                if (!q || q.loading) return toast.error(`Loading slots for ${item.name}, try again in a moment`);
                if (q.error) return toast.error(`${item.name}: ${q.error}`);
                if (quote.pastDate) return toast.error(`${item.name}: that date has passed`);
                if (quote.closed) return toast.error(`${item.name} is closed on ${item.activityDate}${quote.closedReason ? ` (${quote.closedReason})` : ""}`);
                if (quote.slots.length && !quote.slots.some((sl) => sl.label === item.activityTime)) return toast.error(`Pick a slot for ${item.name}`);
            }
            if (m.discountTooBig) return toast.error(`Discount for ${item.name} is more than its price`);
            if (m.advanceTooBig) return toast.error(`Advance for ${item.name} is more than its total`);
        }

        const payload = {
            guestDetails,
            advancePayment,
            items: lines.map(({ item, m }) => ({
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
            })),
            totalPrice: totals.total
        };

        try {
            setIsSubmitting(true);
            const res = await axios.post(buildBackendUrl("/admin/custom-packages/book"), payload, {
                headers: adminAuthHeaders(),
                withCredentials: true
            });
            if (res.data.success) {
                toast.success(`Package ${res.data.package?.bookingId || ""} booked. Guests and companies are notified.`);
                setCart([]);
                setGuestDetails({ name: "", email: "", phone: "", notes: "" });
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
        <div className="flex h-[calc(100vh-5px)] w-full overflow-hidden bg-slate-50 relative">
            {/* Left Column: Inventory Selection */}
            <div className="flex-1 flex flex-col overflow-y-auto border-r border-slate-200 hide-scrollbar scroll-smooth">
                <div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10">
                    <h1 className="text-2xl font-bold text-slate-900">Custom Package Builder</h1>
                    <p className="text-sm text-slate-500 mt-1">Select items to compose a bundled suite for guests.</p>

                    <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
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

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500">Start</label>
                            <input
                                type="date"
                                value={globalDates.startDate}
                                onChange={(e) => setGlobalDates((p) => ({ ...p, startDate: e.target.value }))}
                                className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500">End</label>
                            <input
                                type="date"
                                value={globalDates.endDate}
                                onChange={(e) => setGlobalDates((p) => ({ ...p, endDate: e.target.value }))}
                                className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 outline-none"
                            />
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

                    <div className="flex bg-slate-100 p-1 mt-6 rounded-lg w-fit">
                        {["hotels", "rentals", "activities"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 text-sm font-medium rounded-md capitalize transition-colors ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
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

                <div className="p-6 grid gap-4 overflow-y-auto">
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

            {/* Right Column: Cart & Checkout */}
            <div className="w-[420px] lg:w-[450px] bg-white flex flex-col relative shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.1)]">
                <div className="p-6 py-2 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Package Contents</h2>
                    <p className="text-sm text-slate-500">{cart.length} items selected</p>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-4">
                    {checkoutStep === 1 ? (
                        cart.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10 text-sm">Cart is empty. Select items to bundle.</div>
                        ) : (
                            cart.map((cartItem) => (
                                <div key={cartItem.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative group hover:border-slate-300 transition-colors">
                                    <button onClick={() => removeFromCart(cartItem.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash className="w-4 h-4" />
                                    </button>

                                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">{cartItem.itemType}</div>
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

                                        <MoneyFields item={cartItem} quote={quoteOf(cartItem)} onChange={(patch) => updateItem(cartItem.id, patch)} />
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="font-semibold text-slate-900 mb-4 text-lg">Guest Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-500 font-medium mb-1 block">Full Name</label>
                                    <input type="text" placeholder="E.g. John Doe" value={guestDetails.name} onChange={e => setGuestDetails({ ...guestDetails, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 focus:bg-white transition-colors" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium mb-1 block">Email</label>
                                        <input type="email" placeholder="john@example.com" value={guestDetails.email} onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 focus:bg-white transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium mb-1 block">Phone</label>
                                        <input type="text" placeholder="+91 9876543210" value={guestDetails.phone} onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 focus:bg-white transition-colors" />
                                    </div>
                                </div>
                                {totals.advance > 0 && (
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
                    <div className="p-6 py-4 border-t border-slate-200 bg-white">
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
                                onClick={() => setCheckoutStep(2)}
                                className="w-full bg-slate-900 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                Next Step <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCheckoutStep(1)}
                                    className="px-4 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    disabled={isSubmitting}
                                    onClick={submitPackage}
                                    className="flex-1 bg-slate-900 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? "Generating..." : "Generate Booking"}
                                    {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                                </button>
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

/** Price, discount and advance for any line, with what the guest pays where. */
const MoneyFields = ({ item, quote, onChange }) => {
    const m = lineOf(item, quote);
    const per = item.itemType === "Hotel" ? "/ room / night" : item.itemType === "Rental" ? "/ vehicle / day" : `/ ${(quote?.unit?.label || "person").toLowerCase().replace(/s$/, "")}`;
    const field = "w-full border border-slate-200 rounded-md px-2 py-1 text-right font-semibold text-slate-900 outline-none focus:border-slate-400";
    // What the company normally keeps on an online booking: price minus YatriMap's usual advance.
    const usualShare = item.itemType === "Activity" && quote ? Math.max(0, amt(m.listPrice) * m.qty - standardAdvance(item, quote)) : null;
    return (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-sm">
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
                    <input type="number" min="0" value={item.advance === undefined ? m.advance : item.advance} onChange={(e) => onChange({ advance: e.target.value })} className={`${field} ${m.advanceTooBig ? "border-red-400" : ""}`} />
                </div>
            </div>
            {item.itemType === "Activity" && item.priceTouched && m.listPrice != null && amt(item.price) !== m.listPrice && (
                <button type="button" onClick={() => onChange({ price: m.listPrice, priceTouched: false })} className="text-[11px] font-medium text-slate-500 underline">
                    Use this slot's price ₹{m.listPrice}
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
