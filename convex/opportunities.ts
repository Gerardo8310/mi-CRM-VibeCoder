import { query, mutation } from "./_generated/server";
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

/**
 * Oportunidades de un cliente, para el selector desplegable al agendar un
 * seguimiento (GER-16). Recibe el id como string y lo normaliza: id inválido /
 * sin sesión → `[]`. Orden por fecha de alta descendente (lo más reciente
 * arriba). Estará vacío hasta que la Fase 4 registre oportunidades.
 */
export const listForClient = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const clientId = ctx.db.normalizeId("clients", id);
    if (!clientId) return [];

    const rows = await ctx.db
      .query("opportunities")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({
        _id: o._id,
        product: o.product,
        amount: o.amount,
        stage: o.stage,
      }));
  },
});

// TODO(GER-14): updateStage (al pasar a "cerrado", fijar closedAt).
// TODO(GER-15): listByStage (tablero Kanban, ver Design/Tablero.dc.html).
// TODO(GER-18): monthlyClosedTotal / openPipelineByStage (para "Inicio").
