import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fila de seguimiento ya resuelta con el nombre de su cliente, lista para la UI. */
export type FollowUpRow = {
  _id: Id<"followUps">;
  clientId: Id<"clients">;
  clientName: string;
  dueDate: number;
  note: string;
};

/** Une cada seguimiento con el nombre de su cliente (una lectura por fila). */
async function withClientName(
  ctx: QueryCtx,
  rows: Doc<"followUps">[]
): Promise<FollowUpRow[]> {
  return Promise.all(
    rows.map(async (f) => {
      const client = await ctx.db.get(f.clientId);
      return {
        _id: f._id,
        clientId: f.clientId,
        clientName: client?.name ?? "Cliente sin nombre",
        dueDate: f.dueDate,
        note: f.note,
      };
    })
  );
}

/**
 * Conteo de pendientes para la insignia de "Hoy" en la navegación (GER-8).
 * Solo cuenta atrasados + los de hoy (`dueDate <= endOfDay`) para que coincida
 * con lo que se ve dentro de la pantalla "Hoy" y no marque como urgentes los
 * seguimientos de días futuros. El límite superior va sobre el índice, así que
 * la consulta no recorre todos los pendientes del usuario.
 *
 * `endOfDay` lo calcula el cliente (conoce su zona horaria) — ver src/lib/dates.ts.
 */
export const pendingCountForViewer = query({
  args: { endOfDay: v.number() },
  handler: async (ctx, { endOfDay }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const due = await ctx.db
      .query("followUps")
      .withIndex("by_owner_status_dueDate", (q) =>
        q
          .eq("ownerId", userId)
          .eq("status", "pendiente")
          .lte("dueDate", endOfDay)
      )
      .collect();
    return due.length;
  },
});

/**
 * Datos de la pantalla "Hoy" (GER-17), en dos grupos:
 *  - `pending`:  atrasados + de hoy (`dueDate <= endOfToday`), orden ascendente
 *    por fecha (los más viejos primero). La UI los separa en "Atrasados" y
 *    "Para hoy" según la fecha local.
 *  - `upcoming`: los de los próximos 7 días, para el mini calendario de escritorio.
 *
 * Las fronteras del día llegan del cliente para respetar su zona horaria.
 */
export const listForViewer = query({
  args: { endOfToday: v.number() },
  handler: async (ctx, { endOfToday }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { pending: [] as FollowUpRow[], upcoming: [] as FollowUpRow[] };
    }

    const pendingRows = await ctx.db
      .query("followUps")
      .withIndex("by_owner_status_dueDate", (q) =>
        q
          .eq("ownerId", userId)
          .eq("status", "pendiente")
          .lte("dueDate", endOfToday)
      )
      .collect();

    const upcomingRows = await ctx.db
      .query("followUps")
      .withIndex("by_owner_status_dueDate", (q) =>
        q
          .eq("ownerId", userId)
          .eq("status", "pendiente")
          .gt("dueDate", endOfToday)
          .lte("dueDate", endOfToday + 7 * DAY_MS)
      )
      .collect();

    return {
      pending: await withClientName(ctx, pendingRows),
      upcoming: await withClientName(ctx, upcomingRows),
    };
  },
});

/**
 * Marca un seguimiento como hecho (botón "Hecho" en "Hoy", GER-17). Solo el
 * dueño del seguimiento puede completarlo.
 */
export const markDone = mutation({
  args: { id: v.id("followUps") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Necesitas iniciar sesión.");
    const followUp = await ctx.db.get(id);
    if (!followUp || followUp.ownerId !== userId) {
      throw new Error("No encontramos ese seguimiento o no te pertenece.");
    }
    await ctx.db.patch(id, { status: "hecho" });
  },
});

// TODO(GER-16): create (programar seguimiento, opcionalmente ligado a una oportunidad).
