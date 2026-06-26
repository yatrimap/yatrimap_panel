"use client";

import { useEffect, useState } from "react";
import { buildBackendUrl } from "@/lib/api-url";
import { User, Phone, Mail, MapPin, Building, Calendar, Clock, CreditCard, FileText, CheckCircle, ExternalLink, Briefcase, Car, Building2, Ticket, MessageSquare, Plus } from "lucide-react";

const bookingSections = ["hotel", "rental", "activity", "package", "custom-package"];


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
  const getLocalDateKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const todayKey = getLocalDateKey(now);
  const tomorrowKey = getLocalDateKey(new Date(now.getTime() + 86400000));
  const [month, setMonth] = useState(todayKey.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftNotes, setDraftNotes] = useState({});
  const [activeBooking, setActiveBooking] = useState(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("booking-date"); // "booking-date" | "created-date"


  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(buildBackendUrl(`/admin/insights/bookings?month=${month}&date=${selectedDate}`), {
        cache: "no-store",
        credentials: "include",
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
    await fetch(buildBackendUrl(`/admin/insights/bookings/${booking.type}/${booking.rawId}/note`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
    await fetch(buildBackendUrl(`/admin/insights/bookings/${booking.type}/${booking.rawId}/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
    { label: "Created today", value: (data.createdOnDate?.totalBookings || 0).toString() },
    { label: "Active agents", value: data.metrics.activeAgents.toString() },
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
                  <p className="text-sm capitalize text-slate-500">
                    {section === 'custom-package' ? 'Custom Package' : section}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {data.selectedDate.sections[section]?.length || 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => { setViewMode("booking-date"); setActiveTab("all"); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === "booking-date"
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Booking Date
            </button>
            <button
              onClick={() => { setViewMode("created-date"); setActiveTab("all"); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === "created-date"
                  ? "bg-teal-700 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Plus className="h-4 w-4" />
              Created Date
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {viewMode === "booking-date" 
              ? "Showing bookings scheduled on selected date" 
              : "Showing bookings created on selected date (regardless of booking date)"}
          </p>
        </div>

        {/* Created Date Summary Bar */}
        {viewMode === "created-date" && data.createdOnDate && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-teal-200 bg-teal-50/50 px-5 py-3">
            <div className="flex items-center gap-2 text-teal-800">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-semibold">{data.createdOnDate.totalBookings} bookings created</span>
            </div>
            <span className="text-sm text-teal-600">Revenue: {currency.format(data.createdOnDate.totalRevenue)}</span>
            <span className="text-xs text-teal-500">on {formatDate(data.createdOnDate.date)}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-4">
          {["all", ...bookingSections].map((tab) => {
            const label = tab === 'all' ? 'All' : tab === 'hotel' ? 'Stay (Hotel)' : tab === 'custom-package' ? 'Custom Package' : tab.charAt(0).toUpperCase() + tab.slice(1);
            const activeSections = viewMode === "created-date" ? (data.createdOnDate?.sections || {}) : data.selectedDate.sections;
            const count = tab === 'all' 
              ? bookingSections.reduce((acc, curr) => acc + (activeSections[curr]?.length || 0), 0)
              : activeSections[tab]?.length || 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? viewMode === "created-date" ? "bg-teal-700 text-white shadow-md" : "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {label} Bookings
                <span className={`flex h-6 items-center justify-center rounded-full px-2 text-xs ${
                  activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`rounded-[30px] border bg-white p-6 shadow-sm ${viewMode === "created-date" ? "border-teal-200" : "border-slate-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-mono text-xs uppercase tracking-[0.3em] ${viewMode === "created-date" ? "text-teal-700" : "text-teal-700"}`}>
                {viewMode === "created-date" ? "Created on this date" : "Booking details"}
              </p>
              <h3 className="mt-2 font-serif text-3xl capitalize">
                {activeTab === 'all' ? 'All' : activeTab === 'hotel' ? 'Stay' : activeTab === 'custom-package' ? 'Custom Package' : activeTab} bookings
              </h3>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {(() => {
              const activeSections = viewMode === "created-date" ? (data.createdOnDate?.sections || {}) : data.selectedDate.sections;
              const bookingsToShow = activeTab === 'all' 
                ? bookingSections.flatMap(section => activeSections[section] || [])
                : activeSections[activeTab] || [];

              if (bookingsToShow.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 py-12 text-slate-500">
                    <FileText className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm font-medium">
                      {viewMode === "created-date" 
                        ? `No bookings were created on this date.`
                        : `No ${activeTab === 'all' ? '' : activeTab === 'custom-package' ? 'custom package' : activeTab} bookings on this date.`
                      }
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Try selecting a different date from the calendar.</p>
                  </div>
                );
              }

              return bookingsToShow.map((booking) => (
                <ExpandableBookingCard
                  key={booking.id}
                  booking={booking}
                  draftNote={draftNotes[booking.id] ?? booking.notes}
                  onDraftNoteChange={(val) =>
                    setDraftNotes((current) => ({ ...current, [booking.id]: val }))
                  }
                  onApprove={approveBooking}
                  onSaveNote={saveNote}
                  showCreatedAt={viewMode === "created-date"}
                />
              ));
            })()}
          </div>
        </div>
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
  showCreatedAt = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGoToBooking = (e) => {
    e.stopPropagation();
    let url = "";
    if (booking.type === 'activity') {
      url = "https://hoteladmin.yatrimap.com/welcome/activitybooking";
    } else if (booking.type === 'hotel') {
      const propId = booking.propertyId || booking.hotelInfo?.id || booking.hotelInfo?._id || "unknown";
      url = `https://hoteladmin.yatrimap.com/${propId}/admin/bookings/${booking.rawId}`;
    } else if (booking.type === 'rental') {
      const hubId = booking.hubId || booking.hubInfo?.id || booking.hubInfo?._id || "unknown";
      url = `https://rentaladmin.yatrimap.com/${hubId}/hubadmin/bookings/${booking.rawId}`;
    } else if (booking.type === 'custom-package') {
      url = "/admin/custom-package";
    }

    if (url) {
      window.open(url, "_blank");
    }
  };

  const getIcon = () => {
    if (booking.type === 'hotel') return <Building2 className="h-5 w-5" />;
    if (booking.type === 'rental') return <Car className="h-5 w-5" />;
    if (booking.type === 'activity') return <Ticket className="h-5 w-5" />;
    if (booking.type === 'custom-package') return <Briefcase className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <article
      className={`overflow-hidden rounded-[24px] border transition-all duration-300 ${
        isExpanded ? "border-slate-300 bg-white shadow-xl" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
      }`}
    >
      {/* Header - Always visible */}
      <div 
        className="flex cursor-pointer items-center justify-between p-5" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-1 items-center gap-4">
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${booking.color}15`, color: booking.color }}
          >
            {getIcon()}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-slate-900">
                {booking.type === 'hotel' && booking.hotelInfo?.name ? booking.hotelInfo.name : booking.title}
              </h4>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                booking.status.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {booking.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {booking.bookingCode}
              </span>
            </div>
            
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {booking.customer?.name}</span>
              <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {currency.format(booking.amount)}</span>
              {booking.schedule?.time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {booking.schedule.time}</span>}
              {showCreatedAt && (
                <>
                  <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    <Calendar className="h-3 w-3" /> Booking: {formatDate(booking.bookingDate)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {booking.type === 'custom-package' ? 'Custom Pkg' : booking.type}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGoToBooking}
            className="hidden items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 md:flex"
          >
            <ExternalLink className="h-4 w-4" /> Go to booking
          </button>
          
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-transform ${isExpanded ? 'rotate-180 bg-slate-100' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            
            {/* Custom Package Component Items */}
            {booking.type === 'custom-package' && booking.items && booking.items.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-indigo-900 font-semibold">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                  <h5>Package Components ({booking.items.length})</h5>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {booking.items.map((item, index) => (
                    <div key={index} className="rounded-xl border border-indigo-100 bg-white p-3.5 text-sm shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            item.itemType === 'Hotel' ? 'bg-teal-100 text-teal-800' :
                            item.itemType === 'Rental' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {item.itemType}
                          </span>
                          <span className="font-semibold text-slate-900">{currency.format(item.price)}</span>
                        </div>
                        <p className="mt-2 font-medium text-slate-800 line-clamp-1">{item.name}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Qty: {item.quantity}</span>
                        <span>
                          {item.itemType === 'Activity' 
                            ? formatDate(item.activityDate)
                            : `${formatDate(item.checkIn)} - ${formatDate(item.checkOut)}`
                          }
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <User className="h-5 w-5 text-teal-600" />
                <h5 className="font-semibold">Guest Information</h5>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-3"><span className="font-medium text-slate-900 w-16">Name:</span> {booking.customer.name}</p>
                <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-slate-400" /> {booking.customer.email}</p>
                <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-slate-400" /> {booking.customer.phone}</p>
              </div>
            </div>

            {/* Operational Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <Briefcase className="h-5 w-5 text-indigo-600" />
                <h5 className="font-semibold">Operational Details</h5>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-3"><Calendar className="h-4 w-4 text-slate-400" /> <span className="font-medium text-slate-900 w-16">Date:</span> {formatDate(booking.bookingDate)}</p>
                {booking.stay?.checkOut && <p className="flex items-center gap-3"><Calendar className="h-4 w-4 text-slate-400" /> <span className="font-medium text-slate-900 w-16">Out:</span> {formatDate(booking.stay.checkOut)}</p>}
                <p className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-slate-400" /> <span className="font-medium text-slate-900 w-16">Payment:</span> {booking.paymentStatus}</p>
                <p className="flex items-center gap-3"><MapPin className="h-4 w-4 text-slate-400" /> <span className="font-medium text-slate-900 w-16">Source:</span> {booking.source || "backend"}</p>
              </div>
            </div>

            {/* Provider Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <Building className="h-5 w-5 text-rose-600" />
                <h5 className="font-semibold">Provider Details</h5>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                {booking.hotelInfo && (
                  <>
                    <p className="font-medium text-slate-900">{booking.hotelInfo.name || booking.title}</p>
                    <p className="text-xs">{typeof booking.hotelInfo.address === 'string' ? booking.hotelInfo.address : (booking.hotelInfo.address?.fullAddress || `${booking.hotelInfo.address?.city || ''}`)}</p>
                    {(booking.hotelInfo.contactPhone || (booking.hotelInfo.phone && booking.hotelInfo.phone[0])) && (
                      <p className="flex items-center gap-2 mt-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {booking.hotelInfo.contactPhone || booking.hotelInfo.phone[0]}</p>
                    )}
                  </>
                )}
                {booking.hubInfo && (
                  <>
                    <p className="font-medium text-slate-900">{booking.hubInfo.name}</p>
                    {booking.hubInfo.managerName && <p className="text-xs">Manager: {booking.hubInfo.managerName}</p>}
                    {booking.hubInfo.contactNumber && <p className="flex items-center gap-2 mt-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {booking.hubInfo.contactNumber}</p>}
                  </>
                )}
                {booking.companyInfo && (
                  <>
                    <p className="font-medium text-slate-900">{booking.companyInfo.name || booking.companyInfo.legalName}</p>
                    <p className="text-xs">{booking.companyInfo.location?.address || booking.companyInfo.address}</p>
                    {(booking.companyInfo.contact?.phone || booking.companyInfo.phone) && (
                      <p className="flex items-center gap-2 mt-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {booking.companyInfo.contact?.phone || booking.companyInfo.phone}</p>
                    )}
                  </>
                )}
                {!booking.hotelInfo && !booking.hubInfo && !booking.companyInfo && (
                  <p className="text-slate-400 italic">No specific provider details available.</p>
                )}
              </div>
            </div>

            {/* Agent Info (If applicable) */}
            {booking.hasAgent && booking.agent && (
              <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-amber-800">
                  <User className="h-5 w-5" />
                  <h5 className="font-semibold">Agent Booking Indicator</h5>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-amber-900">
                  <p><span className="font-medium opacity-70">Agent:</span> {booking.agent.fullName} ({booking.agent.agentCode})</p>
                  <p><span className="font-medium opacity-70">Shop:</span> {booking.agent.shopName}</p>
                  <p><span className="font-medium opacity-70">Commission:</span> {currency.format(booking.commission?.commissionAmount || 0)} ({booking.commission?.commissionPercentage || 0}%)</p>
                </div>
              </div>
            )}

            {/* Admin Note Section */}
            <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-slate-800">
                <MessageSquare className="h-5 w-5 text-slate-400" />
                <h5 className="font-semibold">Admin Note</h5>
              </div>
              <textarea
                value={draftNote}
                onChange={(event) => onDraftNoteChange(event.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Add internal note for admin operations..."
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-6">
            <button
              onClick={() => onSaveNote(booking)}
              className="flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Save Note
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(booking);
              }}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              <CheckCircle className="h-4 w-4" /> Approve Booking
            </button>
            <button
              onClick={handleGoToBooking}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 md:hidden"
            >
              <ExternalLink className="h-4 w-4" /> Go to booking
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
