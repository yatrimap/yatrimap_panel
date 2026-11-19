import { AdminShell } from "@/components/admin/admin-shell";
import { RentalHubsClient } from "@/components/admin/rental-hubs-client";

export default function RentalHubsPage() {
  return (
    <AdminShell
      title="Rental hubs"
      subtitle="Add and edit rental hubs, the vehicle models they rent, each hub's online advance and deposit, and the owner logins for the TouristGo hub dashboard (touristgo.in/hub)."
    >
      <RentalHubsClient />
    </AdminShell>
  );
}
