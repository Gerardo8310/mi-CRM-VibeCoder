import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Usuario en sesión, incluido su rol — decide el landing (Carlos -> /hoy,
 * Martha -> /inicio, ver GER-7) y si se muestra el acceso "Usuarios" en la
 * navegación (GER-8).
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// TODO(GER-48): list / invite / updateRole / setStatus (activar-desactivar).
// TODO(GER-49): updateName / changePassword.
