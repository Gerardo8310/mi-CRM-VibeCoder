"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
// Fuente única de estas dos reglas, compartida con el servidor (GER-59).
// Antes estaban duplicadas aquí y en `convex/`, sincronizadas solo por un
// comentario; el auditor lo marcó como riesgo de divergencia.
import { CODE_LENGTH, MIN_PASSWORD_LENGTH } from "@convex/authConstants";

/**
 * Pantalla 0 del MVP — ver Design/Login.dc.html y GER-7.
 *
 * Cuatro modos: entrar, crear la primera cuenta, pedir código de recuperación
 * y canjearlo. El modo "Crear la primera cuenta" es temporal (solo para
 * arrancar el proyecto): el servidor (convex/auth.ts) rechaza el alta en
 * cuanto ya existe un usuario — a partir de ahí todo pasa por GER-48.
 *
 * "Continuar con Google" (GER-51) convive con el formulario. Cuando el
 * servidor rechaza una cuenta de Google no provisionada, el rechazo ocurre
 * dentro del callback de OAuth y nunca llega como excepción a este cliente
 * (Convex Auth solo hace un redirect genérico) — por eso usamos
 * `redirectTo: "/login?g=1"` y mostramos un banner aparte al volver sin sesión
 * con esa marca, en vez de un `catch` como el de contraseña.
 *
 * Recuperación de contraseña (GER-53): el código y la contraseña nueva viajan
 * juntos porque la librería los procesa en una sola operación — no hay forma
 * de validar el código por separado sin consumirlo.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

type Mode = "signIn" | "signUp" | "reset-request" | "reset-verify";

// Mismo texto exista o no la cuenta: si dijéramos "ese correo no existe",
// cualquiera podría averiguar quién tiene acceso al CRM probando correos.
const RESET_SENT_MESSAGE = `Si ese correo tiene una cuenta, le enviamos un código de ${CODE_LENGTH} dígitos. Puede tardar un minuto en llegar.`;

const RESET_FAILED_MESSAGE =
  "El código no es correcto o ya caducó. Revisa tu correo o pide uno nuevo.";

// Aviso para quien entra siempre con Google (GER-59 · 3.4). Esas cuentas no
// tienen credencial de contraseña, así que no existe cuenta `password` y NUNCA
// les llegará un código — la pantalla se lo prometía igual y se quedaban
// esperando un correo que no iba a existir.
//
// Se muestra a todo el mundo, sin condicionales. Enseñarlo solo a quien no
// tiene contraseña convertiría la pantalla en un detector de qué método usa
// cada cuenta, que es justo lo que RESET_SENT_MESSAGE evita.
const GOOGLE_HINT =
  "¿Sueles entrar con Google? Entonces no tienes contraseña que recuperar: vuelve y usa “Continuar con Google”.";

function LoginPageContent() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleRejected = searchParams.get("g") === "1";

  const [mode, setMode] = useState<Mode>("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const isSignUp = mode === "signUp";
  const isResetting = mode === "reset-request" || mode === "reset-verify";

  const bannerMessage =
    error ??
    (googleRejected && mode === "signIn"
      ? "No se pudo completar el inicio de sesión con Google. Si crees que deberías tener acceso, contacta a la dueña."
      : null);

  function goTo(next: Mode) {
    setError(null);
    setInfo(null);
    setMode(next);
  }

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
      const result = await signIn("password", formData);
      if (!result.signingIn) {
        throw new Error("No se inició sesión");
      }
      // `signIn` guarda los tokens pero no navega, y nada más en la app lo
      // hacía: el usuario se quedaba en /login ya autenticado. La raíz decide
      // el destino según el rol (src/app/page.tsx).
      router.replace("/");
    } catch {
      setError(
        isSignUp
          ? "No se pudo crear la cuenta. Si ya existe un usuario en el sistema, pide a Martha que te invite desde Gestión de usuarios."
          : "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo."
      );
      setLoading(false);
    }
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      await signIn("password-reset-request", { email });
    } catch {
      // Da igual por qué falló —cuenta inexistente, límite alcanzado o Resend
      // caído—: avanzamos igual y con el mismo texto, para no filtrar nada.
    } finally {
      setResetEmail(email);
      setInfo(RESET_SENT_MESSAGE);
      setMode("reset-verify");
      setLoading(false);
    }
  }

  async function handleResetVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setInfo(null);
    setLoading(true);
    try {
      // Proveedor propio desde GER-57 (Issue 2.1). `Password` ya no acepta
      // `flow: "reset-verification"`: el canje se movió para poder canonizar el
      // correo antes de que la librería lo use como identificador del límite de
      // intentos. Ver convex/passwordReset.ts.
      const result = await signIn("password-reset-verify", {
        email: resetEmail,
        code: String(formData.get("code") ?? "").trim(),
        newPassword,
      });
      if (!result.signingIn) {
        throw new Error("No se pudo canjear el código");
      }
      // Cambiar la contraseña ya deja al usuario con sesión —y cierra las de
      // los demás dispositivos—, así que solo falta llevarlo a su destino.
      router.replace("/");
    } catch {
      setError(RESET_FAILED_MESSAGE);
      setLoading(false);
    }
  }

  const heading = {
    signIn: "Bienvenido de vuelta",
    signUp: "Crear la primera cuenta",
    "reset-request": "Recuperar tu contraseña",
    "reset-verify": "Revisa tu correo",
  }[mode];

  const subheading = {
    signIn: "Entra a tu CRM",
    signUp:
      "Esta cuenta será la dueña (Martha). Solo funciona si el sistema todavía no tiene usuarios.",
    "reset-request": `Escribe tu correo y te enviamos un código de ${CODE_LENGTH} dígitos para elegir una contraseña nueva.`,
    "reset-verify": resetEmail
      ? `Escribe el código que enviamos a ${resetEmail} y elige tu contraseña nueva.`
      : "Escribe el código que te enviamos y elige tu contraseña nueva.",
  }[mode];

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
            {heading}
          </h2>
          <p className="mb-7 text-sm text-neutral-500">{subheading}</p>

          {bannerMessage && (
            <div className="mb-4 flex items-start gap-2 border border-error-500 bg-error-100 p-3">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-error-500" />
              <span className="text-[13px] leading-snug text-error-700">
                {bannerMessage}
              </span>
            </div>
          )}

          {info && !bannerMessage && (
            <div className="mb-4 flex items-start gap-2 border border-neutral-200 bg-neutral-100 p-3">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-neutral-500" />
              <span className="text-[13px] leading-snug text-neutral-600">
                {info}
              </span>
            </div>
          )}

          {/* Entrar / crear la primera cuenta */}
          {!isResetting && (
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
                    placeholder={
                      isSignUp
                        ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
                        : "Tu contraseña"
                    }
                    required
                    // Solo en el alta (GER-59 · 3.1). Este mismo campo sirve
                    // para entrar, y exigir el mínimo nuevo ahí dejaría fuera a
                    // quien tenga una contraseña más corta de antes: no podría
                    // ni enviar el formulario. La política se aplica al crear y
                    // al cambiar, nunca al entrar — igual que en el servidor.
                    minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
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
          )}

          {/* Pedir el código */}
          {mode === "reset-request" && (
            <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="reset-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="reset-email"
                    name="email"
                    type="email"
                    placeholder="carlos@ejemplo.mx"
                    required
                    autoFocus
                    defaultValue={resetEmail}
                    disabled={loading}
                    className="pl-8.5"
                  />
                </div>
              </div>
              <Button type="submit" size="lg" loading={loading} className="mt-0.5 w-full">
                {loading ? "Enviando..." : "Enviarme el código"}
              </Button>
            </form>
          )}

          {/* Canjear el código y elegir contraseña nueva */}
          {mode === "reset-verify" && (
            <form onSubmit={handleResetVerify} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="code">Código de {CODE_LENGTH} dígitos</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="12345678"
                  required
                  autoFocus
                  maxLength={CODE_LENGTH}
                  disabled={loading}
                  error={!!error}
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">Contraseña nueva</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
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
              <div>
                <Label htmlFor="confirmPassword">Repite la contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="La misma de arriba"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={loading}
                    error={!!error}
                    className="pl-8.5"
                  />
                </div>
              </div>
              <Button type="submit" size="lg" loading={loading} className="mt-0.5 w-full">
                {loading ? "Cambiando..." : "Cambiar mi contraseña"}
              </Button>
            </form>
          )}

          {mode === "signIn" && (
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

          {isResetting && (
            <p className="mt-4 text-[13px] leading-snug text-neutral-500">
              {GOOGLE_HINT}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            {mode === "signIn" && (
              <>
                <button
                  type="button"
                  onClick={() => goTo("reset-request")}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <button
                  type="button"
                  onClick={() => goTo("signUp")}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  ¿Primera vez? Crear cuenta
                </button>
              </>
            )}
            {mode === "signUp" && (
              <button
                type="button"
                onClick={() => goTo("signIn")}
                className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
              >
                Ya tengo cuenta
              </button>
            )}
            {mode === "reset-request" && (
              <button
                type="button"
                onClick={() => goTo("signIn")}
                className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
              >
                Volver al inicio de sesión
              </button>
            )}
            {mode === "reset-verify" && (
              <>
                <button
                  type="button"
                  onClick={() => goTo("reset-request")}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  Pedir otro código
                </button>
                <button
                  type="button"
                  onClick={() => goTo("signIn")}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
