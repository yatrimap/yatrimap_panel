import { AdminShell } from "@/components/admin/admin-shell";
import { AgentsClient } from "@/components/admin/agents-client";

export default function AgentsPage() {
  return (
    <AdminShell
      title="Agents performance board"
      subtitle="See every agent, their booking production, commission balance, and wallet readiness from one simple view."
    >
      <AgentsClient />
    </AdminShell>
  );
}
