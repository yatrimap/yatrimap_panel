"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildBackendUrl } from "@/lib/api-url";
import type { AgentOperations, AgentOverview } from "@/lib/admin-types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function AgentsClient() {
  const [agents, setAgents] = useState<AgentOverview[]>([]);
  const [operations, setOperations] = useState<AgentOperations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(buildBackendUrl("/admin/insights/agents"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message || "Failed to fetch agents");
          return;
        }
        setAgents(json.data);
      });

    void fetch(buildBackendUrl("/admin/insights/agent-operations"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((json) => {
        if (!json.success) {
          setError((current) => current || json.message || "Failed to fetch agent operations");
          return;
        }
        setOperations(json.data);
      });
  }, []);

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-900">
        <p className="font-medium">Live agent data is not available.</p>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">All agents</p>
          <p className="mt-3 font-serif text-4xl">{agents.length}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Total live commission</p>
          <p className="mt-3 font-serif text-4xl">
            {money.format(agents.reduce((sum, agent) => sum + agent.summary.totalCommission, 0))}
          </p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Withdrawable pool</p>
          <p className="mt-3 font-serif text-4xl">
            {money.format(agents.reduce((sum, agent) => sum + agent.wallet.withdrawableAmount, 0))}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="grid gap-5 rounded-[30px] border border-slate-200 bg-white p-5 xl:grid-cols-[1fr_0.8fr_0.3fr]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                  {agent.status}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{agent.agentCode}</span>
              </div>
              <h3 className="mt-4 font-serif text-3xl">{agent.fullName}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {agent.shopName} | {agent.city}
              </p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p>{agent.email}</p>
                  <p>{agent.phone}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p>Total bookings: {agent.summary.bookingCount}</p>
                  <p>Conversion: {agent.performance.conversionRate}%</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Commission</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{money.format(agent.summary.totalCommission)}</p>
                <p className="text-sm text-slate-500">Pending {money.format(agent.summary.totalPending)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Wallet</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {money.format(agent.wallet.withdrawableAmount)}
                </p>
                <p className="text-sm text-slate-500">Ready to settle</p>
              </div>
            </div>

            <div className="flex items-center">
              <Link
                href={`/agents/${agent.id}`}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
              >
                Open agent
              </Link>
            </div>
          </article>
        ))}
      </div>

      {operations ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Pending commissions</p>
            <div className="mt-4 space-y-3">
              {operations.pendingCommissions.map((item) => (
                <div key={item._id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{item.agent?.fullName}</span>
                    <span>{item.status}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{money.format(item.commissionAmount)}</p>
                  <p>
                    {item.serviceType} on {money.format(item.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">Payout requests</p>
            <div className="mt-4 space-y-3">
              {operations.withdrawalRequests.map((item) => (
                <div key={item._id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{item.agent?.fullName}</span>
                    <span>{item.status}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{money.format(item.amount)}</p>
                  <p>{item.paymentMethod || "BANK"}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
