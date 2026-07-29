import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Autoridad de acceso del backend (GER-56 · auditoría de seguridad del login).
 *
 * REGLA: en `convex/` no se llama a `getAuthUserId` directamente. Este archivo
 * es el único sitio donde aparece. El gate del PR es `rg getAuthUserId convex`
 * sin resultados fuera de aquí.
 *
 * Por qué el control vive aquí y no en el login: el campo `status` de `users`
 * existía desde GER-7 y no lo leía nadie, así que un usuario desactivado entraba
 * con normalidad. Y los dos enganches que parecían el sitio natural no sirven:
 *
 * - `callbacks.createOrUpdateUser` NO corre en el login con contraseña
 *   (`retrieveAccountWithCredentials` solo lee y el `authorize` de `Password`
 *   devuelve `{userId}` directo, sin pasar por `upsertUserAndAccount`).
 * - `callbacks.beforeSessionCreation` corre en los tres flujos, pero solo al
 *   *crear* la sesión: `refreshSessionImpl` emite tokens nuevos para una sesión
 *   existente sin volver a llamarlo (src/server/implementation/mutations/
 *   refreshSession.ts). Un usuario desactivado mientras está dentro seguiría
 *   renovando hasta que caducara la sesión — hasta 30 días.
 *
 * De ahí que la comprobación esté en la frontera de datos: se hace en cada
 * lectura y escritura protegida, así que una sesión o un refresh token válidos
 * dejan de bastar en cuanto la ficha pasa a `inactivo`. `beforeSessionCreation`
 * se mantiene en convex/auth.ts como defensa en profundidad, no como el control.
 *
 * Desde GER-57 este archivo guarda también la política de contraseña (abajo).
 * Son dos cosas distintas —quién puede entrar y qué contraseña se acepta— pero
 * ambas son reglas de autorización sin estado, y tenerlas juntas evita que la
 * política acabe duplicada en cada proveedor que la necesita.
 */

/**
 * El usuario en sesión, si lo hay y sigue activo. Devuelve `null` en cualquier
 * otro caso, sin lanzar.
 *
 * Es la variante que necesita `users.viewer`: la interfaz distingue `null`
 * ("no deberías estar aquí", cierra sesión) de una excepción ("algo falló"), y
 * con la que lanza no podría diferenciarlas.
 */
export async function getActiveUserId(
  ctx: QueryCtx
): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const user = await ctx.db.get(userId);
  if (user === null || user.status !== "activo") return null;

  return userId;
}

/**
 * Igual que `getActiveUserId`, pero lanza. Es la que usan todas las funciones
 * protegidas de `convex/`.
 *
 * El mensaje es el mismo para "no hay sesión" y para "cuenta desactivada" a
 * propósito: distinguirlos revelaría el estado de una cuenta a quien no debería
 * conocerlo. Es también el texto que ya mostraba el código anterior, así que la
 * interfaz no cambia de comportamiento.
 */
export async function requireActiveUserId(
  ctx: QueryCtx
): Promise<Id<"users">> {
  const userId = await getActiveUserId(ctx);
  if (userId === null) throw new Error("Necesitas iniciar sesión.");
  return userId;
}

/**
 * Política de contraseña (GER-57 · Issue 2.5 de la auditoría del login).
 *
 * Entra en este issue y no en el 3 por una razón concreta: quitar `reset:
 * ResendOTP` de `Password` (ver convex/passwordReset.ts) también quita la
 * validación por defecto que la librería aplicaba al canje del código
 * (Password.ts:129-135). Sin esto, el proveedor nuevo aceptaría una contraseña
 * vacía desde su primer despliegue.
 *
 * Está partida en dos a propósito. El enganche de la librería,
 * `validatePasswordRequirements`, recibe SOLO la contraseña y corre antes de
 * `profile()` (Password.ts:88, :130), así que nunca puede ver el correo. Si
 * hubiera una sola función que exigiera ambos, el enganche tendría que
 * inventarse un correo para poder llamarla. De ahí la separación:
 *
 * - `validatePasswordRequirements(password)` — lo que se puede comprobar sin
 *   el correo. Es la que usará el alta en el Issue 3.
 * - `validatePassword(password, email)` — todo lo anterior más la regla que sí
 *   necesita el correo. Es la que usa el canje del código, que sí lo tiene.
 */

const MIN_PASSWORD_LENGTH = 10;

/**
 * Lista corta y deliberadamente genérica. No pretende ser un diccionario —eso
 * es trabajo de un servicio externo, no de una constante— sino descartar lo que
 * alguien escribe cuando quiere salir del paso. Solo tiene sentido incluir
 * candidatas de al menos MIN_PASSWORD_LENGTH caracteres: las más cortas ya las
 * rechaza la regla de longitud.
 */
const OBVIOUS_PASSWORDS = new Set([
  "1234567890",
  "0123456789",
  "contraseña",
  "contrasena",
  "password12",
  "password123",
  "passw0rd123",
  "qwertyuiop",
  "administrador",
  "1234512345",
  "aaaaaaaaaa",
]);

/**
 * Reglas que no dependen del correo. Lanza con el motivo; devolver un booleano
 * obligaría a cada sitio a inventarse el mensaje.
 */
export function validatePasswordRequirements(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    );
  }
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) {
    throw new Error("Esa contraseña es demasiado común. Elige otra.");
  }
}

/**
 * La política completa. `email` debe llegar ya en forma canónica
 * (convex/email.ts): la comparación es en minúsculas, así que un correo sin
 * normalizar no rompe nada, pero pasarlo crudo aquí sería señal de que falta
 * normalizar más arriba.
 *
 * La regla dependiente se salta cuando la parte local es muy corta: con dos o
 * tres caracteres, exigir que no aparezca en la contraseña rechazaría
 * contraseñas perfectamente buenas por coincidencia.
 */
export function validatePassword(password: string, email: string): void {
  validatePasswordRequirements(password);

  const localPart = email.split("@")[0] ?? "";
  if (
    localPart.length >= 4 &&
    password.toLowerCase().includes(localPart.toLowerCase())
  ) {
    throw new Error("La contraseña no puede contener tu correo.");
  }
}
