import { ApiClient, ApiError } from './api-client';

jest.mock('./auth-fetch', () => ({
  authenticatedFetch: jest.fn((_: string, input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init),
  ),
}));

describe('ApiClient', () => {
  const client = new ApiClient('http://localhost/api', { retryDelayMs: 0 });

  function response(status: number, body?: unknown, statusText = ''): Response {
    const value = {
      status,
      statusText,
      ok: status >= 200 && status < 300,
      json: async () => body,
      clone: () => value,
    };
    return value as Response;
  }

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it('returns typed JSON and supplies the JSON content type', async () => {
    const fetchMock = jest.mocked(globalThis.fetch).mockResolvedValue(response(200, { id: 'sheet-1' }));

    const result = await client.request<{ id: string }>('/sheets', {
      method: 'POST',
      body: JSON.stringify({ name: 'Budget' }),
    });

    expect(result.id).toBe('sheet-1');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Content-Type')).toBe('application/json');
  });

  it('retries safe requests after transient server errors', async () => {
    const fetchMock = jest.mocked(globalThis.fetch)
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(client.request<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry mutations by default and exposes structured errors', async () => {
    const fetchMock = jest.mocked(globalThis.fetch).mockResolvedValue(
      response(400, { message: ['Name is required'], code: 'VALIDATION' }, 'Bad Request'),
    );

    const error = await client.request('/sheets', { method: 'POST' }).catch((reason) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Name is required', body: { code: 'VALIDATION' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors caller cancellation', async () => {
    jest.mocked(globalThis.fetch).mockImplementation((_, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
    );
    const controller = new AbortController();
    const pending = client.request('/slow', { signal: controller.signal, retries: 0 });
    controller.abort(new DOMException('Cancelled', 'AbortError'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
