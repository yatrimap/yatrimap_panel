import type { AgentDetails, AgentOverview, BookingCard, BookingInsights, BookingType } from "@/lib/admin-types";

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const iso = (date: Date) => date.toISOString();
const key = (date: Date) => date.toISOString().slice(0, 10);

const createBooking = (
  id: string,
  type: BookingType,
  date: Date,
  extra: Partial<BookingCard>,
): BookingCard => ({
  id,
  rawId: id,
  type,
  source:
    type === "hotel"
      ? "room-booking"
      : type === "activity"
        ? "activity-booking"
        : type === "package"
          ? "package-booking"
          : "vehicle-booking",
  label: type[0].toUpperCase() + type.slice(1),
  color:
    type === "hotel"
      ? "#0f766e"
      : type === "activity"
        ? "#2563eb"
        : type === "package"
          ? "#d97706"
          : "#ef4444",
  title: "Booking",
  bookingCode: `YTM-${id.slice(-4).toUpperCase()}`,
  bookingDate: iso(date),
  status: "pending",
  customer: {
    name: "Guest user",
    email: "guest@yatrimap.com",
    phone: "+91 9000000000",
  },
  amount: 0,
  paymentStatus: "paid",
  notes: "",
  hasAgent: false,
  agent: null,
  commission: null,
  ...extra,
});

const mockBookings: BookingCard[] = [
  createBooking("rental-1", "rental", today, {
    title: "Royal Enfield Himalayan",
    amount: 4200,
    status: "CONFIRMED",
    secondaryInfo: "Pickup: Rishikesh hub",
    customer: {
      name: "Aman Verma",
      email: "aman@example.com",
      phone: "+91 9876543210",
    },
    notes: "Verify license at pickup. VIP repeat customer.",
    schedule: {
      startDate: iso(today),
      endDate: iso(new Date(today.getTime() + 2 * 86400000)),
      quantity: 1,
    },
    hasAgent: true,
    agent: {
      id: "agent-1",
      agentCode: "AGT-RAJ-001",
      fullName: "Raj Tour Partner",
      email: "raj@partner.com",
      phone: "+91 9988776655",
      city: "Haridwar",
      shopName: "Raj Travels",
    },
    commission: {
      commissionAmount: 336,
      commissionPercentage: 8,
      status: "APPROVED",
    },
  }),
  createBooking("hotel-1", "hotel", today, {
    title: "Deluxe River View Room",
    amount: 6800,
    status: "booked",
    secondaryInfo: "Ganga Retreat, Haridwar",
    customer: {
      name: "Sneha Kapoor",
      email: "sneha@example.com",
      phone: "+91 9812345678",
    },
    notes: "Early check-in requested. Child bed required.",
    stay: {
      checkIn: iso(today),
      checkOut: iso(new Date(today.getTime() + 86400000)),
      guests: 3,
      rooms: 1,
    },
  }),
  createBooking("activity-1", "activity", today, {
    title: "River Rafting Premium Slot",
    amount: 3200,
    status: "confirmed",
    secondaryInfo: "11:00 AM batch",
    customer: {
      name: "Karan Singh",
      email: "karan@example.com",
      phone: "+91 9898989898",
    },
    notes: "Customer asked for locker facility info.",
    schedule: {
      date: iso(today),
      time: "11:00 AM",
      quantity: 4,
    },
    hasAgent: true,
    agent: {
      id: "agent-2",
      agentCode: "AGT-MEA-014",
      fullName: "Meera Holidays",
      email: "meera@holiday.com",
      phone: "+91 9797979797",
      city: "Delhi",
      shopName: "Meera Holidays",
    },
    commission: {
      commissionAmount: 224,
      commissionPercentage: 7,
      status: "APPROVED",
    },
  }),
  createBooking("package-1", "package", tomorrow, {
    title: "Kedarnath Premium Circuit",
    amount: 25500,
    status: "confirmed",
    secondaryInfo: "2 adults, 1 child",
    customer: {
      name: "Neha Arora",
      email: "neha@example.com",
      phone: "+91 9765432109",
    },
    notes: "Need helicopter upgrade callback.",
    schedule: {
      startDate: iso(tomorrow),
      endDate: iso(new Date(tomorrow.getTime() + 4 * 86400000)),
      travelers: 3,
    },
  }),
  createBooking("hotel-2", "hotel", tomorrow, {
    title: "Family Suite",
    amount: 9400,
    status: "pending",
    secondaryInfo: "Riverside Residency",
    customer: {
      name: "Pooja Jain",
      email: "pooja@example.com",
      phone: "+91 9123456780",
    },
    notes: "Awaiting payment screenshot from customer.",
    stay: {
      checkIn: iso(tomorrow),
      checkOut: iso(new Date(tomorrow.getTime() + 2 * 86400000)),
      guests: 4,
      rooms: 1,
    },
  }),
];

const buildDays = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const totalDays = new Date(year, monthIndex, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, monthIndex - 1, index + 1);
    const dateKey = key(date);
    const bookings = mockBookings.filter((item) => item.bookingDate.slice(0, 10) === dateKey);
    const grouped = bookings.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    return {
      date: dateKey,
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, item) => sum + item.amount, 0),
      markers: Object.entries(grouped).map(([type, count]) => ({
        type: type as BookingType,
        count,
        color: bookings.find((item) => item.type === type)?.color || "#94a3b8",
        label: type,
      })),
      preview: bookings.slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        customerName: item.customer.name,
        amount: item.amount,
        color: item.color,
      })),
    };
  });
};

export const getMockBookingInsights = (month: string, selectedDate: string): BookingInsights => {
  const monthBookings = mockBookings.filter((item) => item.bookingDate.startsWith(month));
  const todayKey = key(today);
  const tomorrowKey = key(tomorrow);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      month,
      selectedDate,
    },
    metrics: {
      totalBookings: monthBookings.length,
      totalRevenue: monthBookings.reduce((sum, item) => sum + item.amount, 0),
      todayBookings: monthBookings.filter((item) => item.bookingDate.slice(0, 10) === todayKey).length,
      tomorrowBookings: monthBookings.filter((item) => item.bookingDate.slice(0, 10) === tomorrowKey).length,
      activeAgents: 12,
      averageBookingValue:
        monthBookings.length > 0
          ? monthBookings.reduce((sum, item) => sum + item.amount, 0) / monthBookings.length
          : 0,
      byType: {
        rental: monthBookings.filter((item) => item.type === "rental").length,
        hotel: monthBookings.filter((item) => item.type === "hotel").length,
        activity: monthBookings.filter((item) => item.type === "activity").length,
        package: monthBookings.filter((item) => item.type === "package").length,
      },
      byStatus: monthBookings.reduce<Record<string, number>>((acc, item) => {
        acc[item.status.toLowerCase()] = (acc[item.status.toLowerCase()] || 0) + 1;
        return acc;
      }, {}),
    },
    spotlight: {
      today: monthBookings.filter((item) => item.bookingDate.slice(0, 10) === todayKey),
      tomorrow: monthBookings.filter((item) => item.bookingDate.slice(0, 10) === tomorrowKey),
    },
    calendar: {
      month,
      days: buildDays(month),
    },
    selectedDate: {
      date: selectedDate,
      totalBookings: monthBookings.filter((item) => item.bookingDate.slice(0, 10) === selectedDate).length,
      sections: {
        rental: monthBookings.filter((item) => item.type === "rental" && item.bookingDate.slice(0, 10) === selectedDate),
        hotel: monthBookings.filter((item) => item.type === "hotel" && item.bookingDate.slice(0, 10) === selectedDate),
        activity: monthBookings.filter((item) => item.type === "activity" && item.bookingDate.slice(0, 10) === selectedDate),
        package: monthBookings.filter((item) => item.type === "package" && item.bookingDate.slice(0, 10) === selectedDate),
      },
    },
  };
};

export const mockAgents: AgentOverview[] = [
  {
    id: "agent-1",
    agentCode: "AGT-RAJ-001",
    fullName: "Raj Tour Partner",
    email: "raj@partner.com",
    phone: "+91 9988776655",
    city: "Haridwar",
    shopName: "Raj Travels",
    status: "ACTIVE",
    joinedAt: "2026-01-04T09:30:00.000Z",
    wallet: {
      totalEarnings: 84200,
      pendingAmount: 6200,
      withdrawableAmount: 18000,
      lifetimeEarnings: 84200,
    },
    performance: {
      totalBookings: 94,
      successfulBookings: 88,
      cancelledBookings: 6,
      conversionRate: 93.6,
    },
    summary: {
      totalCommission: 84200,
      totalPaid: 66000,
      totalPending: 18200,
      bookingCount: 94,
    },
  },
  {
    id: "agent-2",
    agentCode: "AGT-MEA-014",
    fullName: "Meera Holidays",
    email: "meera@holiday.com",
    phone: "+91 9797979797",
    city: "Delhi",
    shopName: "Meera Holidays",
    status: "ACTIVE",
    joinedAt: "2025-12-18T11:00:00.000Z",
    wallet: {
      totalEarnings: 56400,
      pendingAmount: 4800,
      withdrawableAmount: 14200,
      lifetimeEarnings: 56400,
    },
    performance: {
      totalBookings: 67,
      successfulBookings: 61,
      cancelledBookings: 6,
      conversionRate: 91,
    },
    summary: {
      totalCommission: 56400,
      totalPaid: 42000,
      totalPending: 14400,
      bookingCount: 67,
    },
  },
];

export const getMockAgentDetails = (agentId: string): AgentDetails => {
  const agent = mockAgents.find((item) => item.id === agentId) || mockAgents[0];
  const bookings = mockBookings.filter((item) => item.agent?.id === agent.id);

  return {
    agent: {
      id: agent.id,
      fullName: agent.fullName,
      email: agent.email,
      phone: agent.phone,
      city: agent.city,
      agentCode: agent.agentCode,
      shopName: agent.shopName,
      shopAddress: "Main market, travel street",
      status: agent.status,
      createdAt: agent.joinedAt,
      wallet: agent.wallet,
      performance: agent.performance,
      bankDetails: {
        accountHolderName: agent.fullName,
        accountNumber: "XXXXXX3891",
        ifscCode: "HDFC0000199",
        upiId: "raj@upi",
      },
    },
    summary: {
      bookingCount: bookings.length,
      totalCommission: agent.summary.totalCommission,
      totalPaid: agent.summary.totalPaid,
      totalPending: agent.summary.totalPending,
      totalWithdrawn: 24000,
    },
    bookings,
    commissions: bookings.map((item, index) => ({
      _id: `comm-${index + 1}`,
      serviceType: item.type.toUpperCase(),
      totalAmount: item.amount,
      commissionPercentage: item.commission?.commissionPercentage || 0,
      commissionAmount: item.commission?.commissionAmount || 0,
      status: item.commission?.status || "APPROVED",
      createdAt: item.bookingDate,
    })),
    withdrawals: [
      {
        _id: "wd-1",
        amount: 12000,
        status: "PAID",
        paymentMethod: "BANK",
        createdAt: "2026-03-12T10:30:00.000Z",
      },
      {
        _id: "wd-2",
        amount: 5000,
        status: "PENDING",
        paymentMethod: "UPI",
        createdAt: "2026-03-24T14:15:00.000Z",
      },
    ],
  };
};

export const mockAgentOperations = {
  pendingCommissions: [
    {
      _id: "comm-1",
      serviceType: "HOTEL",
      totalAmount: 6800,
      commissionPercentage: 8,
      commissionAmount: 544,
      status: "PENDING",
      createdAt: today.toISOString(),
      agent: {
        id: "agent-1",
        fullName: "Raj Tour Partner",
        agentCode: "AGT-RAJ-001",
        email: "raj@partner.com",
        phone: "+91 9988776655",
      },
    },
  ],
  withdrawalRequests: [
    {
      _id: "wd-1",
      amount: 12000,
      status: "PENDING",
      paymentMethod: "BANK",
      transactionId: "",
      createdAt: today.toISOString(),
      agent: {
        id: "agent-1",
        fullName: "Raj Tour Partner",
        agentCode: "AGT-RAJ-001",
        email: "raj@partner.com",
        phone: "+91 9988776655",
      },
    },
  ],
};
