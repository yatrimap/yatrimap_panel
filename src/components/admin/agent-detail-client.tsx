"use client";

import { useEffect, useState } from "react";
import type { AgentDetails } from "@/lib/admin-types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function AgentDetailClient({ agentId }: { agentId: string }) {
  const [data, setData] = useState<AgentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch(`/api/admin/agents/${agentId}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) {
      setData(null);
      setError(json.message || "Failed to fetch agent details");
      return;
    }
    setError(null);
    setData(json.data);
  };

  useEffect(() => {
    const loadAgent = async () => {
      const response = await fetch(`/api/admin/agents/${agentId}`, { cache: "no-store" });
      const json = await response.json();
      setData(json.data);
    };

    void loadAgent();
  }, [agentId]);

  const updateCommission = async (commissionId: string, status: string) => {
    await fetch(`/api/admin/commissions/${commissionId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const updateWithdrawal = async (withdrawalId: string, status: string) => {
    await fetch(`/api/admin/withdrawals/${withdrawalId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        transactionId: status === "PAID" ? `MANUAL-PAYOUT-${withdrawalId}` : "",
      }),
    });
    await load();
  };

  if (!data) {
    if (error) {
      return (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          <p className="font-medium">Live agent detail is not available.</p>
          <p className="mt-2">{error}</p>
        </div>
      );
    }
    return <div className="rounded-[28px] bg-slate-100 p-6 text-sm text-slate-600">Loading agent details...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:col-span-2">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Agent profile</p>
          <h3 className="mt-3 font-serif text-4xl">{data.agent.fullName}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {data.agent.shopName} | {data.agent.city} | {data.agent.agentCode}
          </p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4">
              <p>{data.agent.email}</p>
              <p>{data.agent.phone}</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p>Status: {data.agent.status}</p>
              <p>Joined: {new Date(data.agent.createdAt).toLocaleDateString("en-IN")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Total commission</p>
          <p className="mt-3 font-serif text-4xl">{money.format(data.summary.totalCommission)}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Paid out</p>
          <p className="mt-3 font-serif text-4xl">{money.format(data.summary.totalPaid)}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Agent bookings</p>
          <div className="mt-5 space-y-3">
            {data.bookings.map((booking) => (
              <div key={booking.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                    style={{ backgroundColor: `${booking.color}22`, color: booking.color }}
                  >
                    {booking.label}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{booking.status}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{booking.title}</p>
                    <p className="text-sm text-slate-500">
                      {booking.customer.name} | {new Date(booking.bookingDate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">{money.format(booking.amount)}</p>
                    <p className="text-sm text-slate-500">
                      Commission {money.format(booking.commission?.commissionAmount || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Commission trail</p>
            <div className="mt-4 space-y-3">
              {data.commissions.map((item) => (
                <div key={item._id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{item.serviceType}</span>
                    <span>{item.status}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{money.format(item.commissionAmount)}</p>
                  <p>{item.commissionPercentage}% on {money.format(item.totalAmount)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateCommission(item._id, "APPROVED")}
                      className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateCommission(item._id, "PAID")}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    >
                      Mark paid
                    </button>
                    <button
                      onClick={() => updateCommission(item._id, "REJECTED")}
                      className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Payout requests</p>
            <div className="mt-4 space-y-3">
              {data.withdrawals.map((item) => (
                <div key={item._id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{item.paymentMethod || "BANK"}</span>
                    <span>{item.status}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{money.format(item.amount)}</p>
                  <p>{new Date(item.createdAt).toLocaleDateString("en-IN")}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateWithdrawal(item._id, "APPROVED")}
                      className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateWithdrawal(item._id, "PAID")}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    >
                      Confirm payout
                    </button>
                    <button
                      onClick={() => updateWithdrawal(item._id, "REJECTED")}
                      className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              Internal note: agent wallet and payout decisions.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
