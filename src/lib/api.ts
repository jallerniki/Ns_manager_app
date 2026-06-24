"use client";

import { getAuthToken } from "@/stores/auth";
import type {
  WpProduct,
  WpProductsResponse,
  WpCategory,
  WpUser,
} from "@/lib/wp-types";

const WP_BASE =
  process.env.NEXT_PUBLIC_WP_BASE || "https://nstkani.ru/wp-json";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractError(text: string, status: number): string {
  try {
    const j = JSON.parse(text);
    if (j?.message) return String(j.message).replace(/<[^>]+>/g, "").trim();
    if (j?.error) return String(j.error).replace(/<[^>]+>/g, "").trim();
  } catch {
    /* ignore */
  }
  return `Ошибка ${status}`;
}

async function wpRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${WP_BASE}${path}`, { ...init, headers, cache: "no-store" });
}

async function wpJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await wpRaw(path, init);
  const text = await res.text();
  if (!res.ok) throw new ApiError(extractError(text, res.status), res.status);
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  login: (username: string, password: string) =>
    wpJson<WpUser>("/jwt-auth/v1/token", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  async listProducts(params: {
    page?: number;
    per_page?: number;
    search?: string;
    category?: string;
    status?: string;
    sku?: string;
    orderby?: string;
    order?: "asc" | "desc";
  }): Promise<WpProductsResponse> {
    const q = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 20),
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
      context: "edit",
    });
    if (params.search) q.set("search", params.search);
    if (params.category) q.set("category", params.category);
    if (params.status) q.set("status", params.status);
    if (params.sku) q.set("sku", params.sku);

    const res = await wpRaw(`/wc/v3/products?${q.toString()}`);
    const text = await res.text();
    if (!res.ok) throw new ApiError(extractError(text, res.status), res.status);
    const products: WpProduct[] = text ? JSON.parse(text) : [];
    return {
      products,
      total: Number(res.headers.get("x-wp-total") || "0"),
      totalPages: Number(res.headers.get("x-wp-totalpages") || "0"),
    };
  },

  getProduct: (id: number) =>
    wpJson<WpProduct>(`/wc/v3/products/${id}?context=edit`),

  updateProduct: (id: number, data: Partial<WpProduct>) =>
    wpJson<WpProduct>(`/wc/v3/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createProduct: (data: Partial<WpProduct>) =>
    wpJson<WpProduct>("/wc/v3/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: number, force = true) =>
    wpJson<{ deleted: boolean }>(`/wc/v3/products/${id}?force=${force}`, {
      method: "DELETE",
    }),

  async listCategories(params?: {
    per_page?: number;
    search?: string;
    hide_empty?: boolean;
  }): Promise<{ categories: WpCategory[]; total: number; totalPages: number }> {
    const perPage = params?.per_page ?? 100;
    const search = params?.search ?? "";
    const hideEmpty = !!params?.hide_empty;

    if (search || hideEmpty) {
      const q = new URLSearchParams({
        per_page: String(perPage),
        page: "1",
      });
      if (search) q.set("search", search);
      if (hideEmpty) q.set("hide_empty", "true");
      const res = await wpRaw(`/wc/v3/products/categories?${q.toString()}`);
      const text = await res.text();
      if (!res.ok) throw new ApiError(extractError(text, res.status), res.status);
      const categories: WpCategory[] = text ? JSON.parse(text) : [];
      return {
        categories,
        total: categories.length,
        totalPages: Number(res.headers.get("x-wp-totalpages") || "1"),
      };
    }

    const all: WpCategory[] = [];
    let p = 1;
    let totalPages = 1;
    do {
      const q = new URLSearchParams({
        per_page: "100",
        page: String(p),
        order: "asc",
        orderby: "name",
      });
      const res = await wpRaw(`/wc/v3/products/categories?${q.toString()}`);
      const text = await res.text();
      if (!res.ok) throw new ApiError(extractError(text, res.status), res.status);
      const cats: WpCategory[] = text ? JSON.parse(text) : [];
      all.push(...cats);
      totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
      p++;
    } while (p <= totalPages && all.length < 1000);

    return { categories: all, total: all.length, totalPages };
  },

  async uploadMedia(
    file: File,
    productId?: number
  ): Promise<{ id: number; source_url: string; title: { rendered: string } }> {
    const token = getAuthToken();
    const filename = (file.name || "upload.jpg").replace(/[^\w.\-]+/g, "_");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": file.type || "application/octet-stream",
    };
    if (productId) headers["X-WP-Parent"] = String(productId);

    const res = await fetch(`${WP_BASE}/wp/v2/media`, {
      method: "POST",
      headers,
      body: file,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError(extractError(text, res.status), res.status);
    return text ? JSON.parse(text) : {};
  },

  deleteMedia: (id: number) =>
    wpJson<{ deleted: boolean }>(`/wp/v2/media/${id}?force=true`, {
      method: "DELETE",
    }),
};
