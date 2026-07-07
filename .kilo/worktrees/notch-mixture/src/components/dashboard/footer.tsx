"use client";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 glass-bar bg-background/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">
          Tkani Manager · Управление товарами WooCommerce
        </span>
        <span className="hidden sm:inline text-muted-foreground/70 tabular-nums">
          nstkani.ru
        </span>
      </div>
    </footer>
  );
}
