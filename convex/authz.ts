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
