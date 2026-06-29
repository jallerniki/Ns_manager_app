"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  ImageIcon,
  TrendingDown,
  AlertTriangle,
  Ruler,
  Video,
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
import {
  metaBool,
  type WpProduct,
} from "@/lib/wp-types";
import { hasVideoForArticle } from "@/lib/videos";
import { Lightbox, useLightbox } from "./lightbox";

interface ProductCardProps {
  product: WpProduct;
  onEdit: (product: WpProduct) => void;
  videoKeys?: string[];
}

export function ProductCard({ product, onEdit, videoKeys }: ProductCardProps) {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const lightbox = useLightbox();

  const thumb = product.images?.[0]?.src;
  const price = parseFloat(product.regular_price || product.price || "0");
  const salePrice = parseFloat(product.sale_price || "0");
  const hasSale = salePrice > 0 && salePrice < price;
  const metraj = String(
    product.meta_data?.find((m) => m.key === "метраж_")?.value ?? ""
  ).trim();

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
            <FlagBadges product={product} />
            {videoKeys && hasVideoForArticle(product.name, videoKeys) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Video className="size-2.5" />
                Видео
              </span>
            )}
            {metraj && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Ruler className="size-2.5" />
                {metraj}
              </span>
            )}
            {product.on_sale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingDown className="size-2.5" />
                Скидка
              </span>
            )}
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

/**
 * Badges strictly tied to the ACF True/False toggles editable inside the product.
 * Each active toggle renders its own badge; order reflects priority
 * (sold → needs work → only black → in stock).
 */
function FlagBadges({ product }: { product: WpProduct }) {
  const badges = [
    {
      active: metaBool(product.meta_data, "_продано"),
      label: "Продано",
      className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
      icon: <span className="size-1.5 rounded-full bg-zinc-500" />,
    },
    {
      active: metaBool(product.meta_data, "недоделано_"),
      label: "Требует доработки",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle className="size-2.5" />,
    },
    {
      active: metaBool(product.meta_data, "_onlyblack"),
      label: "Только чёрное",
      className: "bg-zinc-900/10 text-zinc-800 dark:bg-zinc-100/10 dark:text-zinc-100",
      icon: (
        <span className="size-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
      ),
    },
    {
      active: metaBool(product.meta_data, "в_наличии_"),
      label: "В наличии",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: <span className="size-1.5 rounded-full bg-emerald-500" />,
    },
  ];

  return (
    <>
      {badges
        .filter((b) => b.active)
        .map((b) => (
          <span
            key={b.label}
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${b.className}`}
          >
            {b.icon}
            {b.label}
          </span>
        ))}
    </>
  );
}
