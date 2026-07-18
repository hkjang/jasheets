import { authenticatedFetch } from './auth-fetch';

export interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: ApiErrorBody | null,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function combineSignals(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener('abort', abort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    },
  };
}

async function fetchWithPolicy(
  apiUrl: string,
  input: RequestInfo | URL,
  options: ApiRequestOptions = {},
  defaults: Pick<ApiRequestOptions, 'timeoutMs' | 'retries' | 'retryDelayMs'> = {},
): Promise<Response> {
  const {
    timeoutMs = defaults.timeoutMs ?? 15_000,
    retries,
    retryDelayMs = defaults.retryDelayMs ?? 150,
    ...init
  } = options;
  const method = (init.method || 'GET').toUpperCase();
  const attempts = retries ?? (RETRYABLE_METHODS.has(method) ? defaults.retries ?? 2 : 0);

  for (let attempt = 0; ; attempt += 1) {
    const combined = combineSignals(init.signal, timeoutMs);
    try {
      const response = await authenticatedFetch(apiUrl, input, { ...init, signal: combined.signal });
      if (attempt < attempts && RETRYABLE_STATUSES.has(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      if (combined.signal.aborted || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
    } finally {
      combined.dispose();
    }
  }
}

async function errorFromResponse(response: Response, url: string): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.clone().json()) as ApiErrorBody;
  } catch {
    // Non-JSON failures still receive a consistent error shape.
  }
  const detail = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  return new ApiError(detail || body?.error || response.statusText || 'API request failed', response.status, body, url);
}

export class ApiClient {
  constructor(
    readonly baseUrl: string,
    private readonly defaults: Pick<ApiRequestOptions, 'timeoutMs' | 'retries' | 'retryDelayMs'> = {},
  ) {}

  url(path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async fetch(path: string, options: ApiRequestOptions = {}): Promise<Response> {
    const url = this.url(path);
    return fetchWithPolicy(this.baseUrl, url, options, this.defaults);
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const url = this.url(path);
    const response = await this.fetch(path, { ...options, headers });
    if (!response.ok) throw await errorFromResponse(response, url);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const apiClient = new ApiClient(API_URL);

/**
 * Fetches absolute or same-origin URLs without changing them while applying the
 * same authentication, timeout, cancellation, and safe retry policy as ApiClient.
 */
export function boundedFetch(input: RequestInfo | URL, options: ApiRequestOptions = {}) {
  return fetchWithPolicy(API_URL, input, options);
}
