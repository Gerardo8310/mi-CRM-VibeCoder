"use client";

import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvex } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
// Fuente única de estas dos reglas, compartida con el servidor (GER-59).
// Antes estaban duplicadas aquí y en `convex/`, sincronizadas solo por un
// comentario; el auditor lo marcó como riesgo de divergencia.
import {
  CODE_GROUP_SIZE,
  CODE_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@convex/authConstants";

/**
 * Las dos mitades del campo del código (GER-58). La separación **no es estética,
 * es un contrato**: el estado guarda la forma canónica y los guiones son una
 * derivada que solo existe al renderizar, así que **nunca puede viajar un código
 * con separadores en una petición**.
 *
 * Esa distinción se la debo a la auditoría (M1). Antes el estado guardaba la
 * forma agrupada y era eso lo que se enviaba; durante el hueco en que el
 * frontend nuevo convive con el Convex anterior —que toma `params.code` en
 * crudo, sin normalizar— el canje habría fallado para todos los códigos.
 *
 * `canonicalCodeInput` es COMODIDAD, no validación: la autoridad sigue siendo
 * `normalizeResetCode` (convex/ResendOTP.ts), que limpia lo que le llegue —hace
 * falta igual, porque alguien puede pegar el código con los guiones del correo—.
 * Y no filtra por alfabeto a propósito: si el servidor cambiara de alfabeto,
 * esta función no tiene por qué enterarse.
 */
function canonicalCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, CODE_LENGTH);
}

function groupCode(code: string): string {
  const groups = [];
  for (let i = 0; i < code.length; i += CODE_GROUP_SIZE) {
    groups.push(code.slice(i, i + CODE_GROUP_SIZE));
  }
  return groups.join("-");
}

/**
 * Dónde cae el cursor, en la cadena YA agrupada, cuando por delante hay `utiles`
 * caracteres del código.
 *
 * Existe porque reagrupar al escribir reescribe el valor entero, y el navegador
 * manda el cursor al final. Escribiendo de corrido eso da igual —el final es
 * justo donde debe estar—, pero al CORREGIR en medio no: se probó borrando la
 * "0" de `NPNK-BD06-C8RZ` y escribiendo la de reemplazo, y acababa en
 * `NPNK-BD6C-8RZ0`, es decir un código distinto, con doce caracteres y aspecto
 * perfectamente válido. Un fallo silencioso, que es la peor clase.
 */
function caretInGroupedCode(utiles: number, agrupadoLength: number): number {
  const conSeparadores = utiles + Math.floor(utiles / CODE_GROUP_SIZE);
  return Math.min(conSeparadores, agrupadoLength);
}

/**
 * Pantalla 0 del MVP — ver Design/Login.dc.html y GER-7.
 *
 * EL LOGIN VA EN DOS PASOS DESDE GER-48 (rama 2), Y NO ES COSMÉTICO
 *
 * Primero el correo, y solo después lo que corresponda: la contraseña, o un
 * código si la persona **todavía no tiene ninguna**. Antes se pedían las dos
 * cosas a la vez, así que alguien recién invitado no tenía más salida que pulsar
 * "¿Olvidaste tu contraseña?" — y no la había olvidado, nunca la había tenido.
 * El CRM le hacía decir algo falso para dejarle entrar.
 *
 * Quién necesita qué lo decide el servidor (`methodFor`, convex/passwordLogin.ts),
 * nunca esta pantalla. Aquí solo se pinta la respuesta.
 *
 * Los cuatro modos: `identify` (el correo), `password` (la contraseña),
 * `reset-verify` (el código + la contraseña nueva) y `signUp`, que es temporal —
 * solo sirve para arrancar el proyecto, porque convex/auth.ts rechaza el alta en
 * cuanto ya existe un usuario.
 *
 * DESAPARECIÓ EL MODO "reset-request". Pedía el correo para mandar el código, y
 * ya no hace falta: cuando alguien pulsa "¿Olvidaste tu contraseña?" estamos en
 * el paso 2 y su correo ya está escrito. Volver a pedírselo era trabajo suyo sin
 * contrapartida. Los proveedores a los que se llama son exactamente los mismos.
 *
 * "Continuar con Google" (GER-51) convive con el formulario, en el primer paso.
 * Cuando el servidor rechaza una cuenta de Google no provisionada, el rechazo
 * ocurre dentro del callback de OAuth y nunca llega como excepción a este
 * cliente (Convex Auth solo hace un redirect genérico) — por eso usamos
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

type Mode = "identify" | "password" | "signUp" | "reset-verify";

/**
 * Por qué se llegó a la pantalla del código. Solo cambia los textos: el
 * formulario, el proveedor y el canje son idénticos en los dos casos.
 */
type CodeOrigin = "setup" | "forgot";

// Mismo texto exista o no la cuenta: si dijéramos "ese correo no existe",
// cualquiera podría averiguar quién tiene acceso al CRM probando correos.
//
// Se sigue usando en el camino "olvidé mi contraseña", donde el correo puede no
// tener cuenta de contraseña (p. ej. quien entra siempre con Google).
const RESET_SENT_MESSAGE = `Si ese correo tiene una cuenta, le enviamos un código de ${CODE_LENGTH} caracteres. Puede tardar un minuto en llegar.`;

const RESET_FAILED_MESSAGE =
  "El código no es correcto o ya caducó. Revisa tu correo o pide uno nuevo.";

// Aviso para quien entra siempre con Google (GER-59 · 3.4). Esas cuentas no
// tienen credencial de contraseña, así que no existe cuenta `password` y NUNCA
// les llegará un código — la pantalla se lo prometía igual y se quedaban
// esperando un correo que no iba a existir.
//
// Solo se muestra en el camino "olvidé mi contraseña". En el de estreno sobra:
// ahí el servidor ya confirmó que existe una cuenta de contraseña esperando.
const GOOGLE_HINT =
  "¿Sueles entrar con Google? Entonces no tienes contraseña que recuperar: vuelve y usa “Continuar con Google”.";

function LoginPageContent() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleRejected = searchParams.get("g") === "1";

  const [mode, setMode] = useState<Mode>("identify");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // El correo identificado en el paso 1. A partir de ahí no se vuelve a pedir.
  const [email, setEmail] = useState("");
  const [codeOrigin, setCodeOrigin] = useState<CodeOrigin>("forgot");
  const [resetCode, setResetCode] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  // Cuántos caracteres útiles había por delante del cursor en el último cambio.
  // `null` = no hay nada que restaurar (p. ej. tras limpiar el campo por código).
  const caretUtilesRef = useRef<number | null>(null);

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const cursor = event.target.selectionStart ?? raw.length;
    caretUtilesRef.current = canonicalCodeInput(raw.slice(0, cursor)).length;
    setResetCode(canonicalCodeInput(raw));
  }

  // Devuelve el cursor a donde estaba después de reagrupar. Va en un efecto
  // porque hay que hacerlo cuando el valor nuevo ya está pintado.
  useEffect(() => {
    const input = codeInputRef.current;
    const utiles = caretUtilesRef.current;
    if (input === null || utiles === null) return;
    caretUtilesRef.current = null;
    const posicion = caretInGroupedCode(utiles, input.value.length);
    input.setSelectionRange(posicion, posicion);
  }, [resetCode]);

  const isSignUp = mode === "signUp";

  const bannerMessage =
    error ??
    (googleRejected && mode === "identify"
      ? "No se pudo completar el inicio de sesión con Google. Si crees que deberías tener acceso, contacta a la dueña."
      : null);

  function goTo(next: Mode) {
    setError(null);
    setInfo(null);
    // Que un código a medio escribir no sobreviva a un cambio de pantalla.
    setResetCode("");
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

  /**
   * Paso 1: identificar el correo y preguntarle al servidor qué toca.
   *
   * `methodFor` no distingue "no existe" de "existe y tiene contraseña": las dos
   * responden `"password"` y las dos acaban en el mismo formulario. Quien escriba
   * un correo inventado verá el campo de contraseña como cualquiera, y fallará al
   * enviarlo — que es exactamente lo que pasaba antes.
   */
  async function handleIdentify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const escrito = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      const method = await convex.query(api.passwordLogin.methodFor, {
        email: escrito,
      });
      setEmail(escrito);
      if (method === "setup") {
        await pedirCodigo(escrito, "setup");
      } else {
        setMode("password");
        setLoading(false);
      }
    } catch {
      setError("No se pudo continuar. Revisa tu conexión e intenta de nuevo.");
      setLoading(false);
    }
  }

  /**
   * Manda el código y lleva a la pantalla de canje. Sirve a los dos caminos —el
   * estreno de contraseña y el olvido— porque el proveedor es el mismo desde que
   * las invitaciones reutilizan la recuperación (convex/invitations.ts).
   *
   * Nunca informa de por qué falló: da igual que la cuenta no exista, que se
   * haya agotado el límite o que Resend esté caído. Avanzar siempre igual es lo
   * que impide usar esta pantalla para averiguar quién tiene cuenta.
   */
  async function pedirCodigo(destino: string, origen: CodeOrigin) {
    setLoading(true);
    try {
      await signIn("password-reset-request", { email: destino });
    } catch {
      // Deliberadamente vacío: ver arriba.
    } finally {
      setCodeOrigin(origen);
      // Pedir un código nuevo invalida el anterior, así que el campo tiene que
      // empezar vacío: dejar el viejo escrito solo invita a reenviarlo y fallar.
      setResetCode("");
      setError(null);
      setInfo(
        origen === "setup"
          ? `Te enviamos un código de ${CODE_LENGTH} caracteres a ${destino}. Puede tardar un minuto en llegar.`
          : RESET_SENT_MESSAGE
      );
      setMode("reset-verify");
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      // Dos proveedores propios desde GER-54, y ya no se manda `flow`: el
      // proveedor ES el flujo. `"password"` no atiende ninguno — su `profile()`
      // rechaza todo (convex/auth.ts) — porque la librería filtraba al cuerpo
      // HTTP strings que distinguían "no existe la cuenta" de "la contraseña no
      // es correcta", y por `flow: "signUp"` además verificaba la contraseña sin
      // consumir el límite de intentos.
      const result = await signIn(
        isSignUp ? "password-signup" : "password-signin",
        formData
      );
      // Con `password-signin` un fallo ya NO llega como excepción, sino como
      // `signingIn: false` (el `authorize` devuelve `null` para cuenta
      // inexistente, contraseña incorrecta, límite agotado y cuenta desactivada,
      // y la acción responde `{tokens: null}`). Esta línea, que ya estaba, es la
      // que lo convierte en el mismo `catch` de siempre: el mensaje que ve el
      // usuario no cambia.
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
        email,
        // El estado es la forma CANÓNICA, no la que se ve: en pantalla hay
        // guiones y aquí no. Es deliberado y es lo que arregló M1 — el Convex
        // anterior toma `params.code` en crudo, así que enviarle la forma
        // agrupada rompería el canje mientras las dos versiones convivan.
        code: resetCode,
        newPassword,
      });
      if (!result.signingIn) {
        throw new Error("No se pudo canjear el código");
      }
      // Elegir la contraseña ya deja al usuario con sesión —y cierra las de los
      // demás dispositivos—, así que solo falta llevarlo a su destino. Vale
      // igual para quien la estrena y para quien la cambia.
      router.replace("/");
    } catch {
      setError(RESET_FAILED_MESSAGE);
      setLoading(false);
    }
  }

  const esEstreno = codeOrigin === "setup";

  const heading = {
    identify: "Bienvenido de vuelta",
    password: "Bienvenido de vuelta",
    signUp: "Crear la primera cuenta",
    "reset-verify": esEstreno ? "Elige tu contraseña" : "Revisa tu correo",
  }[mode];

  const subheading = {
    identify: "Escribe tu correo para entrar a tu CRM.",
    password: `Entra con la contraseña de ${email}.`,
    signUp:
      "Esta cuenta será la dueña (Martha). Solo funciona si el sistema todavía no tiene usuarios.",
    "reset-verify": esEstreno
      ? "Es tu primera vez, así que no tienes contraseña todavía. Escribe el código que te enviamos y elige con cuál entrarás a partir de ahora."
      : `Escribe el código que enviamos a ${email} y elige tu contraseña nueva.`,
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

          {/* Paso 1 — solo el correo */}
          {mode === "identify" && (
            <form onSubmit={handleIdentify} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    // Los gestores de contraseñas necesitan ver el correo
                    // marcado como `username` para poder ofrecer la contraseña
                    // en el paso siguiente. Con el formulario partido en dos
                    // pantallas, sin esto muchos no rellenan nada.
                    autoComplete="username"
                    placeholder="carlos@ejemplo.mx"
                    required
                    autoFocus
                    defaultValue={email}
                    disabled={loading}
                    error={!!error}
                    className="pl-8.5"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="mt-0.5 w-full"
              >
                {loading ? "Un momento..." : "Continuar"}
              </Button>
            </form>
          )}

          {/* Paso 2 — la contraseña */}
          {mode === "password" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* El correo ya no se escribe, pero sigue viajando en el envío. */}
              <input type="hidden" name="email" value={email} readOnly />
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    required
                    autoFocus
                    // Sin `minLength`: este campo sirve para entrar, y exigir el
                    // mínimo nuevo aquí dejaría fuera a quien tenga una
                    // contraseña más corta de antes — no podría ni enviar el
                    // formulario. La política se aplica al crear y al cambiar,
                    // nunca al entrar (GER-59 · 3.1), igual que en el servidor.
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
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="mt-0.5 w-full"
              >
                {loading ? "Verificando..." : "Entrar"}
              </Button>
            </form>
          )}

          {/* Crear la primera cuenta (bootstrap) */}
          {isSignUp && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <div>
                <Label htmlFor="signup-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="carlos@ejemplo.mx"
                    required
                    defaultValue={email}
                    disabled={loading}
                    error={!!error}
                    className="pl-8.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="signup-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="mt-0.5 w-full"
              >
                {loading ? "Verificando..." : "Crear cuenta"}
              </Button>
            </form>
          )}

          {/* Canjear el código y elegir contraseña */}
          {mode === "reset-verify" && (
            <form onSubmit={handleResetVerify} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="code">Código de {CODE_LENGTH} caracteres</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="text"
                  // `one-time-code` se quitó en GER-58: el autorrelleno del
                  // sistema solo reconoce OTP numéricos cortos de SMS, y aquí
                  // solo conseguía ofrecer sugerencias que no venían a cuento.
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="K7M4-9XQP-3JRT"
                  required
                  autoFocus
                  // Controlado para que pegar el código con espacios o en
                  // minúsculas funcione. Sin `maxLength`: lo acota
                  // `canonicalCodeInput`, que corta a CODE_LENGTH caracteres
                  // útiles en vez de a un número de pulsaciones.
                  ref={codeInputRef}
                  value={groupCode(resetCode)}
                  onChange={handleCodeChange}
                  disabled={loading}
                  error={!!error}
                  // Interletraje más corto que antes: con 14 caracteres y el
                  // anterior se salía del campo en pantallas estrechas.
                  className="text-center font-mono text-base tracking-[0.15em]"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">
                  {esEstreno ? "Tu contraseña" : "Contraseña nueva"}
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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
                    autoComplete="new-password"
                    placeholder="La misma de arriba"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={loading}
                    error={!!error}
                    className="pl-8.5"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="mt-0.5 w-full"
              >
                {loading
                  ? "Guardando..."
                  : esEstreno
                    ? "Entrar al CRM"
                    : "Cambiar mi contraseña"}
              </Button>
            </form>
          )}

          {mode === "identify" && (
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

          {mode === "reset-verify" && !esEstreno && (
            <p className="mt-4 text-[13px] leading-snug text-neutral-500">
              {GOOGLE_HINT}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            {mode === "identify" && (
              <button
                type="button"
                onClick={() => goTo("signUp")}
                className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
              >
                ¿Primera vez? Crear cuenta
              </button>
            )}
            {mode === "password" && (
              <>
                <button
                  type="button"
                  onClick={() => void pedirCodigo(email, "forgot")}
                  disabled={loading}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline disabled:opacity-50"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <button
                  type="button"
                  onClick={() => goTo("identify")}
                  className="flex items-center gap-1 text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  <ArrowLeft className="size-3" />
                  Otro correo
                </button>
              </>
            )}
            {isSignUp && (
              <button
                type="button"
                onClick={() => goTo("identify")}
                className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
              >
                Ya tengo cuenta
              </button>
            )}
            {mode === "reset-verify" && (
              <>
                <button
                  type="button"
                  onClick={() => void pedirCodigo(email, codeOrigin)}
                  disabled={loading}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline disabled:opacity-50"
                >
                  Pedir otro código
                </button>
                <button
                  type="button"
                  onClick={() => goTo("identify")}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  Volver al inicio
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
