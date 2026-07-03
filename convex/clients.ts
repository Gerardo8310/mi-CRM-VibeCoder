import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Crea un cliente (nombre y teléfono obligatorios). Es la lógica que reutilizan
 * tanto la pantalla "Nuevo cliente" (GER-9) como el alta rápida desde "Hoy"
 * (GER-50). El correo y otros campos se completan luego desde la ficha.
 */
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { name, phone, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Necesitas iniciar sesión.");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) throw new Error("El nombre es obligatorio.");
    if (!trimmedPhone) throw new Error("El teléfono es obligatorio.");

    return await ctx.db.insert("clients", {
      name: trimmedName,
      phone: trimmedPhone,
      note: note?.trim() || undefined,
      createdBy: userId,
    });
  },
});

/**
 * Búsqueda de clientes por nombre o teléfono — alimenta el autocompletado del
 * alta rápida de venta e interacción (GER-50) y, más adelante, la lista de
 * clientes (GER-10). Con término vacío devuelve los primeros por nombre.
 *
 * Para el MVP recorre la tabla en memoria (negocio pequeño); cuando la lista
 * crezca conviene un índice de búsqueda de texto de Convex.
 */
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const all = await ctx.db.query("clients").withIndex("by_name").collect();
    const needle = term.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");

    const matched = needle
      ? all.filter((c) => {
          const byName = c.name.toLowerCase().includes(needle);
          const byPhone =
            digits.length > 0 && c.phone.replace(/\D/g, "").includes(digits);
          return byName || byPhone;
        })
      : all;

    return matched.slice(0, 8).map((c) => ({
      _id: c._id,
      name: c.name,
      phone: c.phone,
    }));
  },
});

// TODO(GER-10): list (lista completa con estados, ver Design/Clientes.dc.html).
// TODO(GER-11): get / update (Ficha de cliente — datos y edición).
