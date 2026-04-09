"use client";

import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash, Search, CheckCircle2 } from "lucide-react";

export default function CustomPackageBuilder() {
    const [activeTab, setActiveTab] = useState("hotels");
    const [inventory, setInventory] = useState({ hotels: [], rentals: [], activities: [] });
    const [loadingByType, setLoadingByType] = useState({ hotels: true, rentals: true, activities: true });
    const [search, setSearch] = useState("");
    const [selectedCity, setSelectedCity] = useState("all");
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const apiV1BaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
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

            const params = new URLSearchParams({
                type,
                ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                ...(type === "rentals" ? { vehicleCategory } : {}),
            });
            const res = await axios.get(`${apiV1BaseUrl}/admin/custom-packages/inventory?${params.toString()}`, { withCredentials: true });
            if (res.data.success) setInventory(prev => ({ ...prev, [type]: res.data[type] || [] }));
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
        } finally {
            setLoadingByType(prev => ({ ...prev, [type]: false }));
        }
    };

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

    const getCartKey = (itemType, item, specifics) => {
        const i = item || {};
        const s = specifics || {};
        const itemId = getNestedId(i._id);
        if (itemType === "Hotel") return `Hotel:${itemId}:${getNestedId(s.roomId)}`;
        if (itemType === "Rental") {
            const hubId = getNestedId(s.hubId) || getNestedId(i.hubId) || getNestedId(i.hub?._id);
            const vehicleModelId = getNestedId(s.vehicleModelId) || getNestedId(i.vehicleModelId);
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

    const removeFromCart = (cartId) => setCart(cart.filter(item => item.id !== cartId));

    const handlePriceChange = (cartId, newPrice) => {
        setCart(cart.map(item => item.id === cartId ? { ...item, price: Number(newPrice) } : item));
    };

    const handleDateChange = (cartId, field, value) => {
        setCart(cart.map(item => item.id === cartId ? { ...item, [field]: value } : item));
    };

    const getTotalPrice = () => {
        return cart.reduce((total, item) => total + (Number(item.price) * item.quantity), 0);
    };

    const submitPackage = async () => {
        if (cart.length === 0) return toast.error("Cart is empty");
        if (!guestDetails.name || !guestDetails.email || !guestDetails.phone) return toast.error("Fill out all guest details");

        // Validate dates
        for (const item of cart) {
            if (item.itemType === "Hotel" || item.itemType === "Rental") {
                if (!item.checkIn || !item.checkOut) return toast.error(`Provide Check-In and Check-Out for ${item.name}`);
            }
            if (item.itemType === "Activity" && !item.activityDate) {
                return toast.error(`Provide Activity Date for ${item.name}`);
            }
        }

        const payload = {
            guestDetails,
            items: cart.map(item => ({
                itemType: item.itemType,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                adults: item.adults || 1,
                children: item.children || 0,
                hotelId: item.itemType === "Hotel" ? item.coreItem._id : undefined,
                roomId: item.itemType === "Hotel" ? item.roomId : undefined,
                hubId: item.itemType === "Rental" ? item.coreItem.hubId?._id : undefined,
                vehicleModelId: item.itemType === "Rental" ? item.coreItem.vehicleModelId?._id : undefined,
                activityId: item.itemType === "Activity" ? item.coreItem._id : undefined,
                checkIn: item.checkIn || undefined,
                checkOut: item.checkOut || undefined,
                activityDate: item.activityDate || undefined
            })),
            totalPrice: getTotalPrice()
        };

        try {
            setIsSubmitting(true);
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
            const res = await axios.post(`${baseUrl}/admin/custom-packages/book`, payload, {
                withCredentials: true
            });
            if (res.data.success) {
                toast.success("Custom Package Booked successfully!");
                setCart([]);
                setGuestDetails({ name: "", email: "", phone: "", notes: "" });
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to book package");
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
                    {cart.length === 0 ? (
                        <div className="text-center text-slate-400 mt-10 text-sm">Cart is empty. Select items to bundle.</div>
                    ) : (
                        cart.map((cartItem) => (
                            <div key={cartItem.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative group">
                                <button onClick={() => removeFromCart(cartItem.id)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors">
                                    <Trash className="w-4 h-4" />
                                </button>

                                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{cartItem.itemType}</div>
                                <div className="font-medium text-slate-900 mt-1 pr-6">{cartItem.name}</div>

                                <div className="mt-4 space-y-3">
                                    {(cartItem.itemType === "Hotel" || cartItem.itemType === "Rental") && (
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Check-in / Pick-up</label>
                                                <input type="date" value={cartItem.checkIn} onChange={(e) => handleDateChange(cartItem.id, "checkIn", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Check-out / Drop-off</label>
                                                <input type="date" value={cartItem.checkOut} onChange={(e) => handleDateChange(cartItem.id, "checkOut", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 outline-none" />
                                            </div>
                                        </div>
                                    )}

                                    {cartItem.itemType === "Activity" && (
                                        <div className="text-sm">
                                            <label className="text-xs text-slate-500 block mb-1">Activity Date</label>
                                            <input type="date" value={cartItem.activityDate} onChange={(e) => handleDateChange(cartItem.id, "activityDate", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 outline-none" />
                                        </div>
                                    )}

                                    {(cartItem.itemType === "Hotel" || cartItem.itemType === "Activity") && (
                                        <div className="grid grid-cols-2 gap-2 text-sm mt-3 border-t border-slate-100 pt-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1 font-medium text-slate-600">Adults</label>
                                                <div className="flex items-center">
                                                    <button onClick={() => handleDateChange(cartItem.id, "adults", Math.max(1, (cartItem.adults || 1) - 1))} className="bg-slate-100 px-2.5 py-1 rounded-l border border-slate-200 hover:bg-slate-200 transition-colors">-</button>
                                                    <div className="w-10 text-center border-y border-slate-200 py-1 bg-white">{cartItem.adults || 1}</div>
                                                    <button onClick={() => handleDateChange(cartItem.id, "adults", (cartItem.adults || 1) + 1)} className="bg-slate-100 px-2.5 py-1 rounded-r border border-slate-200 hover:bg-slate-200 transition-colors">+</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1 font-medium text-slate-600">Children</label>
                                                <div className="flex items-center">
                                                    <button onClick={() => handleDateChange(cartItem.id, "children", Math.max(0, (cartItem.children || 0) - 1))} className="bg-slate-100 px-2.5 py-1 rounded-l border border-slate-200 hover:bg-slate-200 transition-colors">-</button>
                                                    <div className="w-10 text-center border-y border-slate-200 py-1 bg-white">{cartItem.children || 0}</div>
                                                    <button onClick={() => handleDateChange(cartItem.id, "children", (cartItem.children || 0) + 1)} className="bg-slate-100 px-2.5 py-1 rounded-r border border-slate-200 hover:bg-slate-200 transition-colors">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                        <label className="text-sm text-slate-600 whitespace-nowrap">Price Override (₹):</label>
                                        <input
                                            type="number"
                                            value={cartItem.price}
                                            onChange={(e) => handlePriceChange(cartItem.id, e.target.value)}
                                            className="w-full border-b border-slate-300 px-1 py-1 text-slate-900 font-semibold focus:outline-none focus:border-slate-900 text-right"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="p-6 py-2 border-t border-slate-200 space-y-1">
                        <div className="space-y-2 pt-1">
                            <h3 className="font-semibold text-slate-900">Guest Details</h3>
                            <input type="text" placeholder="Guest Name" value={guestDetails.name} onChange={e => setGuestDetails({ ...guestDetails, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400" />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="email" placeholder="Email Address" value={guestDetails.email} onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400" />
                                <input type="text" placeholder="Phone Number" value={guestDetails.phone} onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400" />
                            </div>
                            <textarea placeholder="Admin Notes (Internal)..." value={guestDetails.notes} onChange={e => setGuestDetails({ ...guestDetails, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 min-h-16 outline-none focus:border-slate-400" />
                        </div>

                        <div className="flex items-center justify-between text-lg pt-2">
                            <span className="font-medium text-slate-600">Total Package Value</span>
                            <span className="font-bold text-slate-900 text-xl">₹{getTotalPrice()}</span>
                        </div>

                        <button
                            disabled={isSubmitting}
                            onClick={submitPackage}
                            className="w-full bg-slate-900 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? "Generating..." : "Generate Custom Package booking"}
                            {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                        </button>
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
        const qty = getQty({ hubId: item.hubId?._id, vehicleModelId: item.vehicleModelId?._id });
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
                        onPlus={async () => {
                            if (!globalDates.startDate || !globalDates.endDate) return toast.error("Select start/end dates first");
                            // Check date-based availability using same endpoint as rental checkout.
                            try {
                                const vehicleId = item.vehicleId || item.vehicleModelId?._id || item._id;
                                const res = await fetch(`${apiRootUrl}/userapp/vehicle/vehicleDetails/${vehicleId}?startDate=${globalDates.startDate}&endDate=${globalDates.endDate}`);
                                if (!res.ok) throw new Error(await res.text());
                                const json = await res.json();
                                const availability = json?.data?.availability || [];
                                const hubsInCity = (city && city !== "all")
                                    ? availability.filter((h) => (h?.hub?.address?.city || "").toLowerCase().includes(city))
                                    : availability;
                                const hub = hubsInCity.find((h) => (h?.availableQuantity || 0) > 0 && h?.allowBooking !== false);
                                if (!hub) return toast.error("Vehicle not available for selected dates");

                                const already = getQty({ hubId: hub.hub?._id, vehicleModelId: item.vehicleModelId?._id });
                                if (already >= (hub.availableQuantity || 0)) return toast.error("Max quantity reached or not available");

                                onPlus({
                                    hubId: hub.hub?._id,
                                    vehicleModelId: item.vehicleModelId?._id,
                                    price: hub.totalPrice ? hub.totalPrice : (item.pricing?.rentalPrice || item.totalPrice || 0),
                                    name: `${title} (${hub.hub?.name})`,
                                });
                            } catch (e) {
                                console.error(e);
                                toast.error("Failed to check availability");
                            }
                        }}
                        onMinus={() => onMinus({ hubId: item.hubId?._id, vehicleModelId: item.vehicleModelId?._id })}
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
