import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  saveAuthSession,
  type AuthSession,
} from "./auth-session";

let refreshRequest: Promise<AuthSession> | null = null;
const REFRESH_TIMEOUT_MS = 10_000;

function withAccessToken(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function isApiRequest(apiUrl: string, input: RequestInfo | URL): boolean {
  try {
    const api = new URL(apiUrl);
    const request = new URL(requestUrl(input), api);
    const apiPath = api.pathname.replace(/\/$/, "");
    return request.origin === api.origin
      && (request.pathname === apiPath || request.pathname.startsWith(`${apiPath}/`));
  } catch {
    return false;
  }
}

async function refreshSession(apiUrl: string): Promise<AuthSession> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Session refresh timed out", "TimeoutError")),
    REFRESH_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await globalThis.fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
  const url = requestUrl(input);
  const targetsApi = isApiRequest(apiUrl, input);
  const isAuthRequest =
    url.includes("/auth/login") || url.includes("/auth/register");
  const response = await globalThis.fetch(
    input,
    targetsApi ? withAccessToken(init, getAccessToken()) : init,
  );

  if (response.status !== 401 || isAuthRequest || !targetsApi) return response;

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
