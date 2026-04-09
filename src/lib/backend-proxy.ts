const getBaseUrl = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const getToken = () => process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

export async function proxyBackend(
  path: string,
  init?: RequestInit,
  requestHeaders?: Headers,
) {
  const baseUrl = getBaseUrl();
  const token = getToken();

  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");

  const incomingAuth = requestHeaders?.get("authorization");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (incomingAuth) {
    headers.set("Authorization", incomingAuth);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Backend request failed with ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody?.message || errorBody?.error || message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  return response.json();
}
