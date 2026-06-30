const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "change-me-in-production";

const ACCESS_TOKEN_KEY = "estia-menage_access_token";
const REFRESH_TOKEN_KEY = "estia-menage_refresh_token";

const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (!isBrowser) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (!isBrowser) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  statusCode: number;
  body: unknown;

  constructor(statusCode: number, message: string, body: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
  }
}

const MAX_429_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Délai d'attente sur une réponse 429 (rate-limit) : respecte l'en-tête
 * `Retry-After` (en secondes) renvoyé par l'API, sinon backoff exponentiel
 * plafonné (1s, 2s, 4s…).
 */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new ApiError(401, "No refresh token", null);

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        throw new ApiError(401, "Refresh token expired", null);
      }

      const data = (await response.json()) as { access_token: string; refresh_token: string };
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retry?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, skipAuth = false, retry = true } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    ...headers,
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const requestInit: RequestInit = {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response = await fetch(`${API_URL}${path}`, requestInit);

  // Retry sur 429 (rate-limit) : on attend (Retry-After ou backoff) puis on
  // retente, pour absorber les pics d'envoi groupé sans faire échouer la requête.
  for (let attempt = 0; response.status === 429 && retry && attempt < MAX_429_RETRIES; attempt++) {
    await sleep(retryDelayMs(response, attempt));
    response = await fetch(`${API_URL}${path}`, requestInit);
  }

  if (response.status === 401 && retry && !skipAuth) {
    try {
      const newToken = await refreshAccessToken();
      finalHeaders["Authorization"] = `Bearer ${newToken}`;
      const retried = await fetch(`${API_URL}${path}`, {
        method,
        headers: finalHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(retried);
    } catch {
      clearTokens();
      if (isBrowser && !path.startsWith("/auth/")) {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Unauthorized", null);
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const m = (parsed as { message?: unknown }).message;
      if (typeof m === "string" && m.length > 0) message = m;
    }
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}

export { API_URL };
