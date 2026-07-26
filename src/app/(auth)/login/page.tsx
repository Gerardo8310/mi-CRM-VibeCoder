"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
 *
 * "Continuar con Google" (GER-51) convive con el formulario. Cuando el
 * servidor rechaza una cuenta de Google no provisionada, el rechazo
 * ocurre dentro del callback de OAuth y nunca llega como excepción a
 * este cliente (Convex Auth solo hace un redirect genérico) — por eso
 * usamos `redirectTo: "/login?g=1"` y mostramos un banner aparte al
 * volver sin sesión con esa marca, en vez de un `catch` como el de
 * contraseña.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  const googleRejected = searchParams.get("g") === "1";
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignUp = mode === "signUp";
  const bannerMessage =
    error ??
    (googleRejected
      ? "No se pudo completar el inicio de sesión con Google. Si crees que deberías tener acceso, contacta a la dueña."
      : null);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn("google", { redirectTo: "/login?g=1" });
    } catch {
      setError(
        "No se pudo iniciar el inicio de sesión con Google. Intenta de nuevo."
      );
    } finally {
      setGoogleLoading(false);
    }
  }

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

          {bannerMessage && (
            <div className="mb-4 flex items-start gap-2 border border-error-500 bg-error-100 p-3">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-error-500" />
              <span className="text-[13px] leading-snug text-error-700">
                {bannerMessage}
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

          {!isSignUp && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-[11px] text-neutral-400">
                  o continúa con
                </span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                loading={googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full"
              >
                {!googleLoading && (
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.84Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12C3.25 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.12H1.27a12 12 0 0 0 0 10.78l4-3.12Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4 3.12C6.22 6.88 8.87 4.77 12 4.77Z"
                    />
                  </svg>
                )}
                {googleLoading ? "Conectando..." : "Continuar con Google"}
              </Button>
            </>
          )}

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
