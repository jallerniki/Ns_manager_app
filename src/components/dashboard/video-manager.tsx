"use client";

import { useRef, useState } from "react";
import {
  Video,
  Upload,
  CheckCircle2,
  Loader2,
  FileVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  buildVideoKey,
  findVideoKey,
  uploadVideo,
  useForceRefreshVideoKeys,
  useVideoKeys,
  VideoError,
} from "@/lib/videos";

interface VideoManagerProps {
  /** Артикул (поле «Название» товара) — по нему именуется файл в бакете. */
  article: string;
}

export function VideoManager({ article }: VideoManagerProps) {
  const { keys, isLoading } = useVideoKeys();
  const forceRefresh = useForceRefreshVideoKeys();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const cleanArticle = (article || "").trim();
  const existingKey = findVideoKey(cleanArticle, keys);
  const hasVideo = !!existingKey;
  const hintKey = cleanArticle ? buildVideoKey(cleanArticle, "mp4") : "";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Сбрасываем, чтобы можно было выбрать тот же файл повторно
    e.target.value = "";
    if (!file) return;

    if (!cleanArticle) {
      toast.error("Сначала укажите артикул (поле «Название»)");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      await uploadVideo(file, cleanArticle, (p) => setProgress(p.percent));
      // Принудительно переподтягиваем список из WP (обход кэша), чтобы плашка
      // обновилась сразу и на главной странице.
      await forceRefresh();
      toast.success("Видео загружено");
    } catch (err) {
      const msg = err instanceof VideoError ? err.message : "Ошибка загрузки видео";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Видео</span>
        </div>
        {isLoading ? (
          <span className="text-[11px] text-muted-foreground">…</span>
        ) : hasVideo ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Загружено
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Нет видео
          </span>
        )}
      </div>

      {hasVideo && existingKey && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-2">
          <FileVideo className="size-3.5 shrink-0" />
          <span className="font-mono truncate">{existingKey}</span>
        </div>
      )}

      {uploading && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums text-center">
            Загрузка… {progress ?? 0}%
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />

      <Button
        type="button"
        variant={hasVideo ? "outline" : "default"}
        size="sm"
        className="w-full"
        disabled={uploading || !cleanArticle}
        onClick={() => inputRef.current?.click()}
        title={cleanArticle ? undefined : "Сначала укажите артикул"}
      >
        {uploading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Загрузка…
          </>
        ) : (
          <>
            <Upload className="size-3.5" />
            {hasVideo ? "Заменить видео" : "Загрузить видео"}
          </>
        )}
      </Button>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Файл сохранится в бакет Yandex под именем артикула
        {hintKey && (
          <>
            {" "}
            (<span className="font-mono">{hintKey}</span>)
          </>
        )}
        .
        {hasVideo && " Существующее видео будет перезаписано."}
      </p>
    </div>
  );
}
