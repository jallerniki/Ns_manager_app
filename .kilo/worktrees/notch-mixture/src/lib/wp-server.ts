import { NextRequest, NextResponse } from "next/server";

export const WP_BASE = "https://nstkani.ru/wp-json";

export class WpError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Extract Bearer token from an incoming request header. */
export function getToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new WpError("Не авторизован", 401, "no_token");
  }
  return auth.slice(7);
}

/** Forward a request to WordPress REST API with the JWT bearer token. */
export async function wpFetch(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${WP_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string>),
  };
  // Let body set its own content-type when it's a body (FormData etc.)
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  return res;
}

/** wpFetch that parses JSON and throws WpError on non-2xx. */
export async function wpFetchJson<T = unknown>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await wpFetch(path, token, init);
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `WordPress error ${res.status}`) || `Ошибка ${res.status}`;
    throw new WpError(msg, res.status, (data as { code?: string })?.code);
  }
  return data as T;
}

/** Build a standard JSON error response. */
export function errorResponse(err: unknown) {
  if (err instanceof WpError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Внутренняя ошибка сервера";
  return NextResponse.json({ error: message }, { status: 500 });
}
