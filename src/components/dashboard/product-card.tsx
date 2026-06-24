"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  ImageIcon,
  Tag,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { STOCK_STATUS_LABELS, type WpProduct } from "@/lib/wp-types";
import { Lightbox, useLightbox } from "./lightbox";

interface ProductCardProps {
  product: WpProduct;
  onEdit: (product: WpProduct) => void;
}

export function ProductCard({ product, onEdit }: ProductCardProps) {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const lightbox = useLightbox();

  const thumb = product.images?.[0]?.src;
  const price = parseFloat(product.regular_price || product.price || "0");
  const salePrice = parseFloat(product.sale_price || "0");
  const hasSale = salePrice > 0 && salePrice < price;

  function openPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    if (product.images && product.images.length > 0) {
      lightbox.show(
        product.images.map((img) => ({ src: img.src, alt: img.alt, name: img.name }))
      );
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteProduct(product.id, true);
      toast.success("Товар удалён");
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group relative bg-card border border-border/70 rounded-xl p-3 hover:border-border hover:shadow-sm transition-all duration-200">
      {/* Always-visible delete — works on mobile (no hover needed) */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={deleting}
            title="Удалить товар"
            aria-label="Удалить товар"
            className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full border border-border bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-ring"
          >
            <Trash2 className="size-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
            <AlertDialogDescription>
              Товар «{product.name || `#${product.id}`}» будет удалён безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex gap-3">
        {/* Thumbnail — click opens full-size photo */}
        <button
          onClick={openPhoto}
          className="size-16 rounded-lg overflow-hidden bg-muted shrink-0 grid place-items-center focus-ring relative"
          aria-label="Открыть фото"
          title="Открыть фото"
        >
          {thumb && !imgError ? (
            <img
              src={thumb}
              alt={product.images?.[0]?.alt || product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground/50" />
          )}
          {product.images && product.images.length > 1 && (
            <span className="absolute bottom-0.5 right-0.5 text-[9px] tabular-nums text-white/90 bg-black/50 px-1 rounded leading-tight">
              {product.images.length}
            </span>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onEdit(product)}
                className="text-left w-full group/title"
              >
                <h3 className="text-sm font-medium text-foreground truncate leading-tight group-hover/title:text-primary transition-colors">
                  {product.name || "Без названия"}
                </h3>
              </button>
            </div>
          </div>

          {/* Categories + badges */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <StockBadge status={product.stock_status} onSale={product.on_sale} />
            {product.status !== "publish" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                {product.status === "draft" ? "Черновик" : product.status}
              </Badge>
            )}
          </div>

          {/* Price + actions */}
          <div className="flex items-end justify-between gap-2 mt-auto pt-2">
            <div className="min-w-0">
              {price > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {hasSale ? salePrice.toLocaleString("ru-RU") : price.toLocaleString("ru-RU")} ₽
                  </span>
                  {hasSale && (
                    <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                      {price.toLocaleString("ru-RU")}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Цена не задана</span>
              )}
              {product.categories && product.categories.length > 0 && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {product.categories.map((c) => c.name).join(", ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-primary"
                onClick={() => onEdit(product)}
                title="Редактировать"
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {lightbox.open && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={lightbox.close}
          onIndexChange={lightbox.setIndex}
        />
      )}
    </div>
  );
}

function StockBadge({
  status,
  onSale,
}: {
  status: WpProduct["stock_status"];
  onSale: boolean;
}) {
  if (status === "instock") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        В наличии
      </span>
    );
  }
  if (status === "outofstock") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
        <AlertCircle className="size-2.5" />
        Нет в наличии
      </span>
    );
  }
  if (onSale) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <TrendingDown className="size-2.5" />
        Скидка
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
      <Tag className="size-2.5" />
      {STOCK_STATUS_LABELS[status] || status}
    </span>
  );
}
