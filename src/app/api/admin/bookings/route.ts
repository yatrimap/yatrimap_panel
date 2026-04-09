import { proxyBackend } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  console.log(`Fetching bookings for month: ${month}, date: ${date}`);

  try {
    const backend = await proxyBackend(
      `/admin/insights/bookings?month=${month}&date=${date}`,
      undefined,
      new Headers(request.headers),
    );
    return Response.json(backend);
  } catch (error) {
    return Response.json(
      {
        success: false,
        source: "backend",
        message: error instanceof Error ? error.message : "Failed to fetch live bookings",
        data: null,
      },
      { status: 502 },
    );
  }
}
