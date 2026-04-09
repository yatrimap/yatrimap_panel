import { proxyBackend } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  try {
    const backend = await proxyBackend(
      "/admin/insights/agent-operations",
      undefined,
      new Headers(request.headers),
    );
    return Response.json(backend);
  } catch (error) {
    return Response.json(
      {
        success: false,
        source: "backend",
        message: error instanceof Error ? error.message : "Failed to fetch agent operations",
        data: null,
      },
      { status: 502 },
    );
  }
}
