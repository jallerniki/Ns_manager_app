import { NextRequest, NextResponse } from "next/server";
import { wpFetch, getToken, errorResponse } from "@/lib/wp-server";

export const runtime = "nodejs";

/** List media, optionally filtered by parent product. */
export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const { searchParams } = new URL(req.url);
    const parent = searchParams.get("parent") || "";
    const perPage = searchParams.get("per_page") || "50";
    const params = new URLSearchParams({ per_page: perPage, context: "edit" });
    if (parent) params.set("parent", parent);
    const res = await wpFetch(`/wp/v2/media?${params.toString()}`, token);
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Ошибка ${res.status}` }, { status: res.status });
    }
    const data = text ? JSON.parse(text) : [];
    return NextResponse.json({ media: data });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Upload a media file (multipart/form-data with a `file` field). */
export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const productId = (form.get("product_id") as string | null) || "";
    if (!file) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = (file.name || "upload.jpg").replace(/[^\w.\-]+/g, "_");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": file.type || "application/octet-stream",
    };
    if (productId) headers["X-WP-Parent"] = productId;

    const res = await fetch(`https://nstkani.ru/wp-json/wp/v2/media`, {
      method: "POST",
      headers,
      body: buffer,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `Ошибка ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j?.message) msg = String(j.message).replace(/<[^>]+>/g, "").trim();
      } catch { /* ignore */ }
      return NextResponse.json({ error: msg }, { status: res.status });
    }
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
