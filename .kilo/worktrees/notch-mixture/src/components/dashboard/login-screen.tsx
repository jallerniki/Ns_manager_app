"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Введите имя пользователя и пароль");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await api.login(username.trim(), password);
      login(user);
      toast.success(`Добро пожаловать, ${user.user_display_name || username}!`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Не удалось подключиться к серверу";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-semibold text-lg shadow-lg shadow-primary/25 mb-4">
              Tk
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Tkani Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 text-center">
              Войдите, чтобы управлять товарами
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                Имя пользователя
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-9 h-11 bg-background"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Пароль
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-11 bg-background"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-sm font-medium shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Вход…
                </>
              ) : (
                <>
                  Войти
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
            Данные для входа те же, что и в админ-панели WordPress
            <br />
            <span className="text-muted-foreground/70">nstkani.ru</span>
          </p>
        </motion.div>
      </main>
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        Tkani Manager · Быстрое управление товарами
      </footer>
    </div>
  );
}
