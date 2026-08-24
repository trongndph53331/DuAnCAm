const deployedApiBaseUrl =
  typeof window !== "undefined" &&
  (window.location.hostname === "app.antamonline.website" ||
    window.location.hostname.endsWith(".pages.dev"))
    ? "https://antamonline.website/api/v1"
    : "/api/v1";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? deployedApiBaseUrl;

export function resolveBackendUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  if (url.startsWith("/api/v1")) {
    return `${API_BASE_URL}${url.slice("/api/v1".length)}`;
  }

  if (API_BASE_URL.startsWith("http")) {
    return new URL(url, API_BASE_URL).toString();
  }

  return url;
}

let authToken = localStorage.getItem("antam_token") ?? sessionStorage.getItem("antam_token");

export function setAuthToken(token: string | null, remember: boolean) {
  authToken = token;
  localStorage.removeItem("antam_token");
  sessionStorage.removeItem("antam_token");
  if (token) (remember ? localStorage : sessionStorage).setItem("antam_token", token);
}

async function apiResponse(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 403 && path !== "/auth/me") {
    window.dispatchEvent(new CustomEvent("antam:auth-refresh"));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `API request failed with status ${response.status}`);
  }

  return response;
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiResponse(path, init);
  if (response.status === 204) {
    throw new Error("API returned no content for a JSON request");
  }

  return response.json() as Promise<T>;
}

export async function apiCommand(path: string, init?: RequestInit): Promise<void> {
  const response = await apiResponse(path, init);
  if (response.status !== 204) {
    throw new Error(`API command expected status 204 but received ${response.status}`);
  }
}

