"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "./header";
import { Footer } from "./footer";
import { ProductList } from "./product-list";
import { ProductEditor } from "./product-editor";
import type { WpProduct } from "@/lib/wp-types";

export type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; productId: number }
  | { mode: "create" };

export function Dashboard() {
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  // Refresh token for list invalidation callbacks
  const [refreshKey, setRefreshKey] = useState(0);

  const openEditor = useCallback((product: WpProduct) => {
    setEditor({ mode: "edit", productId: product.id });
  }, []);

  const openCreate = useCallback(() => {
    setEditor({ mode: "create" });
  }, []);

  const closeEditor = useCallback(() => {
    setEditor({ mode: "closed" });
  }, []);

  const refreshList = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onRefresh={refreshList} onCreate={openCreate} />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <ProductList
            key={refreshKey}
            onEdit={openEditor}
            onCreate={openCreate}
          />
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {editor.mode !== "closed" && (
          <ProductEditor
            state={editor}
            onClose={closeEditor}
            onSaved={refreshList}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
