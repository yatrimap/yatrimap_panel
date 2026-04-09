"use client";

import { useEffect, useState } from "react";

const bookingSections = ["rental", "hotel", "activity", "package"];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    : "NA";

const statusForApproval = (booking) => {
  if (booking.type === "rental") return "CONFIRMED";
  if (booking.type === "hotel") return "booked";
  return "confirmed";
};

export function DashboardClient() {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const tomorrowKey = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftNotes, setDraftNotes] = useState({});
  const [activeBooking, setActiveBooking] = useState(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/bookings?month=${month}&date=${selectedDate}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!ignore) {
        if (!response.ok || !json.success) {
          setData(null);
          setError(json.message || "Failed to fetch live bookings");
        } else {
          setData(json.data);
        }
        setLoading(false);
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [month, selectedDate]);

  const saveNote = async (booking) => {
    const note = draftNotes[booking.id] ?? booking.notes;
    await fetch(`/api/admin/bookings/${booking.type}/${booking.rawId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, source: booking.source }),
    });

    setData((current) =>
      current
        ? {
          ...current,
          spotlight: {
            today: current.spotlight.today.map((item) => (item.id === booking.id ? { ...item, notes: note } : item)),
            tomorrow: current.spotlight.tomorrow.map((item) =>
              item.id === booking.id ? { ...item, notes: note } : item,
            ),
          },
          selectedDate: {
            ...current.selectedDate,
            sections: Object.fromEntries(
              Object.entries(current.selectedDate.sections).map(([type, items]) => [
                type,
                items.map((item) => (item.id === booking.id ? { ...item, notes: note } : item)),
              ]),
            ),
          },
        }
        : current,
    );
  };

  const approveBooking = async (booking) => {
    const status = statusForApproval(booking);
    await fetch(`/api/admin/bookings/${booking.type}/${booking.rawId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, source: booking.source }),
    });

    setData((current) =>
      current
        ? {
          ...current,
          selectedDate: {
            ...current.selectedDate,
            sections: Object.fromEntries(
              Object.entries(current.selectedDate.sections).map(([type, items]) => [
                type,
                items.map((item) => (item.id === booking.id ? { ...item, status } : item)),
              ]),
            ),
          },
        }
        : current,
    );
  };

  if (loading) {
    return <div className="rounded-[28px] bg-slate-100 p-8 text-sm text-slate-600">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-900">
        <p className="font-medium">Live backend data is not available.</p>
        <p className="mt-2">{error || "Unknown backend error"}</p>
      </div>
    );
  }

  const metricCards = [
    { label: "Total bookings", value: data.metrics.totalBookings.toString() },
    { label: "Revenue in month", value: currency.format(data.metrics.totalRevenue) },
    { label: "Today pipeline", value: data.metrics.todayBookings.toString() },
    { label: "Tomorrow pipeline", value: data.metrics.tomorrowBookings.toString() },
    { label: "Active agents", value: data.metrics.activeAgents.toString() },
    { label: "Average booking", value: currency.format(data.metrics.averageBookingValue) },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 font-serif text-3xl text-slate-950">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Booking lens</p>
              <h3 className="mt-2 font-serif text-3xl">Today, tomorrow, and monthly view</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm border ${isCalendarExpanded ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              >
                {isCalendarExpanded ? "Collapse Calendar" : "Expand Calendar"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isCalendarExpanded ? 'rotate-180' : ''}`}>
                   <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm ${selectedDate === todayKey ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                onClick={() => setSelectedDate(todayKey)}
              >
                Today
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm ${selectedDate === tomorrowKey ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                onClick={() => setSelectedDate(tomorrowKey)}
              >
                Tomorrow
              </button>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 outline-none"
              />
            </div>
          </div>

          {isCalendarExpanded && (
            <div className="mt-6 grid grid-cols-7 gap-3 text-center text-xs uppercase tracking-[0.2em] text-slate-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
          )}

          <div className={`mt-4 grid gap-3 ${isCalendarExpanded ? 'grid-cols-7' : 'grid-cols-2'}`}>
            {data.calendar.days
              .filter(day => isCalendarExpanded || day.date === todayKey || day.date === tomorrowKey)
              .map((day) => {
              const isActive = day.date === selectedDate;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`group relative min-h-28 rounded-[24px] border p-3 text-left transition ${isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-white"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{Number(day.date.slice(-2))}</span>
                    <span className={`text-xs ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                      {day.totalBookings} bk
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {day.markers.map((marker) => (
                      <span
                        key={marker.type}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: marker.color }}
                        title={`${marker.label}: ${marker.count}`}
                      />
                    ))}
                  </div>
                  <div className={`mt-3 text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                    {currency.format(day.totalRevenue)}
                  </div>

                  {day.preview.length > 0 ? (
                    <div className="pointer-events-none absolute left-3 top-full z-[999] mt-2 hidden w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl group-hover:block">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Booking preview</p>
                      <div className="mt-3 space-y-2">
                        {day.preview.map((item) => (
                          <div key={item.id} className="rounded-xl bg-slate-50 p-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <p className="text-sm font-medium">{item.title}</p>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{item.customerName}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Type mix</p>
            <div className="mt-4 space-y-3">
              {bookingSections.map((section) => (
                <div key={section}>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="capitalize">{section}</span>
                    <span>{data.metrics.byType[section]}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(
                          10,
                          (data.metrics.byType[section] / Math.max(1, data.metrics.totalBookings)) * 100,
                        )}%`,
                        background:
                          section === "hotel"
                            ? "#0f766e"
                            : section === "activity"
                              ? "#2563eb"
                              : section === "package"
                                ? "#d97706"
                                : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Selected date</p>
            <h3 className="mt-2 font-serif text-3xl">{formatDate(data.selectedDate.date)}</h3>
            <p className="mt-2 text-sm text-slate-500">{data.selectedDate.totalBookings} bookings scheduled</p>
            <div className="mt-4 grid gap-3">
              {bookingSections.map((section) => (
                <div key={section} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-sm capitalize text-slate-500">{section}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {data.selectedDate.sections[section].length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {bookingSections.map((section) => (
          <div key={section} className="rounded-[30px] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Booking details</p>
                <h3 className="mt-2 font-serif text-3xl capitalize">{section} bookings</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                {data.selectedDate.sections[section].length} items
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {data.selectedDate.sections[section].length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No {section} booking on this date.
                </div>
              ) : (
                data.selectedDate.sections[section].map((booking) => (
                  <ExpandableBookingCard
                    key={booking.id}
                    booking={booking}
                    draftNote={draftNotes[booking.id] ?? booking.notes}
                    onDraftNoteChange={(val) =>
                      setDraftNotes((current) => ({ ...current, [booking.id]: val }))
                    }
                    onApprove={approveBooking}
                    onSaveNote={saveNote}
                    onGoToNote={setActiveBooking}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      {activeBooking ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 md:items-center">
          <div className="w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Booking drawer</p>
                <h3 className="mt-2 font-serif text-3xl">{activeBooking.title}</h3>
              </div>
              <button
                onClick={() => setActiveBooking(null)}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Guest</p>
                <p className="mt-2">{activeBooking.customer.name}</p>
                <p>{activeBooking.customer.email}</p>
                <p>{activeBooking.customer.phone}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operational</p>
                <p className="mt-2">Status: {activeBooking.status}</p>
                <p>Payment: {activeBooking.paymentStatus}</p>
                <p>Value: {currency.format(activeBooking.amount)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin note</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{activeBooking.notes || "No note yet."}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExpandableBookingCard({
  booking,
  draftNote,
  onDraftNoteChange,
  onApprove,
  onSaveNote,
  onGoToNote,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article
      className={`grid gap-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 transition-all ${
        isExpanded ? "xl:grid-cols-[1.2fr_0.8fr_0.45fr]" : ""
      }`}
    >
      <div className={isExpanded ? "" : ""}>
        <div 
          className={`flex flex-wrap items-center justify-between ${isExpanded ? "mb-6" : "cursor-pointer"}`} 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: `${booking.color}22`, color: booking.color }}
            >
              {booking.label}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
              {booking.status}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
              {booking.bookingCode}
            </span>
            
            {!isExpanded && (
              <>
                <span className="font-semibold text-slate-900">{booking.title}</span>
                <span className="text-sm text-slate-500">
                  {booking.customer.name} • {currency.format(booking.amount)}
                </span>
              </>
            )}
          </div>

          <button
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title={isExpanded ? "Collapse details" : "Expand details"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <>
            <h4 className="text-2xl font-semibold text-slate-950">{booking.title}</h4>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">User details</p>
                <p className="mt-2 font-medium text-slate-900">{booking.customer.name}</p>
                <p>{booking.customer.email}</p>
                <p>{booking.customer.phone}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operational info</p>
                <p className="mt-2 text-slate-900">{booking.secondaryInfo || "Booking scheduled"}</p>
                <p className="mt-1">Value: {currency.format(booking.amount)}</p>
                <p className="mt-1">Payment: {booking.paymentStatus}</p>
                <p className="mt-1">Source: {booking.source || "backend"}</p>
              </div>
            </div>

            {booking.hasAgent && booking.agent ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">Agent booking indicator</p>
                <p className="mt-1">
                  {booking.agent.fullName} ({booking.agent.agentCode}) from {booking.agent.shopName}
                </p>
                <p className="mt-1">
                  Commission: {currency.format(booking.commission?.commissionAmount || 0)} at{" "}
                  {booking.commission?.commissionPercentage || 0}%
                </p>
              </div>
            ) : null}

            {booking.hubInfo ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-medium text-xs uppercase tracking-[0.2em] mb-2 text-blue-700">Rental Hub Details</p>
                <p className="font-semibold">{booking.hubInfo.name}</p>
                {booking.hubInfo.managerName && <p>Manager: {booking.hubInfo.managerName}</p>}
                {booking.hubInfo.contactNumber && <p>Contact: {booking.hubInfo.contactNumber}</p>}
                {booking.hubInfo.address?.city && <p>Location: {booking.hubInfo.address.city}, {booking.hubInfo.address.state}</p>}
              </div>
            ) : null}
            
            {booking.hotelInfo ? (
              <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
                <p className="font-medium text-xs uppercase tracking-[0.2em] mb-2 text-teal-700">Hotel Details</p>
                <p className="font-semibold">{booking.hotelInfo.name || booking.title}</p>
                {booking.hotelInfo.address && (
                  <p>
                    {typeof booking.hotelInfo.address === 'string' 
                      ? booking.hotelInfo.address 
                      : (booking.hotelInfo.address.fullAddress || `${booking.hotelInfo.address.city || ''} ${booking.hotelInfo.address.state || ''}`)}
                  </p>
                )}
                {booking.hotelInfo.contactPhone && <p>Contact: {booking.hotelInfo.contactPhone}</p>}
                {(booking.hotelInfo.phone && booking.hotelInfo.phone.length > 0) && <p>Contact: {booking.hotelInfo.phone[0]}</p>}
              </div>
            ) : null}
            
            {booking.companyInfo ? (
              <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <p className="font-medium text-xs uppercase tracking-[0.2em] mb-2 text-purple-700">Company Details / Provider Info</p>
                <p className="font-semibold">{booking.companyInfo.name || booking.companyInfo.legalName}</p>
                {booking.companyInfo.contact?.phone && <p>Contact: {booking.companyInfo.contact.phone}</p>}
                {booking.companyInfo.phone && <p>Contact: {booking.companyInfo.phone}</p>}
                {booking.companyInfo.location?.address && <p>Location: {booking.companyInfo.location.address}, {booking.companyInfo.location.city}</p>}
                {booking.companyInfo.address && <p>Location: {booking.companyInfo.address}</p>}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin note</label>
              <textarea
                value={draftNote}
                onChange={(event) => onDraftNoteChange(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                placeholder="Add internal note for admin operations..."
              />
            </div>
          </>
        )}
      </div>

      {isExpanded && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Date summary</p>
              <p className="mt-2 text-slate-900">{formatDate(booking.bookingDate)}</p>
              {booking.stay?.checkOut ? <p>Check out: {formatDate(booking.stay.checkOut)}</p> : null}
              {booking.schedule?.time ? <p>Time: {booking.schedule.time}</p> : null}
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Business value</p>
              <p className="mt-2 text-slate-900">{currency.format(booking.amount)}</p>
              <p>{booking.hasAgent ? "Partner sourced" : "Direct platform booking"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => onApprove(booking)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              Approve booking
            </button>
            <button
              onClick={() => onGoToNote(booking)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              Go to booking
            </button>
            <button
              onClick={() => onSaveNote(booking)}
              className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900"
            >
              Save note
            </button>
          </div>
        </>
      )}
    </article>
  );
}
