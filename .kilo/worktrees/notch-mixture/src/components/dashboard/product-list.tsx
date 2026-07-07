"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  PackageOpen,
  AlertTriangle,
  RotateCcw,
  Tag,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ProductCard } from "./product-card";
import type { WpCategory, WpProduct } from "@/lib/wp-types";

interface ProductListProps {
  onEdit: (product: WpProduct) => void;
  onCreate: () => void;
}

const PER_PAGE = 24;

interface CategoryNode extends WpCategory {
  children: CategoryNode[];
}

export function ProductList({ onEdit, onCreate }: ProductListProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [categoryLabel, setCategoryLabel] = useState<string>("Все категории");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);

  // Debounce search input (also resets to page 1)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change — handled in the setters below.

  // Parse sort
  const { orderby, order } = useMemo(() => {
    switch (sort) {
      case "date-asc":
        return { orderby: "date", order: "asc" as const };
      case "title-asc":
        return { orderby: "title", order: "asc" as const };
      case "title-desc":
        return { orderby: "title", order: "desc" as const };
      case "price-asc":
        return { orderby: "price", order: "asc" as const };
      case "price-desc":
        return { orderby: "price", order: "desc" as const };
      default:
        return { orderby: "date", order: "desc" as const };
    }
  }, [sort]);

  const hasFilters =
    debouncedSearch !== "" || category !== "all" || status !== "all";

  // Load categories (once)
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories({ per_page: 100 }),
    staleTime: 10 * 60_000,
  });

  // Build hierarchical category tree
  const { flatList } = useMemo(() => {
    const cats = categoriesQuery.data?.categories ?? [];
    const byId = new Map<number, CategoryNode>();
    cats.forEach((c) => byId.set(c.id, { ...c, children: [] }));
    const roots: CategoryNode[] = [];
    byId.forEach((node) => {
      if (node.parent && byId.has(node.parent)) {
        byId.get(node.parent)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortNodes = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    const flat: { node: CategoryNode; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      nodes.forEach((n) => {
        flat.push({ node: n, depth });
        walk(n.children, depth + 1);
      });
    };
    walk(roots, 0);
    return { flatList: flat };
  }, [categoriesQuery.data]);

  const productsQuery = useQuery({
    queryKey: ["products", debouncedSearch, category, status, orderby, order, page],
    queryFn: () => {
      const params: Record<string, unknown> = {
        page,
        per_page: PER_PAGE,
        orderby,
        order,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category !== "all") params.category = category;
      if (status === "published") params.status = "publish";
      else if (status === "draft") params.status = "draft";
      return api.listProducts(params as Parameters<typeof api.listProducts>[0]);
    },
    placeholderData: (prev) => prev,
  });

  const allProducts = useMemo(() => {
    const prods = productsQuery.data?.products ?? [];
    if (status === "instock") return prods.filter((p) => p.stock_status === "instock");
    if (status === "outofstock") return prods.filter((p) => p.stock_status === "outofstock");
    if (status === "sale") return prods.filter((p) => p.on_sale);
    return prods;
  }, [productsQuery.data, status]);

  const total = productsQuery.data?.total ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 0;

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setCategoryLabel("Все категории");
    setStatus("all");
    setSort("date-desc");
    setPage(1);
  }

  function selectCategory(id: string, label: string) {
    setCategory(id);
    setCategoryLabel(label);
    setPage(1);
  }

  function changeStatus(v: string) {
    setStatus(v);
    setPage(1);
  }

  function changeSort(v: string) {
    setSort(v);
    setPage(1);
  }

  const isLoading = productsQuery.isLoading;
  const isFetching = productsQuery.isFetching;
  const isError = productsQuery.isError;
  const isEmpty = !isLoading && !isError && allProducts.length === 0;

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или артикулу…"
            className="pl-9 pr-9 h-10 bg-card border-border"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Очистить"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {/* Hierarchical category picker — styled to match Select triggers */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-full sm:w-[180px] items-center justify-between gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm hover:bg-accent/50 transition-colors focus-ring"
              >
                <span className="flex items-center gap-1.5 truncate min-w-0">
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{categoryLabel}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <ScrollArea className="h-72">
                <div className="p-1.5 space-y-0.5">
                  <CategoryRow
                    label="Все категории"
                    depth={0}
                    selected={category === "all"}
                    onClick={() => selectCategory("all", "Все категории")}
                  />
                  {flatList.map(({ node, depth }) => (
                    <CategoryRow
                      key={node.id}
                      label={node.name}
                      count={node.count}
                      depth={depth}
                      hasChildren={node.children.length > 0}
                      selected={category === String(node.id)}
                      onClick={() => selectCategory(String(node.id), node.name)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] bg-card text-sm">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="published">Опубликован</SelectItem>
              <SelectItem value="draft">Черновик</SelectItem>
              <SelectItem value="instock">В наличии</SelectItem>
              <SelectItem value="outofstock">Нет в наличии</SelectItem>
              <SelectItem value="sale">Со скидкой</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={changeSort}>
            <SelectTrigger className="h-9 w-full sm:w-[180px] bg-card text-sm col-span-2 sm:col-span-1">
              <SlidersHorizontal className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Сначала новые</SelectItem>
              <SelectItem value="date-asc">Сначала старые</SelectItem>
              <SelectItem value="title-asc">Название (А-Я)</SelectItem>
              <SelectItem value="title-desc">Название (Я-А)</SelectItem>
              <SelectItem value="price-asc">Цена ↑</SelectItem>
              <SelectItem value="price-desc">Цена ↓</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 col-span-2 sm:col-span-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Сбросить
            </Button>
          )}

          <div className="text-xs text-muted-foreground tabular-nums col-span-2 sm:ml-auto sm:text-right">
            {isLoading ? "…" : `${total.toLocaleString("ru-RU")} товаров`}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          message={productsQuery.error instanceof Error ? productsQuery.error.message : "Ошибка загрузки"}
          onRetry={() => productsQuery.refetch()}
        />
      ) : isEmpty ? (
        <EmptyState hasFilters={hasFilters} onCreate={onCreate} onReset={resetFilters} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.012, 0.2) }}
              >
                <ProductCard product={p} onEdit={onEdit} />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              isFetching={isFetching}
            />
          )}
        </>
      )}
    </div>
  );
}

function CategoryRow({
  label,
  count,
  depth,
  hasChildren,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  depth: number;
  hasChildren?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
        selected ? "bg-primary/10 text-primary-foreground" : "hover:bg-accent text-foreground"
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      {hasChildren && depth > 0 ? (
        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0 -ml-0.5" />
      ) : null}
      <span
        className={cn(
          "size-4 rounded border grid place-items-center shrink-0 transition-colors",
          selected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
        )}
      >
        {selected && <Check className="size-3" />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
  isFetching,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  isFetching: boolean;
}) {
  // Compute a window of pages around the current page
  const pages = useMemo(() => {
    const result: (number | "…")[] = [];
    const add = (n: number | "…") => result.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) add(i);
    } else {
      add(1);
      if (page > 3) add("…");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) add(i);
      if (page < totalPages - 2) add("…");
      add(totalPages);
    }
    return result;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        {isFetching && (
          <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
        {/* Manual page input: type a number, press Enter to jump */}
        <span className="hidden sm:inline">Стр.</span>
        <PageInput
          value={page}
          totalPages={totalPages}
          disabled={isFetching}
          onChange={onChange}
        />
        <span>из {totalPages}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onChange(1)}
          disabled={page === 1 || isFetching}
          title="В начало"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onChange(page - 1)}
          disabled={page === 1 || isFetching}
          title="Назад"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon"
              className="size-8 text-xs tabular-nums"
              onClick={() => onChange(p)}
              disabled={isFetching}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages || isFetching}
          title="Вперёд"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages || isFetching}
          title="В конец"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Editable page number input — type a page and press Enter to jump. */
function PageInput({
  value,
  totalPages,
  disabled,
  onChange,
}: {
  value: number;
  totalPages: number;
  disabled: boolean;
  onChange: (p: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Keep draft in sync when external value changes (e.g. nav buttons)
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(1, Math.min(totalPages, n));
    if (clamped !== value) onChange(clamped);
    else setDraft(String(clamped));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-7 w-12 rounded-md border border-input bg-card text-center text-xs tabular-nums px-1 focus-ring"
      aria-label="Номер страницы"
    />
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-xl bg-card border border-border/60 animate-pulse"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-12 rounded-full bg-destructive/10 grid place-items-center mb-3">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">Не удалось загрузить товары</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-3.5" />
        Повторить
      </Button>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onCreate,
  onReset,
}: {
  hasFilters: boolean;
  onCreate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-12 rounded-full bg-muted grid place-items-center mb-3">
        <PackageOpen className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        {hasFilters ? "Ничего не найдено" : "Пока нет товаров"}
      </p>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm">
        {hasFilters
          ? "Попробуйте изменить параметры поиска или сбросить фильтры"
          : "Создайте первый товар, чтобы начать работу"}
      </p>
      {hasFilters ? (
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          Сбросить фильтры
        </Button>
      ) : (
        <Button size="sm" onClick={onCreate}>
          Создать товар
        </Button>
      )}
    </div>
  );
}
