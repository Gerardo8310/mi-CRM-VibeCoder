import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  MIN_LOCAL_PART_FOR_PASSWORD_CHECK,
  MIN_PASSWORD_LENGTH,
} from "./authConstants";

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
 * ¿Esta persona es dueña? (GER-61)
 *
 * **Es un predicado, no una guarda: no lanza.** Por eso no puede sustituirse por
 * `requireOwnerId`, que sí lanza — `followUps.markDone` necesita preguntar el rol
 * sin abortar, porque no ser dueña es una respuesta válida cuando el seguimiento
 * sí es tuyo.
 *
 * Vive aquí y no en `convex/followUps.ts` por la regla declarada en la cabecera
 * de este archivo y en el README: la comparación de rol se escribe **una sola vez
 * en todo `convex/`**. El gate es `rg -n 'role\s*(===|!==)\s*"duena"' convex/`,
 * que debe devolver exactamente esta línea. No la dupliques en un módulo de
 * negocio para ahorrarte un import.
 *
 * No comprueba `status`: quien llama ya ha pasado por `requireActiveUserId`.
 */
export async function isOwnerRole(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  return user !== null && user.role === "duena";
}

/**
 * Igual que `requireActiveUserId`, pero además exige el rol `duena` (GER-48).
 *
 * Es la autoridad de "Gestión de usuarios": quién puede listar el equipo,
 * cambiar roles y cortar accesos. Vive aquí y no en `convex/users.ts` por la
 * misma razón que las otras dos: este archivo es el único sitio donde se decide
 * quién puede hacer qué, y repartir esa decisión por los módulos de negocio es
 * cómo se acaba con dos reglas que discrepan.
 *
 * El mensaje SÍ distingue "no eres dueña" de "no hay sesión", al revés que
 * `requireActiveUserId`. No es un descuido: para llegar aquí ya hace falta una
 * sesión válida y activa, así que quien lo lee es alguien que ya está dentro y
 * a quien no se le revela nada que no sepa — sabe que existe una pantalla que
 * no le corresponde porque la navegación no se la ofrece.
 *
 * Cuesta una lectura más de la ficha que `requireActiveUserId` ya hizo. A este
 * volumen no significa nada, y la alternativa —duplicar aquí la lógica de
 * `getActiveUserId` para ahorrarse un `get`— es exactamente lo que este archivo
 * existe para evitar.
 */
export async function requireOwnerId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireActiveUserId(ctx);

  // Delega en `isOwnerRole` (GER-61) en vez de repetir la comparación: así el
  // literal `"duena"` se compara en un solo sitio de todo `convex/` y el gate
  // del README tiene una salida esperada inequívoca.
  if (!(await isOwnerRole(ctx, userId))) {
    throw new Error("Solo la dueña puede gestionar usuarios.");
  }

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
 * Está partida a propósito. El enganche de la librería,
 * `validatePasswordRequirements`, recibe SOLO la contraseña y corre antes de
 * `profile()` (Password.ts:88, :130), así que nunca puede ver el correo. Si
 * hubiera una sola función que exigiera ambos, el enganche tendría que
 * inventarse un correo para poder llamarla. De ahí las tres piezas:
 *
 * - `validatePasswordRequirements(password)` — lo que se puede comprobar sin el
 *   correo. Es la que sigue recibiendo el enganche de `Password`.
 * - `validatePasswordLocalPart(password, email)` — solo la regla que necesita el
 *   correo. Desde GER-54 no la llama nadie directamente: el alta pasó a
 *   `PasswordSignUp` (convex/passwordLogin.ts), que tiene los dos datos y usa la
 *   función completa. Se conserva exportada porque es la mitad que da sentido al
 *   reparto: si mañana vuelve a hacer falta el enganche de la librería, la
 *   partición ya está hecha y documentada.
 * - `validatePassword(password, email)` — las dos juntas. La usan el canje del
 *   código (convex/passwordReset.ts) y el alta (convex/passwordLogin.ts), que
 *   tienen ambos datos de una vez.
 *
 * IMPORTANTE (GER-59): ninguna de estas corre al INICIAR SESIÓN. Solo al crear
 * la cuenta o al cambiar la contraseña. Si corrieran al entrar, endurecer la
 * política dejaría fuera a quien ya tuviera una contraseña que no la cumple.
 */

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
 * El texto de "contraseña demasiado corta", exportado (GER-54) porque lo
 * comparten esta función y las guardas de tipo de `PasswordSignUp`
 * (convex/passwordLogin.ts). No mandar la contraseña y mandarla corta tienen que
 * responder exactamente igual, y para eso el texto tiene que ser el mismo objeto
 * y no dos literales que alguien pueda editar por separado.
 */
export const MIN_PASSWORD_MESSAGE = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;

/**
 * Reglas que no dependen del correo. Lanza con el motivo; devolver un booleano
 * obligaría a cada sitio a inventarse el mensaje.
 *
 * La comprobación de tipo NO es redundante con la firma `password: string`
 * (GER-59). Esta función la invoca la librería, y lo hace con una aserción, no
 * con una comprobación: `passwordToValidate = params.password as string`
 * (Password.ts:123). Un `signUp` sin `password` llega aquí como `undefined`
 * —que no es `null`, así que pasa el filtro de Password.ts:129— y sin esta
 * guarda `password.length` reventaría con un TypeError. El validador por
 * defecto de la librería sí lo cubría (`!password ||`, Password.ts:251-255); al
 * sustituirlo hay que reponerlo.
 *
 * El mensaje es el mismo que para una contraseña corta, a propósito: no
 * mandarla y mandarla demasiado corta no merecen respuestas distinguibles.
 */
export function validatePasswordRequirements(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(MIN_PASSWORD_MESSAGE);
  }
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) {
    throw new Error("Esa contraseña es demasiado común. Elige otra.");
  }
}

/**
 * La única regla que necesita el correo. `email` debe llegar ya en forma
 * canónica (convex/email.ts): la comparación es en minúsculas, así que un correo
 * sin normalizar no rompe nada, pero pasarlo crudo aquí sería señal de que falta
 * normalizar más arriba.
 *
 * Se salta cuando la parte local es corta — ver
 * `MIN_LOCAL_PART_FOR_PASSWORD_CHECK` en convex/authConstants.ts, donde está
 * documentada la excepción y su motivo.
 */
export function validatePasswordLocalPart(
  password: string,
  email: string
): void {
  const localPart = email.split("@")[0] ?? "";
  if (localPart.length < MIN_LOCAL_PART_FOR_PASSWORD_CHECK) return;

  if (password.toLowerCase().includes(localPart.toLowerCase())) {
    throw new Error("La contraseña no puede contener tu correo.");
  }
}

/** La política completa: las reglas independientes más la del correo. */
export function validatePassword(password: string, email: string): void {
  validatePasswordRequirements(password);
  validatePasswordLocalPart(password, email);
}
