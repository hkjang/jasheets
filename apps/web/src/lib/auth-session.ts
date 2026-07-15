export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  isAdmin?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function saveAuthSession(session: AuthSession): void {
  const target = storage();
  if (!target) return;

  target.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  target.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  target.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearAuthSession(): void {
  const target = storage();
  if (!target) return;

  target.removeItem(ACCESS_TOKEN_KEY);
  target.removeItem(REFRESH_TOKEN_KEY);
  target.removeItem(USER_KEY);
}
