import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getActiveUserId } from "./authz";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * "Inicio / Resumen del negocio" (GER-18). Ver Design/Inicio.dc.html.
 *
 * UNA SOLA CONSULTA PARA LOS CINCO BLOQUES, y es deliberado. Cinco consultas
 * serían cinco estados de carga que se resuelven en distinto orden: durante ese
 * intervalo la pantalla puede decidir "el CRM está vacío" con datos a medio
 * llegar y enseñar el bloque de vacío para retirarlo un instante después. Una
 * sola es una foto coherente, un solo esqueleto y un solo sitio que auditar.
 *
 * Y por eso vive en su propio archivo y no repartida entre `clients.ts`,
 * `opportunities.ts`, `followUps.ts` e `interactions.ts`: la definición de "este
 * mes" se escribiría en cuatro sitios con el riesgo de que acaben discrepando.
 *
 * EL SERVIDOR NO ESCRIBE FRASES. Devuelve los números crudos y las dos cifras de
 * cada comparación; quien redacta "2 más que el mes pasado" o elige la flecha es
 * la interfaz. Así la misma cifra puede contarse de otra forma sin tocar esto.
 */

const ETAPAS_ABIERTAS = ["interesado", "cotizado"] as const;

/** Cuántas interacciones lleva "Actividad reciente" — las de la maqueta. */
const ACTIVIDAD_LIMITE = 5;

export type EtapaAbierta = (typeof ETAPAS_ABIERTAS)[number];

export type ResumenActividad = {
  id: Id<"interactions">;
  clientId: Id<"clients">;
  clientName: string;
  tipo: "llamada" | "mensaje" | "visita";
  texto: string;
  fecha: number;
};

export type Resumen = {
  clientesNuevos: { valor: number; anterior: number };
  ventas: {
    monto: number;
    cantidad: number;
    montoAnterior: number;
    cantidadAnterior: number;
  };
  pendientes: {
    total: number;
    atrasados: number;
    cargaActual: number;
    cargaAnterior: number;
  };
  pipeline: {
    total: number;
    cantidad: number;
    porEtapa: { etapa: EtapaAbierta; cantidad: number; monto: number }[];
  };
  actividad: ResumenActividad[];
  crmVacio: boolean;
};

/**
 * Las seis fronteras las calcula el navegador y viajan como argumentos: el
 * servidor no conoce la zona horaria del usuario. Es la misma regla que ya
 * siguen `followUps.listForViewer` y `pendingCountForViewer` — ver la cabecera
 * de src/lib/dates.ts.
 *
 * Se pasan las seis y no dos con aritmética aquí dentro porque `dueDate` son
 * medianoches locales: restar `7 * DAY_MS` desplaza la frontera una hora al
 * cruzar un cambio de horario y puede meter o sacar un día entero del recuento.
 * Ver src/lib/use-resumen-fronteras.ts, que las construye por calendario.
 */
const fronteras = {
  inicioMes: v.number(),
  inicioMesAnterior: v.number(),
  inicioCargaActual: v.number(),
  inicioCargaAnterior: v.number(),
  inicioDeHoy: v.number(),
  finDeHoy: v.number(),
};

/**
 * Bloque 1 — clientes dados de alta este mes y el anterior.
 *
 * La fecha de alta es `_creationTime` (ver `clients.create`), así que el índice
 * de sistema `by_creation_time` acota los dos meses sin necesidad de campo ni
 * índice propios.
 */
async function contarClientes(
  ctx: QueryCtx,
  inicioMes: number,
  inicioMesAnterior: number
) {
  const desdeElMesAnterior = await ctx.db
    .query("clients")
    .withIndex("by_creation_time", (q) =>
      q.gte("_creationTime", inicioMesAnterior)
    )
    .collect();

  let valor = 0;
  let anterior = 0;
  for (const c of desdeElMesAnterior) {
    if (c._creationTime >= inicioMes) valor++;
    else anterior++;
  }
  return { valor, anterior };
}

/**
 * Bloque 2 — ventas cerradas de este mes y del anterior, en cantidad y monto.
 *
 * El rango del índice es lo que impide que esto crezca sin fin: sin el segundo
 * campo de `by_stage_closedAt` habría que recorrer todas las ventas cerradas de
 * la historia para quedarse con dos meses.
 *
 * Una oportunidad "cerrado" **sin** `closedAt` no entra en ningún periodo, y no
 * hace falta descartarla a mano: un campo ausente ordena antes que cualquier
 * valor, así que el `gte` ya la deja fuera. No se le inventa una fecha.
 */
async function sumarVentas(
  ctx: QueryCtx,
  inicioMes: number,
  inicioMesAnterior: number
) {
  const cerradas = await ctx.db
    .query("opportunities")
    .withIndex("by_stage_closedAt", (q) =>
      q.eq("stage", "cerrado").gte("closedAt", inicioMesAnterior)
    )
    .collect();

  let monto = 0;
  let cantidad = 0;
  let montoAnterior = 0;
  let cantidadAnterior = 0;

  for (const o of cerradas) {
    // El rango ya garantiza que existe; el guardia es para el tipo.
    const cerradaEn = o.closedAt ?? 0;
    if (cerradaEn >= inicioMes) {
      monto += o.amount;
      cantidad++;
    } else {
      montoAnterior += o.amount;
      cantidadAnterior++;
    }
  }

  return { monto, cantidad, montoAnterior, cantidadAnterior };
}

/**
 * Bloque 3 — pendientes del USUARIO EN SESIÓN, no del negocio.
 *
 * Tiene que ser así: la tarjeta lleva a "Hoy", y "Hoy" muestra los seguimientos
 * propios. Si aquí se contaran los de todo el mundo, tocar el número llevaría a
 * una pantalla con otro número. El filtro es idéntico al de
 * `followUps.pendingCountForViewer`, que alimenta la insignia de navegación.
 *
 * LA TENDENCIA NO ES "cuántos pendientes había hace una semana": ese dato no
 * existe, porque `followUps` no guarda cuándo se marcó "hecho" (ver el TODO de
 * convex/history.ts). Se mide la CARGA — cuántos seguimientos vencieron en cada
 * periodo, sin mirar su estado —, que sí es reconstruible y responde a "¿esta
 * semana me cayó más trabajo que la pasada?".
 *
 * Y de ahí salen dos consultas y no una: en `by_owner_status_dueDate` el campo
 * `status` va ENTRE `ownerId` y `dueDate`, así que no se puede acotar el rango
 * de fechas sin fijar antes el estado. Una consulta "de cualquier estado"
 * tendría que renunciar al rango y leerse todos los seguimientos del usuario.
 */
async function contarPendientes(
  ctx: QueryCtx,
  userId: Id<"users">,
  inicioCargaActual: number,
  inicioCargaAnterior: number,
  inicioDeHoy: number,
  finDeHoy: number
) {
  const vencidosHoy = await ctx.db
    .query("followUps")
    .withIndex("by_owner_status_dueDate", (q) =>
      q.eq("ownerId", userId).eq("status", "pendiente").lte("dueDate", finDeHoy)
    )
    .collect();

  // Ventana única de 14 días, un recorrido por estado. El reparto entre los dos
  // periodos se hace después sobre estas listas, ya acotadas.
  const [pendientes, hechos] = await Promise.all(
    (["pendiente", "hecho"] as const).map((status) =>
      ctx.db
        .query("followUps")
        .withIndex("by_owner_status_dueDate", (q) =>
          q
            .eq("ownerId", userId)
            .eq("status", status)
            .gte("dueDate", inicioCargaAnterior)
            .lte("dueDate", finDeHoy)
        )
        .collect()
    )
  );

  let cargaActual = 0;
  let cargaAnterior = 0;
  for (const f of [...pendientes, ...hechos]) {
    // Periodo actual: [inicioCargaActual, finDeHoy] — 7 fechas locales.
    // Periodo anterior: [inicioCargaAnterior, inicioCargaActual) — otras 7.
    if (f.dueDate >= inicioCargaActual) cargaActual++;
    else cargaAnterior++;
  }

  return {
    total: vencidosHoy.length,
    // La misma frontera con la que "Hoy" separa "Atrasados" de "Para hoy".
    atrasados: vencidosHoy.filter((f) => f.dueDate < inicioDeHoy).length,
    cargaActual,
    cargaAnterior,
  };
}

/**
 * Bloque 4 — pipeline abierto: interesado + cotizado, con su desglose.
 *
 * Este sí se lee entero, y se acepta: el bloque es la SUMA TOTAL del inventario
 * abierto, así que no hay recorte honesto de "los últimos N". Es el mismo
 * recorrido completo que ya hace `opportunities.board` al abrir "Ventas". El
 * modelo no tiene estado "descartado", así que nada garantiza que esa colección
 * deje de crecer; el día que estorbe, la salida es un agregado mantenido en
 * cada escritura, no un índice.
 */
async function sumarPipeline(ctx: QueryCtx) {
  const porEtapa = await Promise.all(
    ETAPAS_ABIERTAS.map(async (etapa) => {
      const filas = await ctx.db
        .query("opportunities")
        .withIndex("by_stage_closedAt", (q) => q.eq("stage", etapa))
        .collect();
      return {
        etapa,
        cantidad: filas.length,
        monto: filas.reduce((suma, o) => suma + o.amount, 0),
      };
    })
  );

  return {
    total: porEtapa.reduce((suma, e) => suma + e.monto, 0),
    cantidad: porEtapa.reduce((suma, e) => suma + e.cantidad, 0),
    porEtapa,
  };
}

/**
 * Bloque 5 — las últimas interacciones de cualquier cliente.
 *
 * EL TECHO NO ES OPCIONAL. El campo de fecha de "Anotar" es un `<input
 * type="date">` sin `max` y la mutación acepta cualquier número finito, así que
 * se puede registrar una interacción con fecha de mañana. Sin `lte(finDeHoy)`,
 * un `order("desc")` la pondría por delante de la de hoy y expulsaría actividad
 * real: el resumen enseñaría el futuro como si ya hubiera pasado.
 */
async function actividadReciente(
  ctx: QueryCtx,
  finDeHoy: number
): Promise<ResumenActividad[]> {
  const filas = await ctx.db
    .query("interactions")
    .withIndex("by_date", (q) => q.lte("date", finDeHoy))
    .order("desc")
    .take(ACTIVIDAD_LIMITE);

  return Promise.all(
    filas.map(async (i: Doc<"interactions">) => {
      const client = await ctx.db.get(i.clientId);
      return {
        id: i._id,
        clientId: i.clientId,
        clientName: client?.name ?? "Cliente sin nombre",
        // `type` es opcional en el esquema: una interacción sin tipo es un
        // documento válido (los hay anteriores a GER-50). Se normaliza aquí,
        // igual que en `history.forClient`, para que la interfaz pueda indexar
        // su tabla de tipos sin defensa propia. Sin esto, una sola fila vieja
        // entre las cinco tumbaría la pantalla entera.
        tipo: i.type ?? ("llamada" as const),
        texto: i.text,
        fecha: i.date,
      };
    })
  );
}

/**
 * Los cinco bloques de "Inicio".
 *
 * Devuelve `null` sin sesión utilizable —el patrón de `clients.list` y
 * `users.viewer`— y no lanza: la pantalla está dentro de `SessionGuard`, que ya
 * se encarga de llevar a /login.
 *
 * Autoriza `getActiveUserId`, NO `requireOwnerId`. Aunque el issue la describa
 * como la pantalla de la dueña, /inicio ya está en la navegación de los dos
 * roles y todo lo que muestra sale de datos que "Clientes" y "Ventas" enseñan a
 * cualquiera con sesión. Restringirla sería una decisión de producto nueva.
 */
export const summary = query({
  args: fronteras,
  handler: async (ctx, args): Promise<Resumen | null> => {
    const userId = await getActiveUserId(ctx);
    if (userId === null) return null;

    const [clientesNuevos, ventas, pendientes, pipeline, actividad] =
      await Promise.all([
        contarClientes(ctx, args.inicioMes, args.inicioMesAnterior),
        sumarVentas(ctx, args.inicioMes, args.inicioMesAnterior),
        contarPendientes(
          ctx,
          userId,
          args.inicioCargaActual,
          args.inicioCargaAnterior,
          args.inicioDeHoy,
          args.finDeHoy
        ),
        sumarPipeline(ctx),
        actividadReciente(ctx, args.finDeHoy),
      ]);

    return {
      clientesNuevos,
      ventas,
      pendientes,
      pipeline,
      actividad,
      crmVacio: await estaVacio(ctx),
    };
  },
});

/**
 * "El CRM está vacío" = no hay NADA registrado, no "este mes no pasó nada".
 *
 * La maqueta ata un único interruptor a todo —números en "—" y los dos bloques
 * de abajo ocultos—, pero leerlo así escondería un pipeline abierto real solo
 * porque el mes va flojo, y ese pipeline es dinero por cobrar. El bloque de
 * vacío es para el CRM recién estrenado, que es cuando de verdad no hay nada que
 * resumir.
 *
 * Cuatro `first()`: se para en el primer documento de cada tabla, no cuenta.
 */
async function estaVacio(ctx: QueryCtx): Promise<boolean> {
  const [cliente, oportunidad, interaccion, seguimiento] = await Promise.all([
    ctx.db.query("clients").first(),
    ctx.db.query("opportunities").first(),
    ctx.db.query("interactions").first(),
    ctx.db.query("followUps").first(),
  ]);
  return (
    cliente === null &&
    oportunidad === null &&
    interaccion === null &&
    seguimiento === null
  );
}
