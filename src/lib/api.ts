"use client";

import { getAuthToken } from "@/stores/auth";
import type {
  WpProduct,
  WpProductsResponse,
  WpCategory,
  WpUser,
} from "@/lib/wp-types";

const BASE = "/api/wp";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
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
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Ошибка ${res.status}`) || `Ошибка ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<WpUser>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  listProducts: (params: {
    page?: number;
    per_page?: number;
    search?: string;
    category?: string;
    status?: string;
    sku?: string;
    orderby?: string;
    order?: "asc" | "desc";
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "")
        q.set(k, String(v));
    });
    return request<WpProductsResponse>(`/products?${q.toString()}`);
  },

  getProduct: (id: number) => request<WpProduct>(`/products/${id}`),

  updateProduct: (id: number, data: Partial<WpProduct>) =>
    request<WpProduct>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createProduct: (data: Partial<WpProduct>) =>
    request<WpProduct>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: number, force = true) =>
    request<{ deleted: boolean }>(`/products/${id}?force=${force}`, {
      method: "DELETE",
    }),

  listCategories: (params?: { per_page?: number; search?: string; hide_empty?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.per_page) q.set("per_page", String(params.per_page));
    if (params?.search) q.set("search", params.search);
    if (params?.hide_empty) q.set("hide_empty", "true");
    return request<{ categories: WpCategory[]; total: number }>(
      `/categories?${q.toString()}`
    );
  },

  uploadMedia: (file: File, productId?: number) => {
    const form = new FormData();
    form.append("file", file);
    if (productId) form.append("product_id", String(productId));
    return request<{ id: number; source_url: string; title: { rendered: string } }>(
      "/media",
      { method: "POST", body: form }
    );
  },

  deleteMedia: (id: number) =>
    request<{ deleted: boolean }>(`/media/${id}`, { method: "DELETE" }),
};
