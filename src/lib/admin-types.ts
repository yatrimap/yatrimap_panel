export type BookingType = "rental" | "hotel" | "activity" | "package";

export type BookingCard = {
  id: string;
  rawId: string;
  type: BookingType;
  source?: string;
  label: string;
  color: string;
  title: string;
  bookingCode: string;
  bookingDate: string;
  status: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string | number;
  };
  amount: number;
  paymentStatus: string;
  notes: string;
  secondaryInfo?: string;
  hotelInfo?: unknown;
  hubInfo?: unknown;
  companyInfo?: unknown;
  stay?: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    rooms?: number;
  };
  schedule?: {
    date?: string;
    time?: string;
    quantity?: number;
    startDate?: string;
    endDate?: string;
    travelers?: number;
  };
  hasAgent: boolean;
  agent: null | {
    id?: string;
    agentCode?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    city?: string;
    shopName?: string;
  };
  commission: null | {
    id?: string | null;
    commissionAmount: number;
    commissionPercentage: number;
    status: string;
  };
};

export type CalendarDay = {
  date: string;
  totalBookings: number;
  totalRevenue: number;
  markers: Array<{
    type: BookingType;
    count: number;
    color: string;
    label: string;
  }>;
  preview: Array<{
    id: string;
    title: string;
    type: BookingType;
    customerName?: string;
    amount: number;
    color: string;
  }>;
};

export type BookingInsights = {
  generatedAt: string;
  filters: {
    month: string;
    selectedDate: string;
  };
  metrics: {
    totalBookings: number;
    totalRevenue: number;
    todayBookings: number;
    tomorrowBookings: number;
    activeAgents: number;
    averageBookingValue: number;
    byType: Record<BookingType, number>;
    byStatus: Record<string, number>;
  };
  spotlight: {
    today: BookingCard[];
    tomorrow: BookingCard[];
  };
  calendar: {
    month: string;
    days: CalendarDay[];
  };
  selectedDate: {
    date: string;
    totalBookings: number;
    sections: Record<BookingType, BookingCard[]>;
  };
};

export type AgentOverview = {
  id: string;
  agentCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  shopName?: string;
  status: string;
  joinedAt: string;
  wallet: {
    totalEarnings: number;
    pendingAmount: number;
    withdrawableAmount: number;
    lifetimeEarnings: number;
  };
  performance: {
    totalBookings: number;
    successfulBookings: number;
    cancelledBookings: number;
    conversionRate: number;
  };
  summary: {
    totalCommission: number;
    totalPaid: number;
    totalPending: number;
    bookingCount: number;
  };
};

export type AgentDetails = {
  agent: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    agentCode: string;
    shopName?: string;
    shopAddress?: string;
    status: string;
    createdAt: string;
    wallet: AgentOverview["wallet"];
    performance: AgentOverview["performance"];
    bankDetails?: {
      accountHolderName?: string;
      accountNumber?: string;
      ifscCode?: string;
      upiId?: string;
    };
  };
  summary: {
    bookingCount: number;
    totalCommission: number;
    totalPaid: number;
    totalPending: number;
    totalWithdrawn: number;
  };
  bookings: BookingCard[];
  commissions: Array<{
    _id: string;
    serviceType: string;
    totalAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    status: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    _id: string;
    amount: number;
    status: string;
    paymentMethod?: string;
    transactionId?: string;
    createdAt: string;
  }>;
};

export type AgentOperations = {
  pendingCommissions: Array<{
    _id: string;
    serviceType: string;
    totalAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    status: string;
    createdAt: string;
    agent: null | {
      id: string;
      fullName: string;
      agentCode: string;
      email: string;
      phone: string;
    };
  }>;
  withdrawalRequests: Array<{
    _id: string;
    amount: number;
    status: string;
    paymentMethod?: string;
    transactionId?: string;
    createdAt: string;
    agent: null | {
      id: string;
      fullName: string;
      agentCode: string;
      email: string;
      phone: string;
    };
  }>;
};
