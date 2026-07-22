import { authenticatedFetch } from "./auth-fetch";
import { saveAuthSession } from "./auth-session";

const API_URL = "http://localhost:4000/api";

function response(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("authenticatedFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("adds the current access token", async () => {
    saveAuthSession({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: { id: "1", email: "user@example.com" },
    });
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    globalThis.fetch = fetchMock;

    await authenticatedFetch(API_URL, `${API_URL}/sheets`);

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("never sends API credentials or refreshes sessions for external URLs", async () => {
    saveAuthSession({
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      user: { id: "1", email: "user@example.com" },
    });
    const fetchMock = jest.fn().mockResolvedValue(response(401));
    globalThis.fetch = fetchMock;

    const result = await authenticatedFetch(API_URL, "https://example.com/webhook");

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("Authorization")).toBe(false);
    expect(localStorage.getItem("auth_token")).toBe("secret-access");
  });

  it("refreshes once after a 401 and retries with the new token", async () => {
    saveAuthSession({
      accessToken: "expired",
      refreshToken: "refresh-1",
      user: { id: "1", email: "user@example.com" },
    });
    const refreshed = {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      user: { id: "1", email: "user@example.com" },
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, refreshed))
      .mockResolvedValueOnce(response(200));
    globalThis.fetch = fetchMock;

    const result = await authenticatedFetch(API_URL, `${API_URL}/sheets`);

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer access-2");
    expect(localStorage.getItem("refresh_token")).toBe("refresh-2");
  });

  it("clears the session when refresh fails", async () => {
    saveAuthSession({
      accessToken: "expired",
      refreshToken: "invalid",
      user: { id: "1", email: "user@example.com" },
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    globalThis.fetch = fetchMock;

    const result = await authenticatedFetch(API_URL, `${API_URL}/sheets`);

    expect(result.status).toBe(401);
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("stops waiting and clears the session when refresh times out", async () => {
    jest.useFakeTimers();
    saveAuthSession({
      accessToken: "expired",
      refreshToken: "refresh-1",
      user: { id: "1", email: "user@example.com" },
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockImplementationOnce((_: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
      );
    globalThis.fetch = fetchMock;

    const pending = authenticatedFetch(API_URL, `${API_URL}/sheets`);
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toMatchObject({ status: 401 });
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    jest.useRealTimers();
  });
});
