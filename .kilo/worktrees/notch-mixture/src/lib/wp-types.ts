// WordPress / WooCommerce data types

export interface WpUser {
  token: string;
  user_display_name: string;
  user_email: string;
  user_nicename: string;
}

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

export interface WpProductImage {
  id: number;
  src: string;
  name: string;
  alt: string;
  position: number;
}

export interface WpMetaItem {
  id: number;
  key: string;
  value: string | number | boolean | null;
}

export interface WpProductCategory {
  id: number;
  name: string;
  slug: string;
}

export type WpStockStatus = "instock" | "outofstock" | "onbackorder";

export interface WpProduct {
  id: number;
  name: string;
  slug: string;
  status: string;
  sku: string;
  type: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  total_sales: number;
  stock_status: WpStockStatus;
  manage_stock: boolean;
  stock_quantity: number | null;
  description: string;
  short_description: string;
  categories: WpProductCategory[];
  tags: { id: number; name: string; slug: string }[];
  images: WpProductImage[];
  featured: boolean;
  menu_order: number;
  meta_data: WpMetaItem[];
  date_created: string;
  date_modified: string;
  permalink: string;
}

export interface WpProductsResponse {
  products: WpProduct[];
  total: number;
  totalPages: number;
}

// Real ACF field definitions from nstkani.ru (Advanced Custom Fields)
// Keys are the actual ACF field_name values stored in WP postmeta / meta_data.

// The description field is rendered separately (as a textarea above the switches)
export const ACF_DESCRIPTION_KEY = "описание_";

// Text fields (rendered in a grid)
export const ACF_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: "состав_", label: "Состав" },
  { key: "линия_", label: "Линия" },
  { key: "ширина_", label: "Ширина" },
  { key: "купон_", label: "Купон" },
  { key: "страна_производства", label: "Страна производства" },
  { key: "_остаток", label: "Остаток" },
  { key: "метраж_", label: "Метраж" },
  { key: "дефект_", label: "Дефект" },
];

// Boolean (True/False) ACF fields — rendered as switches.
// "недоделано_" drives the product status: checked → draft, unchecked → publish.
export const ACF_BOOLEAN_FIELDS: { key: string; label: string }[] = [
  { key: "в_наличии_", label: "В наличии" },
  { key: "_onlyblack", label: "Только чёрное" },
  { key: "_продано", label: "Продано" },
  { key: "недоделано_", label: "Требует доработки" },
];

// Flat label map for quick lookup (includes the description key)
export const META_FIELD_LABELS: Record<string, string> = {
  [ACF_DESCRIPTION_KEY]: "Описание",
  ...Object.fromEntries(ACF_TEXT_FIELDS.map((f) => [f.key, f.label])),
  ...Object.fromEntries(ACF_BOOLEAN_FIELDS.map((f) => [f.key, f.label])),
};

// Set of boolean field keys
export const ACF_BOOLEAN_KEYS = new Set(ACF_BOOLEAN_FIELDS.map((f) => f.key));

// Ordered keys for rendering (text first, then booleans)
export const PREFERRED_META_ORDER = [
  ...ACF_TEXT_FIELDS.map((f) => f.key),
  ...ACF_BOOLEAN_FIELDS.map((f) => f.key),
];

export const STOCK_STATUS_LABELS: Record<WpStockStatus, string> = {
  instock: "В наличии",
  outofstock: "Нет в наличии",
  onbackorder: "Под заказ",
};
