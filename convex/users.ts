import { query } from "./_generated/server";
import { getActiveUserId } from "./authz";

/**
 * Usuario en sesión, incluido su rol — decide el landing (Carlos -> /hoy,
 * Martha -> /inicio, ver GER-7) y si se muestra el acceso "Usuarios" en la
 * navegación (GER-8).
 *
 * EXCEPCIÓN DELIBERADA (GER-56): esta es la única función protegida que usa
 * `getActiveUserId` en vez de `requireActiveUserId`. Tiene que devolver `null`,
 * no lanzar: la interfaz distingue `null` ("no deberías estar aquí" → cerrar
 * sesión, ver src/components/nav/session-guard.tsx) de una excepción ("algo
 * falló"), y con la variante que lanza no podría diferenciarlas. No la
 * "uniformices" con el resto.
 *
 * Un usuario desactivado ve `null` aquí, igual que uno sin sesión — el control
 * de acceso de verdad está en las demás funciones de convex/, que sí lanzan.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getActiveUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

// TODO(GER-48): list / invite / updateRole / setStatus (activar-desactivar).
//   `setStatus` a "inactivo" debe además borrar las `authSessions` del usuario
//   y sus refresh tokens (ver convex/authz.ts). Con GER-56 en su sitio eso es
//   higiene —el acceso ya falla en la siguiente llamada—, no la condición de
//   seguridad.
// TODO(GER-49): updateName / changePassword.
