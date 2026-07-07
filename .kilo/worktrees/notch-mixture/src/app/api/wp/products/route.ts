import { NextRequest, NextResponse } from "next/server";
import { wpFetch, wpFetchJson, getToken, errorResponse } from "@/lib/wp-server";
import type { WpProduct } from "@/lib/wp-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const perPage = searchParams.get("per_page") || "20";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const sku = searchParams.get("sku") || "";
    const orderby = searchParams.get("orderby") || "date";
    const order = searchParams.get("order") || "desc";

    const params = new URLSearchParams({
      page,
      per_page: perPage,
      orderby,
      order,
      context: "edit",
    });
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (sku) params.set("sku", sku);

    // Fetch products + total counts in parallel using a raw fetch to read headers.
    const res = await wpFetch(`/wc/v3/products?${params.toString()}`, token);
    const text = await res.text();
    if (!res.ok) {
      let msg = `Ошибка ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j?.message) msg = String(j.message).replace(/<[^>]+>/g, "").trim();
      } catch { /* ignore */ }
      return NextResponse.json({ error: msg }, { status: res.status });
    }
    const products: WpProduct[] = text ? JSON.parse(text) : [];
    const total = Number(res.headers.get("x-wp-total") || "0");
    const totalPages = Number(res.headers.get("x-wp-totalpages") || "0");

    return NextResponse.json({ products, total, totalPages });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const body = await req.json();
    const created = await wpFetchJson<WpProduct>(`/wc/v3/products`, token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(created);
  } catch (err) {
    return errorResponse(err);
  }
}
