export const API_BASE = "";

export function getToken() {
  return localStorage.getItem("rack-token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("rack-token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new Error((await response.json().catch(() => null))?.message ?? "API request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
