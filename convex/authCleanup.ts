import { internalMutation } from "./_generated/server";
import { RESET_REQUEST_WINDOW_MS } from "./passwordReset";

// Generoso para completar el consentimiento de Google; ajustado para
// acotar cuánto puede persistir un verificador huérfano.
const VERIFIER_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Barrido periódico de restos de autenticación. Un solo cron para las dos
 * tablas (ver convex/crons.ts).
 *
 * 1. `authVerifiers` (GER-51 · hallazgo de auditoría M1): @convex-dev/auth
 *    solo borra el verificador de un intento de OAuth cuando el login se
 *    completa con éxito — el `ctx.db.delete(verifier._id)` de
 *    src/server/implementation/mutations/userOAuth.ts ocurre después de
 *    `upsertUserAndAccount`, nunca antes. Si nuestro callback rechaza una
 *    cuenta de Google no provisionada, o si alguien abandona el consentimiento
 *    a medias, esa fila queda huérfana para siempre: la librería no la limpia
 *    sola y no expone un hook para hacerlo desde nuestro callback.
 *
 * 2. `passwordResetRequests` (GER-53 · hallazgo de auditoría M2): filas del
 *    límite de solicitudes cuya ventana ya expiró. A partir de ese momento no
 *    restringen nada — `consumeResetSlot` las reiniciaría igual — así que solo
 *    ocupan espacio.
 */
export const pruneStaleAuthRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const staleVerifiers = await ctx.db
      .query("authVerifiers")
      .filter((q) => q.lt(q.field("_creationTime"), now - VERIFIER_MAX_AGE_MS))
      .collect();

    const staleResetRequests = await ctx.db
      .query("passwordResetRequests")
      .filter((q) =>
        q.lt(q.field("windowStart"), now - RESET_REQUEST_WINDOW_MS)
      )
      .collect();

    await Promise.all([
      ...staleVerifiers.map((doc) => ctx.db.delete(doc._id)),
      ...staleResetRequests.map((doc) => ctx.db.delete(doc._id)),
    ]);

    return {
      verifiersDeleted: staleVerifiers.length,
      resetRequestsDeleted: staleResetRequests.length,
    };
  },
});
