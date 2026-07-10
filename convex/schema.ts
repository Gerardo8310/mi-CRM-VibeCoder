import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Modelo de datos del MVP — 5 entidades (ver PRD en Notion, sección "Datos",
 * y GER-6 en Linear). El Cliente es el centro: interacciones, oportunidades
 * y seguimientos le pertenecen siempre a un solo cliente.
 */
export default defineSchema({
  // Tablas de Convex Auth (sesiones, cuentas, códigos de verificación).
  ...authTables,

  // Usuario — Carlos (vendedor) o Martha (dueña). Ver GER-7, GER-48, GER-49.
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("vendedor"), v.literal("duena")),
    status: v.union(v.literal("activo"), v.literal("inactivo")),
    // Soporte del flujo de invitación por correo (GER-48) — no es una función visible.
    invitedBy: v.optional(v.id("users")),
    invitedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // Cliente — a quien el negocio le vende. Ver GER-9, GER-10, GER-11.
  clients: defineTable({
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_name", ["name"]),

  // Interacción — llamada / mensaje / visita. Ver GER-12, GER-13.
  interactions: defineTable({
    clientId: v.id("clients"),
    date: v.number(),
    text: v.string(),
    type: v.optional(
      v.union(v.literal("llamada"), v.literal("mensaje"), v.literal("visita"))
    ),
    createdBy: v.id("users"),
  }).index("by_client", ["clientId"]),

  // Oportunidad (venta) — interesado / cotizado / cerrado. Ver GER-14, GER-15.
  opportunities: defineTable({
    clientId: v.id("clients"),
    product: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
    stage: v.union(
      v.literal("interesado"),
      v.literal("cotizado"),
      v.literal("cerrado")
    ),
    // "Días abierta" en el tablero se calcula desde createdAt — no se guarda aparte.
    createdAt: v.number(),
    closedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  })
    .index("by_client", ["clientId"])
    .index("by_stage", ["stage"]),

  // Seguimiento (recordatorio) — el corazón del "no perder ventas". Ver GER-16, GER-17.
  followUps: defineTable({
    clientId: v.id("clients"),
    opportunityId: v.optional(v.id("opportunities")),
    dueDate: v.number(),
    note: v.string(),
    status: v.union(v.literal("pendiente"), v.literal("hecho")),
    ownerId: v.id("users"),
  })
    .index("by_client", ["clientId"])
    .index("by_owner_status_dueDate", ["ownerId", "status", "dueDate"]),
});
