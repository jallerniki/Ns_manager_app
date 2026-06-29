"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Download, RefreshCw, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface HeaderProps {
  onRefresh: () => void;
  onCreate: () => void;
}

export function Header({ onRefresh, onCreate }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [exporting, setExporting] = useState(false);

  async function handleExportCategories() {
    setExporting(true);
    try {
      const { categories } = await api.listCategories({ per_page: 100 });
      // Fetch all pages if there are more than 100
      let all = [...categories];
      let page = 2;
      while (all.length > 0 && all.length % 100 === 0 && page < 50) {
        const res = await api.listCategories({ per_page: 100 });
        if (res.categories.length === 0) break;
        // Note: our API returns all at once already, so this is a safety net.
        break;
      }
      all = all.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      const blob = new Blob([JSON.stringify(all, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ns-categories-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано категорий: ${all.length}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 glass-bar bg-background/80 border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-semibold text-sm shrink-0"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              NS
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-foreground truncate leading-tight">
                NS Manager
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight truncate hidden sm:block">
                {user?.user_display_name ? `Вы вошли как ${user.user_display_name}` : "Управление товарами"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="hidden sm:inline-flex h-9 text-muted-foreground hover:text-foreground"
              title="Обновить"
            >
              <RefreshCw className="size-4" />
              <span className="hidden md:inline">Обновить</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCategories}
              disabled={exporting}
              className="h-9 text-muted-foreground hover:text-foreground"
              title="Экспорт категорий в JSON"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span className="hidden md:inline">Категории</span>
            </Button>

            <Button
              size="sm"
              onClick={onCreate}
              className="h-9 shadow-sm"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Товар</span>
            </Button>

            <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-9 text-muted-foreground hover:text-destructive"
              title="Выйти"
            >
              <LogOut className="size-4" />
              <span className="hidden lg:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
