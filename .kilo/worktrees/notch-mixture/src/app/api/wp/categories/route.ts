import { NextRequest, NextResponse } from "next/server";
import { wpFetch, getToken, errorResponse } from "@/lib/wp-server";
import type { WpCategory } from "@/lib/wp-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const { searchParams } = new URL(req.url);
    const perPage = searchParams.get("per_page") || "100";
    const page = searchParams.get("page") || "1";
    const search = searchParams.get("search") || "";
    const hideEmpty = searchParams.get("hide_empty") === "true";

    // Fetch all categories by paginating (WooCommerce caps per_page at 100).
    const allCategories: WpCategory[] = [];
    let totalPages = 1;
    let p = Number(page);

    if (search || hideEmpty) {
      const params = new URLSearchParams({ per_page: perPage, page: String(p) });
      if (search) params.set("search", search);
      if (hideEmpty) params.set("hide_empty", "true");
      const res = await wpFetch(`/wc/v3/products/categories?${params.toString()}`, token);
      const text = await res.text();
      if (!res.ok) {
        return NextResponse.json({ error: `Ошибка ${res.status}` }, { status: res.status });
      }
      const cats: WpCategory[] = text ? JSON.parse(text) : [];
      allCategories.push(...cats);
      totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
    } else {
      // Fetch everything (cap at 1000 to be safe).
      do {
        const params = new URLSearchParams({ per_page: "100", page: String(p), order: "asc", orderby: "name" });
        const res = await wpFetch(`/wc/v3/products/categories?${params.toString()}`, token);
        const text = await res.text();
        if (!res.ok) {
          return NextResponse.json({ error: `Ошибка ${res.status}` }, { status: res.status });
        }
        const cats: WpCategory[] = text ? JSON.parse(text) : [];
        allCategories.push(...cats);
        totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
        p++;
      } while (p <= totalPages && allCategories.length < 1000);
    }

    return NextResponse.json({
      categories: allCategories,
      total: allCategories.length,
      totalPages,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
