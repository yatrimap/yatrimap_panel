import { AdminShell } from "@/components/admin/admin-shell";
import { AgentDetailClient } from "@/components/admin/agent-detail-client";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  return (
    <AdminShell
      title="Agent detail workspace"
      subtitle="Inspect an individual agent, the bookings they created, commission lines, payout history, and internal follow-up context."
    >
      <AgentDetailClient agentId={agentId} />
    </AdminShell>
  );
}
