import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveUserId } from "./authz";

/**
 * Anota una interacción (llamada/mensaje/visita) ligada a un cliente existente.
 * Es la lógica que reutilizan la ficha (GER-12) y el alta rápida desde "Hoy"
 * (GER-50). Sin fecha explícita, queda registrada ahora.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    type: v.union(
      v.literal("llamada"),
      v.literal("mensaje"),
      v.literal("visita")
    ),
    text: v.string(),
    date: v.optional(v.number()),
  },
  handler: async (ctx, { clientId, type, text, date }) => {
    const userId = await requireActiveUserId(ctx);

    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("El cliente no existe.");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Escribe qué pasó.");
    if (date !== undefined && !Number.isFinite(date)) {
      throw new Error("La fecha no es válida.");
    }

    return await ctx.db.insert("interactions", {
      clientId,
      type,
      text: trimmed,
      date: date ?? Date.now(),
      createdBy: userId,
    });
  },
});
