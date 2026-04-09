import { proxyBackend } from "@/lib/backend-proxy";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ commissionId: string }> },
) {
  const { commissionId } = await context.params;
  const body = await request.json();

  try {
    const backend = await proxyBackend(`/admin/insights/commissions/${commissionId}/status`, {
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
      _id: commissionId,
      status: body.status,
    },
  });
}
