"use client";

import { useSyncExternalStore } from "react";
import { useAuthStore } from "@/stores/auth";
import { LoginScreen } from "@/components/dashboard/login-screen";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Loader2 } from "lucide-react";

/**
 * Returns false during SSR and the first client render, then true after hydration.
 * Uses useSyncExternalStore so React knows the server/client difference is intentional
 * and won't throw a hydration mismatch error.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function Page() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <LoginScreen />;
}
