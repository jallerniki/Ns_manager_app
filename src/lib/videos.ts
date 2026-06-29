"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/stores/auth";

const WP_BASE =
  process.env.NEXT_PUBLIC_WP_BASE || "https://nstkani.ru/wp-json";

const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi", "m4v", "ogv"];

export const VIDEO_KEYS_QUERY = "videoKeys" as const;

export class VideoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "VideoError";
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const h: Record<string, string> = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/** Артикул из поля «Название»: убираем ведущий #/пробелы. */
export function normalizeArticle(article: string): string {
  return String(article || "").trim().replace(/^#/, "").trim();
}

/** Безопасное имя артикула для S3-ключа: только буквы/цифры/._-. */
export function sanitizeArticle(article: string): string {
  return normalizeArticle(article).replace(/[^\w.\-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
}

/** Расширение из имени файла (нижний регистр), по умолчанию mp4. */
export function getVideoExt(filename: string): string {
  const m = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m ? m[1] : "";
  return VIDEO_EXTENSIONS.includes(ext) ? ext : "mp4";
}

export function buildVideoKey(article: string, ext: string): string {
  return `${sanitizeArticle(article)}.${ext}`;
}

/** Есть ли видео для артикула (любое расширение) в списке ключей бакета. */
export function hasVideoForArticle(article: string, keys: string[]): boolean {
  const base = sanitizeArticle(article);
  if (!base) return false;
  const prefix = `${base}.`.toLowerCase();
  return keys.some((k) => k.toLowerCase().startsWith(prefix));
}

/** Существующий ключ видео артикула или null. */
export function findVideoKey(article: string, keys: string[]): string | null {
  const base = sanitizeArticle(article);
  if (!base) return null;
  const prefix = `${base}.`.toLowerCase();
  return keys.find((k) => k.toLowerCase().startsWith(prefix.toLowerCase())) ?? null;
}

/** Список ключей видео из WP (транзиент кэшируется на стороне WP). */
export async function listVideoKeys(refresh = false): Promise<string[]> {
  const url = `${WP_BASE}/ns/v1/videos/list${refresh ? "?refresh=1" : ""}`;
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new VideoError(`Не удалось получить список видео (${res.status})`, res.status);
  }
  const data = (await res.json()) as { keys?: unknown };
  return Array.isArray(data.keys) ? (data.keys as string[]) : [];
}

export interface SignResponse {
  url: string; // presigned PUT URL
  key: string; // итоговый ключ объекта
}

/** Presigned PUT-ссылка для ключа `${article}.${ext}` (перезапишет существующее). */
export async function presignVideoUpload(article: string, ext: string): Promise<SignResponse> {
  const res = await fetch(`${WP_BASE}/ns/v1/videos/sign`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ article, ext }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new VideoError(`Не удалось получить ссылку для загрузки (${res.status})`, res.status);
  }
  return (await res.json()) as SignResponse;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Загрузка видео напрямую в бакет Yandex Object Storage по presigned URL.
 * Через XMLHttpRequest — чтобы показывать прогресс. Объект с тем же ключом
 * (по артикулу) перезаписывается.
 */
export async function uploadVideo(
  file: File,
  article: string,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<{ key: string }> {
  const ext = getVideoExt(file.name);
  const key = buildVideoKey(article, ext);
  const { url } = await presignVideoUpload(sanitizeArticle(article), ext);

  return new Promise<{ key: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ key });
      else reject(new VideoError(`Загрузка не удалась (HTTP ${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new VideoError("Сетевая ошибка при загрузке видео", 0));
    xhr.onabort = () => reject(new VideoError("Загрузка отменена", 0));

    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Список видео в бакете. Тянется редко (staleTime 30 мин) и дедуплицируется
 * react-query — фактически один запрос за сессию + авто-обновление при возврате
 * на вкладку и после загрузки нового видео.
 */
export function useVideoKeys() {
  const q = useQuery({
    queryKey: [VIDEO_KEYS_QUERY],
    queryFn: () => listVideoKeys(false),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: true,
    placeholderData: [],
    retry: 1,
  });
  return { ...q, keys: q.data ?? [] };
}

/** Принудительно обновить кэш списка (после загрузки видео) из WP с обходом кэша. */
export function useForceRefreshVideoKeys() {
  const qc = useQueryClient();
  return async () => {
    const fresh = await listVideoKeys(true);
    qc.setQueryData([VIDEO_KEYS_QUERY], fresh);
    return fresh;
  };
}
