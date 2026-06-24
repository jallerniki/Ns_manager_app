"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  X,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  ACF_BOOLEAN_FIELDS,
  ACF_DESCRIPTION_KEY,
  ACF_TEXT_FIELDS,
  META_FIELD_LABELS,
  type WpProduct,
  type WpProductCategory,
  type WpProductImage,
  type WpMetaItem,
} from "@/lib/wp-types";
import { ImageManager } from "./image-manager";
import { CategoriesPanel } from "./categories-panel";
import { Lightbox, useLightbox } from "./lightbox";
import type { EditorState } from "./dashboard";

interface ProductEditorProps {
  state: EditorState;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductEditor({ state, onClose, onSaved }: ProductEditorProps) {
  const qc = useQueryClient();
  const isEdit = state.mode === "edit";
  const productId = state.mode === "edit" ? state.productId : 0;

  // Fetch product details in edit mode
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api.getProduct(productId),
    enabled: isEdit,
    staleTime: 0,
  });

  // Local form state
  const [form, setForm] = useState<Partial<WpProduct>>(defaultForm());
  const [meta, setMeta] = useState<WpMetaItem[]>([]);
  const [images, setImages] = useState<WpProductImage[]>([]);
  const [categories, setCategories] = useState<WpProductCategory[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const lightbox = useLightbox();

  // Hydrate form when product loads
  useEffect(() => {
    if (isEdit && productQuery.data) {
      const p = productQuery.data;
      setForm({
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        status: p.status,
        regular_price: p.regular_price,
        sale_price: p.sale_price,
      });
      setMeta(p.meta_data ? [...p.meta_data] : []);
      setImages(p.images ? [...p.images] : []);
      setCategories(p.categories ? [...p.categories] : []);
      setDirty(false);
    }
  }, [isEdit, productQuery.data]);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function markDirty() {
    setDirty(true);
  }

  function update<K extends keyof WpProduct>(key: K, value: WpProduct[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    markDirty();
  }

  function updateMeta(key: string, value: string | boolean) {
    setMeta((prev) => {
      const idx = prev.findIndex((m) => m.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], value };
        return next;
      }
      return [...prev, { id: 0, key, value }];
    });
    markDirty();
  }

  // Parse ACF boolean value (WP may store as true/false, "1"/"0", 1/0)
  function metaBoolValue(key: string): boolean {
    const item = meta.find((m) => m.key === key);
    if (!item) return false;
    const v = item.value;
    if (typeof v === "boolean") return v;
    if (v === "1" || v === 1 || v === "true") return true;
    return false;
  }

  // Read the ACF description field (описание_)
  function metaTextValue(key: string): string {
    const item = meta.find((m) => m.key === key);
    return item ? String(item.value ?? "") : "";
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Status is driven by the "требует доработки" flag:
      // checked → draft, unchecked → publish
      const needsWork = metaBoolValue("недоделано_");
      const status = needsWork ? "draft" : "publish";
      // The "Название" field holds the артикул (the site uses it as the product name).
      // We don't use the separate SKU field — send empty string to clear it.
      const name = form.name || `#${Date.now()}`;
      const payload: Partial<WpProduct> & {
        meta_data: { id?: number; key: string; value: string }[];
      } = {
        name,
        slug: form.slug || undefined,
        sku: "",
        status,
        regular_price: form.regular_price || "",
        sale_price: form.sale_price || "",
        categories: categories.map((c) => ({ id: c.id })),
        images: images.map((img, idx) => ({ id: img.id, position: idx })),
        meta_data: meta.map((m) => ({
          id: m.id || undefined,
          key: m.key,
          value: String(m.value ?? ""),
        })),
      };

      let result: WpProduct;
      if (isEdit) {
        result = await api.updateProduct(productId, payload);
      } else {
        result = await api.createProduct(payload);
      }

      toast.success(isEdit ? "Товар сохранён" : "Товар создан");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", result.id] });
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Ошибка сохранения";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const loading = isEdit && productQuery.isLoading;
  const error = isEdit && productQuery.error;

  // Organize meta fields: known ACF text fields (excl. description), extras
  const { textMeta, extraMeta } = useMemo(() => {
    const knownKeys = new Set<string>([
      ACF_DESCRIPTION_KEY,
      ...ACF_TEXT_FIELDS.map((f) => f.key),
      ...ACF_BOOLEAN_FIELDS.map((f) => f.key),
    ]);
    // Text fields: always render all defined ACF text fields (even if empty)
    const text = ACF_TEXT_FIELDS.map((f) => {
      const item = meta.find((m) => m.key === f.key);
      return item ?? { id: 0, key: f.key, value: "" };
    });
    // Extras: meta keys not in known ACF set, excluding internal WordPress/plugin fields.
    // These are technical fields from WooCommerce, theme, Facebook, etc. — not useful for editing.
    const INTERNAL_PREFIXES = [
      "_", // private WP meta
      "disable_woothumbs",
      "site-", // theme layout settings
      "theme-", // theme meta
      "ast-", // Astra theme
      "fb_", // Facebook integration
      "woo_", // WooCommerce internal
      "wp_", // WordPress internal
      "woocommerce_",
      "total_sales",
      "custom_field", // generic
    ];
    const isInternal = (key: string) =>
      INTERNAL_PREFIXES.some(
        (p) => key === p || key.startsWith(p)
      ) && !knownKeys.has(key);
    const extra = meta.filter(
      (m) => !knownKeys.has(m.key) && !isInternal(String(m.key))
    );
    return { textMeta: text, extraMeta: extra };
  }, [meta]);

  return (
    <EditorPanel onClose={onClose} saving={saving} dirty={dirty} onSave={handleSave}>
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="size-8 text-destructive mb-2" />
          <p className="text-sm font-medium">Не удалось загрузить товар</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Ошибка"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left: form */}
          <div className="space-y-5 min-w-0">
            {/* ID + link */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="size-3.5" />
              {isEdit ? (
                <>
                  Редактирование товара
                  <span className="font-mono text-foreground">#{productId}</span>
                </>
              ) : (
                "Новый товар"
              )}
              {isEdit && form.slug && (
                <a
                  href={`https://nstkani.ru/product/${form.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Открыть на сайте
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {/* Name — full width */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name || ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="14373"
                className="h-10 font-mono"
                autoFocus={!isEdit}
              />
            </div>

            {/* Prices — in a row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="regular_price" className="text-xs font-medium">Цена (₽)</Label>
                <Input
                  id="regular_price"
                  type="number"
                  inputMode="decimal"
                  value={form.regular_price || ""}
                  onChange={(e) => update("regular_price", e.target.value)}
                  placeholder="2900"
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale_price" className="text-xs font-medium">
                  Цена со скидкой (₽)
                </Label>
                <Input
                  id="sale_price"
                  type="number"
                  inputMode="decimal"
                  value={form.sale_price || ""}
                  onChange={(e) => update("sale_price", e.target.value)}
                  placeholder="2610"
                  className="h-10 tabular-nums"
                />
              </div>
            </div>

            <Separator />

            {/* Meta data — ACF characteristics */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Характеристики
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Поля Advanced Custom Fields
                </p>
              </div>

              {/* ACF text fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {textMeta.map((m) => (
                  <div key={m.key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {META_FIELD_LABELS[m.key] || m.key}
                    </Label>
                    <Input
                      value={String(m.value ?? "")}
                      onChange={(e) => updateMeta(m.key, e.target.value)}
                      placeholder="—"
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* ACF description (textarea) — above the switches */}
              <div className="space-y-1.5">
                <Label htmlFor="acf-description" className="text-xs font-medium text-muted-foreground">
                  {META_FIELD_LABELS[ACF_DESCRIPTION_KEY]}
                </Label>
                <Textarea
                  id="acf-description"
                  value={metaTextValue(ACF_DESCRIPTION_KEY)}
                  onChange={(e) => updateMeta(ACF_DESCRIPTION_KEY, e.target.value)}
                  placeholder="Описание товара…"
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>

              {/* ACF boolean fields (True/False) */}
              <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <p className="text-[11px] font-medium text-muted-foreground mb-2.5 uppercase tracking-wide">
                  Флаги
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACF_BOOLEAN_FIELDS.map((f) => {
                    const checked = metaBoolValue(f.key);
                    const isDraftToggle = f.key === "недоделано_";
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-md bg-background border ${
                          isDraftToggle && checked
                            ? "border-amber-400/60 bg-amber-50/40"
                            : "border-border/50"
                        }`}
                      >
                        <Label
                          htmlFor={`meta-${f.key}`}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {f.label}
                          {isDraftToggle && checked && (
                            <span className="ml-1.5 text-[10px] text-amber-600">→ черновик</span>
                          )}
                        </Label>
                        <Switch
                          id={`meta-${f.key}`}
                          checked={checked}
                          onCheckedChange={(v) => updateMeta(f.key, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {extraMeta.length > 0 && (
                <>
                  <p className="text-[11px] text-muted-foreground pt-1">Доп. поля</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extraMeta.map((m) => (
                      <div key={m.key} className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground font-mono">
                          {m.key}
                        </Label>
                        <Input
                          value={String(m.value ?? "")}
                          onChange={(e) => updateMeta(m.key, e.target.value)}
                          placeholder="—"
                          className="h-9 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-border/70 bg-card/50 p-3.5">
              <CategoriesPanel
                selected={categories}
                onChange={setCategories}
                markDirty={markDirty}
              />
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-3.5">
              <ImageManager
                productId={productId}
                images={images}
                onChange={setImages}
                markDirty={markDirty}
                onPreview={(idx) =>
                  lightbox.show(
                    images.map((img) => ({ src: img.src, alt: img.alt, name: img.name })),
                    idx
                  )
                }
              />
            </div>
          </div>
        </div>
      )}
      {lightbox.open && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={lightbox.close}
          onIndexChange={lightbox.setIndex}
        />
      )}
    </EditorPanel>
  );
}

function EditorPanel({
  children,
  onClose,
  saving,
  dirty,
  onSave,
}: {
  children: React.ReactNode;
  onClose: () => void;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  // Lock background scroll while panel is open so only the panel scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      {/* Backdrop — covers & locks the page behind */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />
      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-4xl bg-background border-l border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold tracking-tight truncate">Редактор товара</h2>
            {dirty && (
              <Badge variant="outline" className="text-[10px] py-0 h-5 text-amber-600 border-amber-500/30 bg-amber-500/5">
                ● изменён
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || !dirty}
              className="h-8 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Сохранение…
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Сохранить
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 text-muted-foreground hover:text-foreground"
              disabled={saving}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Body — only this scrolls. min-h-0 + overscroll-contain prevent background scroll bleed. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </motion.div>
    </>
  );
}

function defaultForm(): Partial<WpProduct> {
  return {
    name: "",
    slug: "",
    sku: "",
    status: "publish",
    regular_price: "",
    sale_price: "",
  };
}
