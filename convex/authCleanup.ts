import { internalMutation } from "./_generated/server";

// Generoso para completar el consentimiento de Google; ajustado para
// acotar cuánto puede persistir un verificador huérfano.
const VERIFIER_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Limpieza periódica (GER-51 · hallazgo de auditoría M1): @convex-dev/auth
 * solo borra el `authVerifiers` de un intento de OAuth cuando el login
 * se completa con éxito (ver node_modules/@convex-dev/auth/dist/server/
 * implementation/mutations/userOAuth.js — el `ctx.db.delete(verifier._id)`
 * ocurre después de `upsertUserAndAccount`, nunca antes). Si nuestro
 * callback rechaza una cuenta de Google no provisionada, o si alguien
 * abandona el consentimiento a medias, esa fila queda huérfana para
 * siempre — la librería no la limpia sola y no expone un hook para
 * hacerlo desde nuestro callback. Este cron la elimina pasado un margen
 * corto, sin depender de cambios en la librería.
 */
export const pruneStaleVerifiers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - VERIFIER_MAX_AGE_MS;
    const stale = await ctx.db
      .query("authVerifiers")
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .collect();
    await Promise.all(stale.map((doc) => ctx.db.delete(doc._id)));
    return { deleted: stale.length };
  },
});
