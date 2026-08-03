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
    // Cuándo eligió esta persona su contraseña (GER-48, rama 2).
    //
    // Su ausencia NO significa "no tiene contraseña": las fichas anteriores a
    // este cambio —la de Martha— tampoco lo tienen y sí la tienen. Lo que
    // distingue a un invitado que aún no ha entrado es la conjunción con
    // `invitedAt`, y esa regla vive en un solo sitio: `sinContrasena`
    // (convex/invitations.ts). No deducirla campo a campo en ningún otro lado.
    passwordSetAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // Límite de solicitudes de recuperación de contraseña (GER-53 · auditoría M2).
  // La librería solo limita los intentos de *verificar* un código, no los de
  // pedirlo, y cada petición nueva destruye el código anterior — sin esto,
  // alguien podría dejar a un usuario sin poder recuperar nunca su cuenta.
  // Las filas caducadas las barre el cron de convex/authCleanup.ts.
  passwordResetRequests: defineTable({
    email: v.string(),
    count: v.number(),
    windowStart: v.number(),
    lastRequestAt: v.number(),
  })
    .index("by_email", ["email"])
    // Para que el cron barra por rango en vez de leerse la tabla entera
    // (GER-57 · Issue 2.4). No sirve el índice de sistema `by_creation_time`:
    // `consumeResetSlot` reutiliza la fila y reinicia `windowStart`, así que una
    // fila antigua puede tener una ventana recién abierta.
    .index("by_window", ["windowStart"]),

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
  })
    .index("by_client", ["clientId"])
    // "Actividad reciente" de Inicio (GER-18): las últimas interacciones de
    // TODOS los clientes. `by_client` no sirve para eso y sin índice habría que
    // recorrer la tabla entera en la pantalla de aterrizaje de la dueña.
    //
    // Va sobre `date` y no sobre el índice de sistema `by_creation_time` porque
    // no son lo mismo: `date` es opcional en el alta y sirve para registrar una
    // llamada de ayer. Se ordena por cuándo ocurrió, no por cuándo se tecleó.
    .index("by_date", ["date"]),

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
    /**
     * Etapa + fecha de cierre (GER-18). Sustituye al antiguo `by_stage`, que era
     * solo `["stage"]` y no tenía ningún consumidor.
     *
     * El segundo campo es lo que hace falta: "ventas de este mes" con `by_stage`
     * recorría TODAS las oportunidades cerradas de la historia del negocio y
     * descartaba en memoria las de otros meses, así que el coste de abrir
     * "Inicio" crecía para siempre. Con el compuesto, la consulta acota
     * `gte("closedAt", inicioMesAnterior)` y lee dos meses.
     *
     * Sigue sirviendo para consultar solo por etapa —el prefijo de un índice
     * compuesto es un índice—, que es lo que necesita el pipeline abierto.
     *
     * `closedAt` es opcional, y eso juega a favor: un campo ausente ordena antes
     * que cualquier valor, así que una oportunidad "cerrado" sin fecha de cierre
     * queda fuera del rango por construcción, que es justo lo que se quiere
     * (no se le puede atribuir ningún mes).
     */
    .index("by_stage_closedAt", ["stage", "closedAt"]),

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
