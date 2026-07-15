import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  saveAuthSession,
  type AuthSession,
} from "./auth-session";

let refreshRequest: Promise<AuthSession> | null = null;

function withAccessToken(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

async function refreshSession(apiUrl: string): Promise<AuthSession> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await globalThis.fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) throw new Error("Session refresh failed");
  const session = (await response.json()) as AuthSession;
  saveAuthSession(session);
  return session;
}

export async function authenticatedFetch(
  apiUrl: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const requestUrl = String(input);
  const isAuthRequest =
    requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");
  const response = await globalThis.fetch(
    input,
    withAccessToken(init, getAccessToken()),
  );

  if (response.status !== 401 || isAuthRequest) return response;

  try {
    refreshRequest ??= refreshSession(apiUrl).finally(() => {
      refreshRequest = null;
    });
    const session = await refreshRequest;
    return globalThis.fetch(input, withAccessToken(init, session.accessToken));
  } catch {
    clearAuthSession();
    return response;
  }
}
