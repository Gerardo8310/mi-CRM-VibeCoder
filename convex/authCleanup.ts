import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { RESET_REQUEST_WINDOW_MS } from "./passwordReset";

// Generoso para completar el consentimiento de Google; ajustado para
// acotar cuánto puede persistir un verificador huérfano. Bajado de 10 a 5
// minutos en GER-57: el consentimiento de Google no tarda tanto, y cuanto
// menos vivan, menos puede crecer la tabla entre dos pasadas del cron.
const VERIFIER_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

// Cuántas filas borra como mucho cada pasada, por tabla. El límite real de
// Convex por transacción está bastante más arriba; 500 deja margen de sobra
// para que la mutación nunca se acerque a él.
const BATCH = 500;

// Tope de pasadas encadenadas. Existe para que una sola invocación —del cron o
// a mano— no pueda convertirse en una cadena indefinida: el contador viaja como
// argumento explícito y decrece, así que la cadena es finita por construcción y
// no depende de que el estado de la base la detenga.
const MAX_CHAINED_BATCHES = 10;

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
 *
 * Por qué por índice y en lotes (GER-57 · Issue 2.4): las dos tablas las puede
 * engordar alguien sin cuenta —cualquiera puede empezar un consentimiento de
 * Google y abandonarlo—, y la versión anterior hacía `.filter(...).collect()`,
 * que lee la tabla ENTERA. Si llegaba a superar el límite de lectura por
 * transacción, el cron empezaba a fallar en cada pasada y dejaba de limpiar
 * justo cuando más falta hacía: el fallo se agrava a sí mismo. Con un índice y
 * un tope por pasada, el coste de cada ejecución está acotado de antemano.
 *
 * Los contadores del retorno son la señal de monitorización: si `chainedAnother`
 * sale `true` varias pasadas seguidas, es que algo está creciendo más rápido de
 * lo que se limpia.
 */
export const pruneStaleAuthRecords = internalMutation({
  args: {
    /**
     * Cuántas pasadas quedan disponibles en esta cadena. El cron no lo manda:
     * cada invocación suya arranca una cadena nueva con el tope entero.
     */
    batchesLeft: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchesLeft = args.batchesLeft ?? MAX_CHAINED_BATCHES;
    const now = Date.now();

    // `by_creation_time` es un índice de sistema: aquí sí vale, porque un
    // verificador nunca se reutiliza ni se reescribe.
    const staleVerifiers = await ctx.db
      .query("authVerifiers")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", now - VERIFIER_MAX_AGE_MS)
      )
      .take(BATCH);

    const staleResetRequests = await ctx.db
      .query("passwordResetRequests")
      .withIndex("by_window", (q) =>
        q.lt("windowStart", now - RESET_REQUEST_WINDOW_MS)
      )
      .take(BATCH);

    await Promise.all([
      ...staleVerifiers.map((doc) => ctx.db.delete(doc._id)),
      ...staleResetRequests.map((doc) => ctx.db.delete(doc._id)),
    ]);

    // Un lote lleno significa que casi seguro queda más por barrer.
    const batchWasFull =
      staleVerifiers.length === BATCH || staleResetRequests.length === BATCH;
    const remaining = batchesLeft - 1;
    const chainedAnother = batchWasFull && remaining > 0;

    if (chainedAnother) {
      await ctx.scheduler.runAfter(
        0,
        internal.authCleanup.pruneStaleAuthRecords,
        { batchesLeft: remaining }
      );
    }

    return {
      verifiersDeleted: staleVerifiers.length,
      resetRequestsDeleted: staleResetRequests.length,
      chainedAnother,
      batchesLeft: remaining,
    };
  },
});
