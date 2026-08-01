import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getActiveUserId, requireOwnerId } from "./authz";
import { sinContrasena } from "./invitations";

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

/**
 * Gestión de usuarios (GER-48). Las tres funciones que alimentan la pantalla 7.
 *
 * LAS DOS REGLAS QUE LAS GOBIERNAN, Y POR QUÉ
 *
 * 1. **Autoriza `requireOwnerId`** (convex/authz.ts), no una comprobación de rol
 *    escrita aquí. La pantalla también esconde el acceso a quien no es dueña,
 *    pero eso es interfaz: el control es este.
 *
 * 2. **Nadie se edita a sí misma.** La maqueta ya lo dibuja —la fila propia no
 *    tiene botón de editar— y aquí se hace cierto. No es solo coherencia
 *    visual: es lo que garantiza, sin necesidad de contarlas, que **nunca se
 *    quede el CRM sin ninguna dueña activa**. Quien ejecuta estas mutaciones es
 *    por fuerza una dueña activa, y si no puede tocar su propia ficha, sigue
 *    siéndolo cuando la mutación termina. Contar dueñas sería código que no
 *    puede dispararse nunca.
 */

/**
 * Todo el equipo, para la pantalla de gestión (GER-48).
 *
 * `sinContrasena` viaja YA RESUELTO y `passwordSetAt` no sale de aquí: la regla
 * que distingue a un invitado que aún no ha entrado vive en un solo sitio
 * (convex/invitations.ts) y el cliente no tiene por qué conocerla. Mandar los
 * campos crudos sería tener la misma regla escrita dos veces, en dos lenguajes,
 * con dos oportunidades de que divergan.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireOwnerId(ctx);

    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      invitedAt: u.invitedAt,
      sinContrasena: sinContrasena(u),
    }));
  },
});

/** Cambia el rol de otra persona. El correo no se toca nunca (ver la maqueta). */
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("vendedor"), v.literal("duena")),
  },
  handler: async (ctx, { userId, role }) => {
    const ownerId = await requireOwnerId(ctx);
    if (userId === ownerId) {
      throw new Error("No puedes cambiar tu propio rol.");
    }

    const user = await ctx.db.get(userId);
    if (user === null) throw new Error("Ese usuario no existe.");

    await ctx.db.patch(userId, { role });
  },
});

/**
 * Activa o desactiva a alguien. Al desactivar, **le corta el acceso de verdad**.
 *
 * Esto es la deuda que el README tenía asignada a este issue. El control de
 * acceso ya funcionaba sin ello —`requireActiveUserId` deniega en la siguiente
 * llamada, GER-56— pero sus sesiones y refresh tokens seguían vivos en la base
 * hasta caducar, hasta 30 días después. Borrarlos es higiene, y además cierra
 * la ventana del JWT ya emitido: sin refresh token no hay renovación, así que
 * pasados 15 minutos (`jwt.durationMs`) no le queda nada.
 *
 * Se replica `deleteSession` de la librería
 * (server/implementation/sessions.js:48): la sesión y TODOS sus refresh tokens.
 * Se borran también los códigos de verificación de sus cuentas, para que un
 * código de recuperación ya enviado no sobreviva a la desactivación.
 *
 * LO QUE ESTO NO PROMETE: no revoca operaciones en vuelo. Una solicitud de
 * código que ya hubiera pasado su comprobación de estado puede crear el código
 * después de este borrado, porque son transacciones distintas. Es inofensivo
 * —quien está inactivo no puede canjearlo, `password-reset-verify` lo comprueba
 * antes de consumirlo— y el código caduca solo en 15 minutos.
 */
export const setStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("activo"), v.literal("inactivo")),
  },
  handler: async (ctx, { userId, status }) => {
    const ownerId = await requireOwnerId(ctx);
    if (userId === ownerId) {
      throw new Error("No puedes desactivar tu propia cuenta.");
    }

    const user = await ctx.db.get(userId);
    if (user === null) throw new Error("Ese usuario no existe.");

    await ctx.db.patch(userId, { status });

    if (status === "inactivo") {
      await revokeAccess(ctx, userId);
    }
  },
});

/**
 * Borra todo lo que permitiría a `userId` seguir dentro: sesiones, refresh
 * tokens y códigos de verificación pendientes.
 *
 * No usa `invalidateSessions` de la librería porque esa exportación va contra
 * la acción `auth:store` y aquí ya estamos dentro de una mutación, con acceso
 * directo a las mismas tablas y a los mismos índices.
 */
async function revokeAccess(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionIdAndParentRefreshTokenId", (q) =>
        q.eq("sessionId", session._id)
      )
      .collect();
    for (const token of refreshTokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }

  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();

  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) await ctx.db.delete(code._id);
  }
}

// TODO(GER-49): updateName / changePassword.
