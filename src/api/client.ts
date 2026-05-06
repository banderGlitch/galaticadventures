/**
 * Thin fetch wrapper for the Asteroid Dodger backend.
 *
 * Responsibilities:
 *   1. Resolve the API base URL (`VITE_API_BASE_URL` or hardcoded Railway prod).
 *   2. Inject the `X-Telegram-Init-Data` header on every request so the
 *      server can authenticate the caller via HMAC.
 *   3. Map non-2xx responses into a typed `ApiError` so callers can
 *      distinguish auth/anti-cheat/network failures.
 *
 * The client is *intentionally* dumb: no retries, no caching, no React
 * coupling. Higher-level hooks compose on top of it.
 */

import type {
  ApiLeaderboardResponse,
  ApiMeResponse,
  ApiRunEndRequest,
  ApiRunEndResponse,
  ApiRunStartResponse,
} from "./types";

const ENV_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
/** Production API (Railway). Override with `VITE_API_BASE_URL` for local backends. */
const DEFAULT_PRODUCTION_BASE =
  "https://telegrambackend-production-5a1e.up.railway.app";

function getBaseUrl(): string {
  // Strip trailing slash so we can concatenate "/api/..." cleanly.
  const raw = (
    ENV_BASE && ENV_BASE.length > 0 ? ENV_BASE : DEFAULT_PRODUCTION_BASE
  ).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getInitData(): string | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  // `initData` is the raw query string we need to forward to the server.
  // `initDataUnsafe` is the parsed JSON; never send that.
  const raw = tg?.initData ?? "";
  return raw.length > 0 ? raw : null;
}

/**
 * `true` when the bundle was loaded from inside a real Telegram client AND
 * has signed initData. False otherwise (browser preview, ngrok dev, etc.).
 * Useful for UIs that want to behave differently when offline-only.
 */
export function hasTelegramAuth(): boolean {
  return getInitData() !== null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {};
  const initData = getInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // We don't use cookies; this also avoids CORS preflight in some setups.
      credentials: "omit",
    });
  } catch (err) {
    // Network-level failure (DNS, offline, CORS preflight failure, …).
    throw new ApiError(
      err instanceof Error ? err.message : "network error",
      0,
      null,
    );
  }

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    throw new ApiError(`HTTP ${res.status}`, res.status, detail);
  }

  // 204 No Content — the GameOver path doesn't expect this today, but be safe.
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  me(): Promise<ApiMeResponse> {
    return request<ApiMeResponse>("GET", "/api/me");
  },

  startRun(): Promise<ApiRunStartResponse> {
    return request<ApiRunStartResponse>("POST", "/api/runs/start");
  },

  endRun(payload: ApiRunEndRequest): Promise<ApiRunEndResponse> {
    return request<ApiRunEndResponse>("POST", "/api/runs/end", payload);
  },

  leaderboard(limit = 50): Promise<ApiLeaderboardResponse> {
    return request<ApiLeaderboardResponse>(
      "GET",
      `/api/leaderboard?limit=${limit}`,
    );
  },

  /** True when the API base resolves to localhost — used by the UI to soften
   *  the "backend offline" message during local dev. */
  isLocal(): boolean {
    return getBaseUrl().includes("127.0.0.1") || getBaseUrl().includes("localhost");
  },
};
