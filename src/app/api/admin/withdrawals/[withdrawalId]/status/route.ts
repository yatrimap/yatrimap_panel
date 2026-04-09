import { proxyBackend } from "@/lib/backend-proxy";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ withdrawalId: string }> },
) {
  const { withdrawalId } = await context.params;
  const body = await request.json();

  try {
    const backend = await proxyBackend(`/admin/insights/withdrawals/${withdrawalId}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (backend) {
      return Response.json(backend);
    }
  } catch {
    // Keep UI responsive in mock mode.
  }

  return Response.json({
    success: true,
    source: "mock",
    data: {
      _id: withdrawalId,
      status: body.status,
      transactionId: body.transactionId || "",
    },
  });
}
