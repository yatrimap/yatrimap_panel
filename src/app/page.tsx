import { AdminShell } from "@/components/admin/admin-shell";
import { DashboardClient } from "@/components/admin/dashboard-client";

export default function Home() {
  return (
    <AdminShell
      title="Bookings dashboard"
      subtitle="Track rentals, hotels, activities, and packages in one smart operations view. Use the date tabs, monthly booking calendar, and detailed action cards to manage the day."
    >
      <DashboardClient />
    </AdminShell>
  );
}
