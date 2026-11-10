import { AdminShell } from "@/components/admin/admin-shell";
import { CustomersClient } from "@/components/admin/customers-client";

export default function CustomersPage() {
  return (
    <AdminShell
      title="Customers"
      subtitle="Every traveller, past and new: what they booked, where and when, reviews, explorer status and smart segments. Pick customers to send a trip offer or an Explorer invite."
    >
      <CustomersClient />
    </AdminShell>
  );
}
