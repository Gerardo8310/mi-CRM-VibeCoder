import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * Una entrada del historial del cliente (GER-13). Es una unión discriminada por
 * `kind`: la línea de tiempo combina tres fuentes distintas en una sola lista.
 */
export type TimelineEntry =
  | {
      kind: "interaction";
      id: Id<"interactions">;
      date: number;
      intType: "llamada" | "mensaje" | "visita";
      text: string;
    }
  | {
      kind: "opportunity";
      id: Id<"opportunities">;
      date: number;
      product: string;
      amount: number;
      stage: "interesado" | "cotizado" | "cerrado";
    }
  | {
      kind: "followup";
      id: Id<"followUps">;
      date: number;
      note: string;
    };

/**
 * Historial del cliente (GER-13): línea de tiempo que combina interacciones,
 * oportunidades (como hitos) y seguimientos ya marcados "hecho", ordenada de lo
 * más reciente a lo más antiguo. Cada fuente vive en su tabla y se une aquí por
 * el índice `by_client`. Las filas de oportunidad y de seguimiento completado
 * empezarán a aparecer cuando las Fases 4 y 5 generen esos datos.
 *
 * Recibe el id como string (viene de la URL) y lo normaliza igual que
 * `clients.get`: un id inválido devuelve `[]` en vez de lanzar error. Sin sesión
 * devuelve `[]`, por consistencia con `clients.list`/`get`.
 */
export const forClient = query({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<TimelineEntry[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const clientId = ctx.db.normalizeId("clients", id);
    if (!clientId) return [];

    const [interactions, opportunities, followUps] = await Promise.all([
      ctx.db
        .query("interactions")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
      ctx.db
        .query("opportunities")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
      ctx.db
        .query("followUps")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    ]);

    const entries: TimelineEntry[] = [
      ...interactions.map(
        (i): TimelineEntry => ({
          kind: "interaction",
          id: i._id,
          date: i.date,
          // `type` es opcional en el esquema (datos viejos) → default "llamada".
          intType: i.type ?? "llamada",
          text: i.text,
        })
      ),
      ...opportunities.map(
        (o): TimelineEntry => ({
          kind: "opportunity",
          id: o._id,
          date: o.createdAt,
          product: o.product,
          amount: o.amount,
          stage: o.stage,
        })
      ),
      ...followUps
        .filter((f) => f.status === "hecho")
        .map(
          (f): TimelineEntry => ({
            kind: "followup",
            id: f._id,
            // TODO(Fase 5): followUps no guarda `completedAt`; se usa `dueDate`
            // como fecha del hito. Revisar si GER-16 añade la fecha de completado.
            date: f.dueDate,
            note: f.note,
          })
        ),
    ];

    // Lo más reciente arriba.
    entries.sort((a, b) => b.date - a.date);
    return entries;
  },
});
