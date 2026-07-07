"use client";

import { useMemo, useState } from "react";
import { Search, Tag, Check, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { WpCategory, WpProductCategory } from "@/lib/wp-types";

interface CategoriesPanelProps {
  selected: WpProductCategory[];
  onChange: (cats: WpProductCategory[]) => void;
  markDirty: () => void;
}

interface CategoryNode extends WpCategory {
  children: CategoryNode[];
}

export function CategoriesPanel({ selected, onChange, markDirty }: CategoriesPanelProps) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories({ per_page: 100 }),
    staleTime: 10 * 60_000,
  });

  // Build a parent map + tree for hierarchy
  const { tree, parentMap, flatById } = useMemo(() => {
    const cats = data?.categories ?? [];
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
    // Sort each level alphabetically
    const sortNodes = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    const pMap = new Map<number, number>();
    cats.forEach((c) => c.parent && pMap.set(c.id, c.parent));
    return { tree: roots, parentMap: pMap, flatById: byId };
  }, [data]);

  // Flatten tree with depth for rendering, optionally filtered by search
  const flatList = useMemo(() => {
    const result: { node: CategoryNode; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      nodes.forEach((n) => {
        result.push({ node: n, depth });
        walk(n.children, depth + 1);
      });
    };
    walk(tree, 0);
    if (!query.trim()) return result;
    const q = query.toLowerCase();
    // When searching, include a node if it or any descendant matches.
    const matches = (n: CategoryNode): boolean => {
      if (n.name.toLowerCase().includes(q)) return true;
      return n.children.some(matches);
    };
    return result.filter(({ node }) => matches(node));
  }, [tree, query]);

  const selectedIds = new Set(selected.map((c) => c.id));

  // Get all ancestors of a category id (walking up the parent chain)
  function getAncestors(id: number): WpCategory[] {
    const ancestors: WpCategory[] = [];
    let current = parentMap.get(id);
    const guard = new Set<number>();
    while (current && !guard.has(current) && flatById.has(current)) {
      guard.add(current);
      const node = flatById.get(current)!;
      ancestors.push(node);
      current = parentMap.get(current);
    }
    return ancestors;
  }

  function toggle(cat: WpCategory) {
    if (selectedIds.has(cat.id)) {
      // Deselecting this category only (parent stays selected)
      onChange(selected.filter((c) => c.id !== cat.id));
    } else {
      // Selecting — also auto-select all ancestors for convenience
      const ancestors = getAncestors(cat.id);
      const toAdd: WpProductCategory[] = [];
      [...ancestors, cat].forEach((c) => {
        if (!selectedIds.has(c.id)) {
          toAdd.push({ id: c.id, name: c.name, slug: c.slug });
        }
      });
      onChange([...selected, ...toAdd]);
    }
    markDirty();
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag className="size-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Категории
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {selected.length} выбрано
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск категории…"
          className="pl-8 h-8 text-xs bg-background"
        />
      </div>

      <ScrollArea className="h-56 rounded-lg border border-border/60 bg-background">
        {isLoading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : flatList.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {query ? "Ничего не найдено" : "Нет категорий"}
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {flatList.map(({ node, depth }) => {
              const checked = selectedIds.has(node.id);
              const hasChildren = node.children.length > 0;
              return (
                <button
                  key={node.id}
                  onClick={() => toggle(node)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                    checked
                      ? "bg-primary/10 text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
                  {hasChildren && depth > 0 ? (
                    <ChevronRight className="size-3 text-muted-foreground/60 shrink-0 -ml-0.5" />
                  ) : null}
                  <span
                    className={cn(
                      "size-4 rounded border grid place-items-center shrink-0 transition-colors",
                      checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="flex-1 truncate">{node.name}</span>
                  {node.count > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {node.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <p className="text-[10px] text-muted-foreground/70 leading-tight">
        При выборе подкатегории родительская выбирается автоматически
      </p>
    </div>
  );
}
