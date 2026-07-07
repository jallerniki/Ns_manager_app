"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt?: string;
  name?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const current = images[index];

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    onIndexChange?.((index + 1) % images.length);
  }, [images.length, index, onIndexChange]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    onIndexChange?.((index - 1 + images.length) % images.length);
  }, [images.length, index, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
        onClick={onClose}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors"
          aria-label="Закрыть"
        >
          <X className="size-5" />
        </button>

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm tabular-nums bg-white/10 px-3 py-1 rounded-full">
            {index + 1} / {images.length}
          </div>
        )}

        {/* Download button */}
        <a
          href={current.src}
          download
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 z-10 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors"
          aria-label="Скачать"
          title="Скачать"
        >
          <Download className="size-5" />
        </a>

        {/* Prev button */}
        {images.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors"
            aria-label="Предыдущее"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        {/* Image — keyed by index so it remounts (resets loaded state) when navigating */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-[92vw] max-h-[88vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <LightboxImage src={current.src} alt={current.alt || current.name || ""} />
        </motion.div>

        {/* Next button */}
        {images.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors"
            aria-label="Следующее"
          >
            <ChevronRight className="size-6" />
          </button>
        )}

        {/* Image name */}
        {current.name && (
          <div className="absolute bottom-4 left-4 z-10 text-white/70 text-xs max-w-[50%] truncate">
            {current.name}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Image with loading spinner. Remounts via key to reset loaded state. */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "max-w-[92vw] max-h-[88vh] object-contain rounded-lg transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

/** Hook to manage lightbox state conveniently. */
export function useLightbox() {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [index, setIndex] = useState(0);

  const show = useCallback((imgs: LightboxImage[], startIndex = 0) => {
    setImages(imgs);
    setIndex(startIndex);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, images, index, show, close, setIndex };
}
