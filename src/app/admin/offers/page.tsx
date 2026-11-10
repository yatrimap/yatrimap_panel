import { AdminShell } from "@/components/admin/admin-shell";
import { OffersClient } from "@/components/admin/offers-client";

export default function OffersPage() {
  return (
    <AdminShell
      title="Trip offers"
      subtitle="Packages made for customers: who opened, accepted or let them expire. Tap Done on an accepted offer to book it (advance on our QR) or ask for the advance online."
    >
      <OffersClient />
    </AdminShell>
  );
}
