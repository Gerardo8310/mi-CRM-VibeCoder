import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Registra una oportunidad (venta) ligada a un cliente existente. Es la lógica
 * que reutilizan la pantalla de registro (GER-14) y el alta rápida desde "Hoy"
 * (GER-50). Al abrirse ya en "cerrado" se fija `closedAt`.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    stage: v.union(
      v.literal("interesado"),
      v.literal("cotizado"),
      v.literal("cerrado")
    ),
    amount: v.number(),
    product: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, stage, amount, product }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Necesitas iniciar sesión.");

    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("El cliente no existe.");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }

    const now = Date.now();
    return await ctx.db.insert("opportunities", {
      clientId,
      product: product?.trim() || "",
      amount,
      stage,
      createdAt: now,
      closedAt: stage === "cerrado" ? now : undefined,
      createdBy: userId,
    });
  },
});

// TODO(GER-14): updateStage (al pasar a "cerrado", fijar closedAt).
// TODO(GER-15): listByStage (tablero Kanban, ver Design/Tablero.dc.html).
// TODO(GER-18): monthlyClosedTotal / openPipelineByStage (para "Inicio").
