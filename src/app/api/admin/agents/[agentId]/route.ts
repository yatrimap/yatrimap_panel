import { proxyBackend } from "@/lib/backend-proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await context.params;

  try {
    const backend = await proxyBackend(
      `/admin/insights/agents/${agentId}`,
      undefined,
      new Headers(request.headers),
    );
    return Response.json(backend);
  } catch (error) {
    return Response.json(
      {
        success: false,
        source: "backend",
        message: error instanceof Error ? error.message : "Failed to fetch agent details",
        data: null,
      },
      { status: 502 },
    );
  }
}
