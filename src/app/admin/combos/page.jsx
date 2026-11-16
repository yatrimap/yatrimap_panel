import { AdminShell } from "@/components/admin/admin-shell";
import { CombosClient } from "@/components/admin/combos-client";

export default function CombosPage() {
  return (
    <AdminShell
      title="Combo packages"
      subtitle="Ready-made packages customers book on TouristGo → Offers. They pay the advance online; you then pick the hotel and companies, split the advance and confirm."
    >
      <CombosClient />
    </AdminShell>
  );
}
