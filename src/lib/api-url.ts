const DEFAULT_API_URL = "http://localhost:5000";

const trimBaseUrl = (value?: string | null) => value?.trim().replace(/\/$/, "") || "";

const normalizeBackendBaseUrl = (value: string) => value.replace(/\/api\/v1\/?$/, "");

export const getBackendBaseUrl = () =>
  normalizeBackendBaseUrl(
    trimBaseUrl(
      process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        DEFAULT_API_URL,
    ),
  );

export const getApiV1BaseUrl = () => `${getBackendBaseUrl()}/api/v1`;

export const buildBackendUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendBaseUrl()}${normalizedPath}`;
};

// The admin insights API needs the admin login token (same one the login page saves).
export const adminAuthHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("admintoken") : null;
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
