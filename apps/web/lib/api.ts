'use client';

/**
 * Browser API client. NEXT_PUBLIC_API_URL is inlined into the client bundle at
 * BUILD time (pass it as a Docker build arg in production — see
 * docker-compose.yml). `next build` itself never calls the API; all requests
 * happen in the browser at runtime.
 */

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

const TOKEN_KEY = 'komuta_access_token';

let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  memoryToken = window.localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function setToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set false to suppress the automatic 401 → /login redirect. */
  redirectOn401?: boolean;
  /** Internal: prevents infinite refresh→retry loops. */
  _retried?: boolean;
}

/**
 * Single-flight silent refresh: when the short-lived access token expires, use
 * the long-lived httpOnly refresh cookie to mint a new one. Concurrent 401s
 * share one refresh call. Returns the new access token, or null on failure.
 */
let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: '{}',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken?: string };
        if (data?.accessToken) {
          setToken(data.accessToken);
          return data.accessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        // Clear after the microtask so awaiters all see the same result first.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Authenticated fetch helper. Adds the bearer token, JSON-encodes the body and,
 * on 401, transparently refreshes the access token (via the refresh cookie) and
 * retries once. Only redirects to /login when the refresh itself fails.
 */
export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, redirectOn401 = true, _retried = false, headers, ...rest } = opts;
  const token = getToken();

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Try a one-time silent refresh before giving up.
    if (!_retried) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiFetch<T>(path, { ...opts, _retried: true });
      }
    }
    setToken(null);
    if (redirectOn401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Oturum süresi doldu');
  }

  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Public fetch (no auth redirect) — used for login/refresh. */
export async function apiPublic<T = unknown>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
