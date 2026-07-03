"use client";

import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * Pantalla 0 del MVP — ver Design/Login.dc.html y GER-7.
 * Redirige según rol lo maneja src/app/page.tsx tras iniciar sesión
 * (el middleware ya evita que un usuario autenticado vuelva aquí).
 *
 * El modo "Crear la primera cuenta" es temporal (solo para arrancar el
 * proyecto): el servidor (convex/auth.ts) rechaza el alta en cuanto ya
 * existe un usuario — a partir de ahí todo pasa por GER-48 (invitar).
 */
export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signUp";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);
    try {
      await signIn("password", formData);
    } catch {
      setError(
        isSignUp
          ? "No se pudo crear la cuenta. Si ya existe un usuario en el sistema, pide a Martha que te invite desde Gestión de usuarios."
          : "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel de marca — solo escritorio */}
      <div className="hidden w-[44%] shrink-0 flex-col justify-between bg-dark-surface p-12 lg:flex">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-brand-500" />
          <span className="font-mono text-[13px] font-bold text-brand-500">
            SolarCRM
          </span>
        </div>
        <div>
          <div className="mb-6 h-0.75 w-8 bg-brand-500" />
          <h1 className="mb-4 font-mono text-4xl font-bold leading-tight tracking-[-0.04em] text-dark-text">
            Tu negocio,
            <br />
            siempre
            <br />
            organizado.
          </h1>
          <p className="max-w-60 text-sm text-dark-text-secondary">
            Contactos, negocios y actividades en un solo lugar. Rápido y sin
            complicaciones.
          </p>
        </div>
        <div />
      </div>

      {/* Formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-18">
        <div className="w-full max-w-90">
          <div className="mb-7 flex items-center gap-2 lg:hidden">
            <div className="size-2 bg-brand-500" />
            <span className="font-mono text-sm font-bold text-brand-500">
              SolarCRM
            </span>
          </div>

          <h2 className="mb-1 font-mono text-xl font-semibold tracking-[-0.02em] text-neutral-950">
            {isSignUp ? "Crear la primera cuenta" : "Bienvenido de vuelta"}
          </h2>
          <p className="mb-7 text-sm text-neutral-500">
            {isSignUp
              ? "Esta cuenta será la dueña (Martha). Solo funciona si el sistema todavía no tiene usuarios."
              : "Entra a tu CRM"}
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2 border border-error-500 bg-error-100 p-3">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-error-500" />
              <span className="text-[13px] leading-snug text-error-700">
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div>
                <Label htmlFor="name">Nombre completo</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Martha Vargas"
                    required
                    disabled={loading}
                    className="pl-8.5"
                  />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="carlos@ejemplo.mx"
                  required
                  disabled={loading}
                  error={!!error}
                  className="pl-8.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignUp ? "Mínimo 8 caracteres" : "Tu contraseña"}
                  required
                  minLength={8}
                  disabled={loading}
                  error={!!error}
                  className="pl-8.5 pr-10.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label="Mostrar u ocultar contraseña"
                  className="absolute right-0 top-0 flex h-full w-10.5 items-center justify-center text-neutral-400"
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" loading={loading} className="mt-0.5 w-full">
              {loading
                ? "Verificando..."
                : isSignUp
                  ? "Crear cuenta"
                  : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <a href="#" className="text-[13px] text-neutral-500 hover:text-brand-600">
              ¿Olvidaste tu contraseña?
            </a>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(isSignUp ? "signIn" : "signUp");
              }}
              className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
            >
              {isSignUp ? "Ya tengo cuenta" : "¿Primera vez? Crear cuenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
