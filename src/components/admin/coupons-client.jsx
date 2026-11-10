"use client";

import { useEffect, useState } from "react";

export function CouponsClient() {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(0);
  const [isOneTime, setIsOneTime] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('admintoken') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API}/admin-coupon`, { credentials: 'include', headers });
      const json = await res.json();
      if (json.success) setCoupons(json.data || []);
      else if (json.status === 'UNAUTHORIZED') {
        alert(json.message || 'Not authorized. Please login as admin.');
      }
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('admintoken') : null;
      if (!token) { alert('Admin token missing. Please login.'); setLoading(false); return; }
      const res = await fetch(`${API}/admin-coupon`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.toUpperCase(), amount, isOneTime })
      });
      const json = await res.json();
      if (json.success) {
        setCode(''); setAmount(0); setIsOneTime(true);
        fetchCoupons();
      } else {
        if (json.status === 'UNAUTHORIZED') alert(json.message || 'Not authorized.');
        else alert(json.message || 'Failed');
      }
    } catch (err) { console.error(err); alert('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="text-xs font-bold text-slate-500">Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-400" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">Amount (INR)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
        </div>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={isOneTime} onChange={(e) => setIsOneTime(e.target.checked)} /> One-time</label>
          <button className="ml-auto rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Create</button>
        </div>
      </form>

      <div>
        <h3 className="font-bold mb-2">Existing Coupons</h3>
        <div className="space-y-2">
          {loading ? <div>Loading...</div> : (
            coupons.map(c => (
              <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5">
                <div>
                  <div className="font-bold">{c.code}</div>
                  <div className="text-xs text-slate-500">₹{c.amount} • {c.isOneTime ? 'One-time' : 'Permanent'}</div>
                </div>
                <div className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
