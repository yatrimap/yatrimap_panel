import { proxyBackend } from "@/lib/backend-proxy";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ type: string; bookingId: string }> },
) {
  const { type, bookingId } = await context.params;
  const body = await request.json();

  try {
    const backend = await proxyBackend(`/admin/insights/bookings/${type}/${bookingId}/note`, {
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
      id: bookingId,
      type,
      source: body.source,
      notes: body.note || "",
    },
  });
}
