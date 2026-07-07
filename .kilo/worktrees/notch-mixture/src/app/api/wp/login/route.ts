import { NextRequest, NextResponse } from "next/server";
import { WP_BASE, errorResponse, WpError } from "@/lib/wp-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      throw new WpError("Введите имя пользователя и пароль", 400, "missing_credentials");
    }
    const res = await fetch(`${WP_BASE}/jwt-auth/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
    }
    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message).replace(/<[^>]+>/g, "").trim()
          : "Ошибка входа");
      throw new WpError(msg, res.status, (data as { code?: string })?.code);
    }
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
