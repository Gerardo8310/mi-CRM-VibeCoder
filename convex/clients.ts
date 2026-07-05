import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Crea un cliente (nombre y teléfono obligatorios, correo y nota opcionales).
 * Es la lógica que reutilizan la pantalla "Nuevo cliente" (GER-9) y el alta
 * rápida desde "Hoy" (GER-50). Guarda fecha de alta (`_creationTime`, auto) y
 * el usuario que lo registró.
 */
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { name, phone, email, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Necesitas iniciar sesión.");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) throw new Error("El nombre es obligatorio.");
    if (!trimmedPhone) throw new Error("El teléfono es obligatorio.");

    return await ctx.db.insert("clients", {
      name: trimmedName,
      phone: trimmedPhone,
      email: email?.trim() || undefined,
      note: note?.trim() || undefined,
      createdBy: userId,
    });
  },
});

/**
 * Todos los clientes del negocio, ordenados por nombre — alimenta la lista con
 * buscador (GER-10). El filtrado/resaltado por término se hace en el cliente
 * (negocio pequeño: se traen todos y se filtran en memoria en la UI).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const clients = await ctx.db.query("clients").withIndex("by_name").collect();
    return clients.map((c) => ({
      _id: c._id,
      name: c.name,
      phone: c.phone,
      email: c.email,
    }));
  },
});

/**
 * Un cliente por id, para su ficha (GER-11). Recibe el id como string (viene
 * de la URL) y lo normaliza: un `clientId` inválido (p. ej. `/clientes/foo`)
 * devuelve `null` en vez de lanzar error de validación → estado controlado.
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const clientId = ctx.db.normalizeId("clients", id);
    if (!clientId) return null;
    return await ctx.db.get(clientId);
  },
});

/** Edita los datos del cliente desde su ficha (GER-11). */
export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, phone, email, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Necesitas iniciar sesión.");

    const client = await ctx.db.get(id);
    if (!client) throw new Error("El cliente no existe.");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) throw new Error("El nombre es obligatorio.");
    if (!trimmedPhone) throw new Error("El teléfono es obligatorio.");

    await ctx.db.patch(id, {
      name: trimmedName,
      phone: trimmedPhone,
      email: email?.trim() || undefined,
      note: note?.trim() || undefined,
    });
  },
});

/**
 * Búsqueda de clientes por nombre o teléfono — alimenta el autocompletado del
 * alta rápida de venta e interacción (GER-50). Con término vacío devuelve los
 * primeros por nombre.
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
