import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getActiveUserId, requireActiveUserId } from "./authz";
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
    const userId = await getActiveUserId(ctx);
    if (userId === null) return 0;
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
    const userId = await getActiveUserId(ctx);
    if (userId === null) {
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
    const userId = await requireActiveUserId(ctx);
    const followUp = await ctx.db.get(id);
    if (!followUp || followUp.ownerId !== userId) {
      throw new Error("No encontramos ese seguimiento o no te pertenece.");
    }
    await ctx.db.patch(id, { status: "hecho" });
  },
});

/**
 * Programa un seguimiento (recordatorio) para un cliente (GER-16). Nace en
 * estado "pendiente", ligado al cliente y al usuario que lo crea. Es la lógica
 * que reutilizan la ficha (botón "Agendar", cliente fijado) y el acceso rápido
 * "nueva tarea" desde "Hoy" (con selección de cliente). Puede ligarse opcional-
 * mente a una oportunidad **del mismo cliente**.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    note: v.string(),
    dueDate: v.number(),
    opportunityId: v.optional(v.id("opportunities")),
  },
  handler: async (ctx, { clientId, note, dueDate, opportunityId }) => {
    const userId = await requireActiveUserId(ctx);

    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("El cliente no existe.");

    const trimmed = note.trim();
    if (!trimmed) throw new Error("Escribe qué hacer.");
    if (!Number.isFinite(dueDate)) throw new Error("La fecha no es válida.");

    // El vínculo con oportunidad es opcional, pero si viene debe ser de este cliente.
    if (opportunityId) {
      const opportunity = await ctx.db.get(opportunityId);
      if (!opportunity || opportunity.clientId !== clientId) {
        throw new Error("La oportunidad no pertenece a este cliente.");
      }
    }

    return await ctx.db.insert("followUps", {
      clientId,
      opportunityId: opportunityId ?? undefined,
      dueDate,
      note: trimmed,
      status: "pendiente",
      ownerId: userId,
    });
  },
});

/**
 * Seguimientos **pendientes** de un cliente, para la sección "Pendientes" de su
 * ficha (GER-16). Los ya "hecho" no van aquí — aparecen en el historial
 * (`history.forClient`, GER-13). Recibe el id como string (viene de la ficha) y
 * lo normaliza: id inválido / sin sesión → `[]`. Orden por fecha ascendente
 * (lo más urgente arriba).
 */
export const listForClient = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getActiveUserId(ctx);
    if (userId === null) return [];
    const clientId = ctx.db.normalizeId("clients", id);
    if (!clientId) return [];

    const rows = await ctx.db
      .query("followUps")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    return rows
      .filter((f) => f.status === "pendiente")
      .sort((a, b) => a.dueDate - b.dueDate)
      .map((f) => ({
        _id: f._id,
        dueDate: f.dueDate,
        note: f.note,
        opportunityId: f.opportunityId,
      }));
  },
});
