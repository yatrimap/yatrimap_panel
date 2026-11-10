import { AdminShell } from "@/components/admin/admin-shell";
import { CustomerDetailClient } from "@/components/admin/customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell
      title="Customer"
      subtitle="Bookings with review status, explorer profile, trip offers and the WhatsApp log for one traveller."
    >
      <CustomerDetailClient customerId={id} />
    </AdminShell>
  );
}
