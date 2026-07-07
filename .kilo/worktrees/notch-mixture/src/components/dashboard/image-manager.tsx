"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Upload,
  Trash2,
  Loader2,
  ImageIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { WpProductImage } from "@/lib/wp-types";

interface ImageManagerProps {
  productId: number;
  images: WpProductImage[];
  onChange: (images: WpProductImage[]) => void;
  /** Called when images order/content changed and should be persisted. */
  markDirty: () => void;
  /** Called when user clicks a photo to view full-size. */
  onPreview?: (index: number) => void;
}

export function ImageManager({ productId, images, onChange, markDirty, onPreview }: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [movedId, setMovedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash the moved photo briefly to indicate it changed position.
  function flashMoved(id: number) {
    setMovedId(null);
    // Force reflow so the animation re-triggers even if same element.
    requestAnimationFrame(() => {
      setMovedId(id);
      if (movedTimer.current) clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setMovedId(null), 600);
    });
  }

  useEffect(() => {
    return () => {
      if (movedTimer.current) clearTimeout(movedTimer.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // TouchSensor with delay: press-and-hold 180ms before drag starts,
    // so a quick swipe scrolls the page instead of picking up the image.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(images, oldIndex, newIndex).map((img, idx) => ({
      ...img,
      position: idx,
    }));
    onChange(reordered);
    markDirty();
    flashMoved(Number(active.id));
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const newImages: WpProductImage[] = [...images];
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) continue;
          try {
            const media = await api.uploadMedia(file, productId);
            newImages.push({
              id: media.id,
              src: media.source_url,
              name: media.title?.rendered || file.name,
              alt: "",
              position: newImages.length,
            });
          } catch (err) {
            toast.error(
              `Не удалось загрузить «${file.name}»: ${err instanceof Error ? err.message : "ошибка"}`
            );
          }
        }
        if (newImages.length !== images.length) {
          onChange(newImages);
          markDirty();
          toast.success(`Загружено изображений: ${newImages.length - images.length}`);
        }
      } finally {
        setUploading(false);
      }
    },
    [images, onChange, markDirty, productId]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleDeleteImage(id: number) {
    const prev = images;
    const next = images.filter((i) => i.id !== id).map((img, idx) => ({ ...img, position: idx }));
    onChange(next);
    markDirty();
    // Best-effort delete from media library
    try {
      await api.deleteMedia(id);
      toast.success("Изображение удалено");
    } catch (err) {
      // Revert UI on failure
      onChange(prev);
      toast.error(err instanceof Error ? err.message : "Не удалось удалить изображение");
    }
  }

  function handleMoveLeft(id: number) {
    const idx = images.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const reordered = arrayMove(images, idx, idx - 1).map((img, i) => ({
      ...img,
      position: i,
    }));
    onChange(reordered);
    markDirty();
    flashMoved(id);
  }

  function handleMoveRight(id: number) {
    const idx = images.findIndex((i) => i.id === id);
    if (idx < 0 || idx >= images.length - 1) return;
    const reordered = arrayMove(images, idx, idx + 1).map((img, i) => ({
      ...img,
      position: i,
    }));
    onChange(reordered);
    markDirty();
    flashMoved(id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Фотографии
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Стрелки ↑↓ для перемещения · удерживайте фото чтобы перетащить
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {images.length} шт.
        </span>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Загрузка…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Upload className="size-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">Добавить фото</span>
            <span className="text-[11px] text-muted-foreground">Перетащите или нажмите</span>
          </div>
        )}
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-8 text-center">
          <ImageIcon className="size-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">Пока нет изображений</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {images.map((img, idx) => (
                <SortableImage
                  key={img.id}
                  image={img}
                  index={idx}
                  total={images.length}
                  isFeatured={idx === 0}
                  moved={movedId === img.id}
                  onMoveLeft={() => handleMoveLeft(img.id)}
                  onMoveRight={() => handleMoveRight(img.id)}
                  onDelete={() => handleDeleteImage(img.id)}
                  onPreview={onPreview ? () => onPreview(idx) : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

interface SortableImageProps {
  image: WpProductImage;
  index: number;
  total: number;
  isFeatured: boolean;
  moved?: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onPreview?: () => void;
}

function SortableImage({
  image,
  index,
  total,
  isFeatured,
  moved,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onPreview,
}: SortableImageProps) {
  const [imgError, setImgError] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group relative flex items-center rounded-xl overflow-hidden bg-card border touch-none",
        isFeatured ? "border-primary ring-2 ring-primary/40" : "border-border",
        isDragging && "shadow-xl ring-2 ring-primary/50 opacity-60",
        moved && "img-moved"
      )}
    >
      {/* Move up button — left, full-height */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveLeft();
        }}
        disabled={!canMoveUp}
        className="self-stretch shrink-0 w-11 grid place-items-center bg-muted text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Вверх"
        title="Вверх"
      >
        <ChevronUp className="size-5" />
      </button>

      {/* Image — square, click to preview, drag to reorder (bigger now) */}
      <div
        {...listeners}
        onClick={onPreview}
        className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-muted cursor-grab active:cursor-grabbing touch-none my-2.5 rounded-lg overflow-hidden"
        role="button"
        aria-label={onPreview ? "Тап — открыть, удерживать — перетащить" : "Перетащите для сортировки"}
      >
        {imgError ? (
          <div className="absolute inset-0 grid place-items-center">
            <ImageIcon className="size-6 text-muted-foreground/40" />
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.alt || image.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            loading="lazy"
            draggable={false}
            onError={() => setImgError(true)}
          />
        )}
        {/* Featured badge */}
        {isFeatured && (
          <div className="absolute top-1 left-1 z-20 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary text-primary-foreground pointer-events-none shadow">
            Главная
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Delete button — aligned with photo height */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 w-11 h-11 mr-2 rounded-lg bg-muted text-foreground hover:bg-destructive hover:text-destructive-foreground grid place-items-center transition-colors"
        aria-label="Удалить"
        title="Удалить"
      >
        <Trash2 className="size-5" />
      </button>

      {/* Move down button — right, full-height */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveRight();
        }}
        disabled={!canMoveDown}
        className="self-stretch shrink-0 w-11 grid place-items-center bg-muted text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Вниз"
        title="Вниз"
      >
        <ChevronDown className="size-5" />
      </button>
    </div>
  );
}
