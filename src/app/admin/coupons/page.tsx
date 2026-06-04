import { AdminShell } from "@/components/admin/admin-shell";
import { CouponsClient } from "@/components/admin/coupons-client";

export default function CouponsPage() {
  return (
    <AdminShell title="Coupons" subtitle="Create one-time or permanent coupons for users.">
      <CouponsClient />
    </AdminShell>
  );
}
