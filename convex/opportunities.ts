import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getActiveUserId, requireActiveUserId } from "./authz";

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
    product: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, stage, amount, product, note }) => {
    const userId = await requireActiveUserId(ctx);

    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("El cliente no existe.");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }
    // Producto obligatorio (GER-14): toda oportunidad describe qué se ofreció.
    const trimmedProduct = product.trim();
    if (!trimmedProduct) throw new Error("El producto es obligatorio.");

    const now = Date.now();
    return await ctx.db.insert("opportunities", {
      clientId,
      product: trimmedProduct,
      note: note?.trim() || undefined,
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
    const userId = await getActiveUserId(ctx);
    if (userId === null) return [];
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

/**
 * Todas las oportunidades del negocio con el nombre del cliente resuelto, para
 * el tablero Kanban (GER-15). La UI las agrupa por etapa. Negocio pequeño: se
 * traen todas y se resuelve el nombre por fila (patrón de followUps.withClientName).
 */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getActiveUserId(ctx);
    if (userId === null) return [];
    const opportunities = await ctx.db.query("opportunities").collect();
    return Promise.all(
      opportunities.map(async (o) => {
        const client = await ctx.db.get(o.clientId);
        return {
          _id: o._id,
          clientId: o.clientId,
          clientName: client?.name ?? "Cliente sin nombre",
          product: o.product,
          amount: o.amount,
          stage: o.stage,
          createdAt: o.createdAt,
          closedAt: o.closedAt,
        };
      })
    );
  },
});

/**
 * Cambia la etapa de una oportunidad (mover en el tablero, GER-15). Al pasar a
 * "cerrado" se fija la fecha de cierre; al salir de "cerrado" se limpia (reabrir).
 */
export const updateStage = mutation({
  args: {
    id: v.id("opportunities"),
    stage: v.union(
      v.literal("interesado"),
      v.literal("cotizado"),
      v.literal("cerrado")
    ),
  },
  handler: async (ctx, { id, stage }) => {
    const userId = await requireActiveUserId(ctx);
    const opportunity = await ctx.db.get(id);
    if (!opportunity) throw new Error("La oportunidad no existe.");
    await ctx.db.patch(id, {
      stage,
      closedAt:
        stage === "cerrado" ? (opportunity.closedAt ?? Date.now()) : undefined,
    });
  },
});

// TODO(GER-18): monthlyClosedTotal / openPipelineByStage (para "Inicio").
