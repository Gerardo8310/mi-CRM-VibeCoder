import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { ResendOTP, normalizeResetCode } from "./ResendOTP";
import { normalizeEmail } from "./email";
import { validatePassword } from "./authz";

/**
 * Recuperación de contraseña por código: los DOS proveedores propios (GER-53 y
 * GER-57). Pedir el código es `password-reset-request`; canjearlo y elegir la
 * contraseña nueva es `password-reset-verify`. Ninguno de los dos flujos pasa ya
 * por `Password`.
 *
 * Por qué pedir el código no usa el `flow: "reset"` que trae `Password`
 * (auditoría M2, GER-53): pedir un código destruye el código anterior
 * (src/server/implementation/mutations/createVerificationCode.ts) y la librería
 * no limita esa petición — solo limita los intentos de verificar. Alguien podría
 * automatizar solicitudes y dejar a un usuario sin poder recuperar su cuenta
 * nunca, además de saturar su buzón.
 *
 * Poner el límite en una acción envolvente no bastaba: `auth:signIn` es una
 * acción pública y se la salta llamándola directo. Ninguno de los enganches
 * de `Password` sirve tampoco — `profile` es síncrono, `generateVerificationToken`
 * no recibe contexto ni parámetros, y `sendVerificationRequest` corre cuando
 * el código anterior ya se destruyó.
 *
 * Por qué canjear el código tampoco usa `flow: "reset-verification"` (GER-57,
 * Issue 2.1 de la auditoría del login): el límite de intentos del código se
 * indexa por `args.params.email` TAL CUAL lo manda el cliente
 * (mutations/verifyCodeAndSignIn.ts:42), y `Password.ts:191` le pasa los params
 * crudos. Normalizar el correo solo dentro de `ResendOTP` no arreglaría nada:
 * cada variante de caja —`Ana@x.com`, `ana@X.com`, `ANA@x.com`…— estrenaría su
 * propio cupo de 10 intentos, y un código numérico corto se vuelve adivinable.
 * Con un proveedor propio el correo se canoniza ANTES de entrar a la librería,
 * así que todas las variantes comparten un único cupo.
 *
 * Ese es también el motivo del orden de los cambios: este proveedor tenía que
 * existir antes de normalizar en ningún otro sitio.
 *
 * La puerta antigua se cierra en convex/auth.ts, que ya no configura `reset`.
 */

// Espera mínima entre dos solicitudes del mismo correo.
const COOLDOWN_MS = 60 * 1000;
// Ventana y tope de solicitudes dentro de ella. La ventana se exporta porque
// el cron de convex/authCleanup.ts la necesita para saber qué filas ya no
// restringen nada y puede borrar.
export const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

/**
 * Comprueba y registra en una sola mutación. Va junto a propósito: las
 * mutaciones de Convex son transaccionales y serializables, así que dos
 * solicitudes simultáneas del mismo correo no pueden colarse ambas leyendo
 * el mismo estado previo.
 *
 * Devuelve `false` sin escribir nada cuando toca rechazar — importante,
 * porque así el código que la víctima ya tiene en su correo sobrevive intacto.
 *
 * El `email` que recibe viene siempre normalizado (convex/email.ts). Si no lo
 * estuviera, cada variante de caja tendría su propio cupo y el límite no
 * limitaría nada.
 */
export const consumeResetSlot = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("passwordResetRequests")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing === null) {
      await ctx.db.insert("passwordResetRequests", {
        email,
        count: 1,
        windowStart: now,
        lastRequestAt: now,
      });
      return true;
    }

    // Ventana agotada: empieza una nueva.
    if (now - existing.windowStart >= RESET_REQUEST_WINDOW_MS) {
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
        lastRequestAt: now,
      });
      return true;
    }

    if (now - existing.lastRequestAt < COOLDOWN_MS) return false;
    if (existing.count >= MAX_REQUESTS_PER_WINDOW) return false;

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      lastRequestAt: now,
    });
    return true;
  },
});

/**
 * Deja constancia de que una solicitud de código no pudo completarse (GER-54).
 *
 * Es una mutación programada y no un `console.error` en línea a propósito: los
 * logs de la acción `auth:signIn` viajan al cliente en el campo `logLines` de la
 * respuesta HTTP, y como el envío solo se intenta cuando la cuenta existe, un log
 * en línea distinguiría cuenta existente de inexistente durante una avería de
 * Resend. Esto corre en otra ejecución, así que su log queda en el deployment y
 * no en la respuesta.
 *
 * El mensaje es constante: sin correo, sin código, sin el error. El detalle de la
 * causa —el código de estado que devolvió Resend— vive en el panel de Resend, que
 * es donde se diagnostica una avería suya.
 */
export const logResetSendFailure = internalMutation({
  args: {},
  handler: async () => {
    console.error("password-reset-request: no se pudo crear o enviar el código.");
  },
});

export const PasswordResetRequest = ConvexCredentials<DataModel>({
  id: "password-reset-request",
  // Necesario desde que `Password` ya no declara `reset: ResendOTP`: los
  // proveedores extra solo existen para la librería si algún proveedor de
  // credenciales los declara (provider_utils.ts, `configDefaults`). Sin esto,
  // `signInViaProvider` no encontraría "resend-otp".
  extraProviders: [ResendOTP],

  authorize: async (params, ctx) => {
    if (typeof params.email !== "string") return null;
    const email = normalizeEmail(params.email);
    if (email.length === 0) return null;

    // 1. ¿Existe la cuenta? (GER-57, Issue 2.3.) Antes esto iba DESPUÉS del
    //    límite, así que cualquier cadena que pareciera un correo creaba una
    //    fila en `passwordResetRequests` — una tabla que un anónimo podía
    //    engordar sin tener cuenta.
    //
    //    Adelantarlo no debilita el cierre M2. El invariante de aquel hallazgo
    //    es "nada crea ni destruye un código de verificación antes de pasar por
    //    el límite", y `retrieveAccount` sin `secret` no hace ninguna de las
    //    dos: solo lee `authAccounts` por índice y devuelve
    //    (retrieveAccountWithCredentials.ts:36-45). Ni siquiera consume el
    //    límite de la propia librería, que solo se toca cuando se le pasa un
    //    `secret`.
    let accountId;
    try {
      const { account, user } = await retrieveAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: email },
      });
      // GER-54: un usuario desactivado sale por aquí, igual que uno inexistente.
      // No lo pidió la auditoría —lo añadí para que los tres proveedores tengan
      // el mismo invariante— y no abre ningún canal: la respuesta sigue siendo
      // `null` en todos los casos. Lo que evita es real: hoy un desactivado
      // puede provocar envíos de correo y consumir huecos del límite para un
      // código que nunca podrá canjear, porque `beforeSessionCreation` aborta el
      // canje. Además, al salir ANTES de `consumeResetSlot`, tampoco se le puede
      // agotar el cupo a una cuenta desactivada.
      if (user === null || user.status !== "activo") return null;
      accountId = account._id;
    } catch {
      // La cuenta no existe. Salimos igual que en el caso válido para no
      // revelar quién tiene cuenta.
      return null;
    }

    // 2. AUTORIDAD DEL LÍMITE (auditoría M2). Sigue siendo la primera sentencia
    //    con efecto de este camino: lo único que corre antes es la lectura del
    //    paso 1. Si rechaza, salimos sin tocar el código vigente y sin llamar a
    //    Resend.
    const allowed = await ctx.runMutation(
      internal.passwordReset.consumeResetSlot,
      { email }
    );
    if (!allowed) return null;

    // 3. Crea el código y envía el correo.
    //
    //    La excepción NO se deja propagar (GER-54 · M1). Antes sí, y eso volvía
    //    a abrir el canal de enumeración justo en la frontera que GER-54
    //    normaliza: con Resend caído, un correo inexistente responde
    //    `{tokens: null}` y uno existente responde error HTTP. La diferencia
    //    basta para enumerar la membresía del CRM durante una avería de un
    //    tercero, que no es un escenario remoto.
    //
    //    El `catch` cubre las tres causas posibles: Resend rechazando el envío,
    //    la clave ausente del entorno y un fallo de `createVerificationCode`.
    //
    //    El registro NO se hace con `console.error` aquí, y esa es la parte que
    //    no es evidente: la respuesta de `POST /api/action` incluye un campo
    //    `logLines` con lo que la ejecución haya escrito por consola. Como solo
    //    se intenta enviar cuando la cuenta existe, un log en línea aparecería
    //    en el cuerpo únicamente en ese caso, y volvería a distinguir cuenta
    //    existente de inexistente por otra vía. Medido con la clave de Resend
    //    inválida: el correo existente devolvía dos entradas en `logLines`, el
    //    inexistente ninguna.
    //
    //    Por eso el aviso sale por una mutación programada, que es otra ejecución
    //    y cuyos logs no viajan en esta respuesta. Coste: una fila en
    //    `_scheduled_functions` por avería.
    //
    //    Residuo, igual que antes: el hueco del límite se consumió en el paso 2,
    //    así que una avería de Resend le cuesta al usuario una de sus cinco
    //    solicitudes por hora.
    try {
      await signInViaProvider(ctx, ResendOTP, {
        accountId,
        params: { email },
      });
    } catch {
      await ctx.scheduler.runAfter(
        0,
        internal.passwordReset.logResetSendFailure,
        {}
      );
    }

    // Pedir el código nunca inicia sesión: devolver null evita que
    // handleCredentials genere tokens (src/server/implementation/signIn.ts).
    return null;
  },
});

/**
 * Canje del código + contraseña nueva (GER-57 · Issue 2.1).
 *
 * Replica paso por paso lo que hacía `Password` en `flow: "reset-verification"`
 * (Password.ts:178-205) con una sola diferencia, que es justo el motivo de que
 * exista: el correo se canoniza aquí, antes de que la librería lo use como
 * identificador del límite de intentos.
 *
 * Las cuatro funciones que usa son exportaciones públicas de
 * `@convex-dev/auth/server`, las mismas que importa `Password.ts:33-38`. En
 * particular `modifyAccountCredentials` hashea con el `crypto` del proveedor
 * cuyo id se le pasa (modifyAccount.ts:36), y le pasamos "password": la
 * contraseña nueva se guarda con el mismo Scrypt que las demás.
 */
export const PasswordResetVerify = ConvexCredentials<DataModel>({
  id: "password-reset-verify",
  extraProviders: [ResendOTP],

  authorize: async (params, ctx) => {
    // Fail-closed: sin los tres campos no hay nada que hacer. `Password` daba
    // por hecho que estaban y lanzaba un TypeError más adelante.
    if (
      typeof params.email !== "string" ||
      typeof params.code !== "string" ||
      typeof params.newPassword !== "string"
    ) {
      return null;
    }

    const email = normalizeEmail(params.email);
    // El código se canoniza aquí por el mismo motivo que el correo y en el mismo
    // sitio: la librería hashea `params.code` TAL CUAL se lo demos
    // (verifyCodeAndSignIn.js:64). Sin esta línea, el mismo código escrito en
    // minúsculas o con los guiones con los que viaja en el correo no cuadraría
    // con el que se generó. La autoridad es esta, no la interfaz (GER-58).
    const code = normalizeResetCode(params.code);
    const newPassword = params.newPassword;
    if (email.length === 0) return null;

    // Antes de tocar nada. Quitar `reset` de `Password` también quitó la
    // validación por defecto de la librería (Password.ts:129-135), así que sin
    // esta línea el proveedor aceptaría una contraseña vacía. Va la primera a
    // propósito: una contraseña que no cumple la política no debe gastar el
    // código que el usuario tiene en su correo.
    validatePassword(newPassword, email);

    // Cuenta a la que pertenece el correo. Sin `secret`: solo lee.
    let account;
    let user;
    try {
      ({ account, user } = await retrieveAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: email },
      }));
    } catch {
      // Cuenta inexistente. Mismo desenlace que un código incorrecto.
      return null;
    }

    // GER-54 · M3. Va AQUÍ, antes de `signInViaProvider`, y el sitio es el
    // arreglo entero: si el usuario está desactivado, el código NO se consume.
    //
    // Antes esta comprobación no existía y el estado lo cazaba
    // `beforeSessionCreation`, que lanza y revierte la transacción. Eso dejaba
    // dos respuestas distinguibles —código incorrecto devolvía `{tokens: null}`,
    // código correcto devolvía error— es decir, un oráculo para averiguar el
    // código de una cuenta desactivada, que es exactamente la clase de canal que
    // este issue cierra.
    if (user === null || user.status !== "activo") return null;

    // Aquí sí se consume el código. `params` es un objeto que construimos
    // nosotros —no el del cliente— para que el identificador del límite sea el
    // correo canónico.
    //
    // EL `try` NO ES DEFENSIVO POR COSTUMBRE (GER-54, encontrado al ejecutar la
    // matriz): sin él quedaba un canal de enumeración. Para un proveedor de
    // correo, la librería NO devuelve `null` cuando el código no cuadra — lanza
    // `new Error("Could not verify code")` (signIn.ts:115-117). Esa excepción
    // salía al cuerpo HTTP, así que:
    //
    //   cuenta existente y activa + código cualquiera → error "Could not verify code"
    //   cuenta inexistente o desactivada             → {tokens: null}
    //
    // Es decir: mandando basura como código se averiguaba si un correo tiene
    // cuenta activa en el CRM. Es deuda preexistente —viene de GER-57, no de este
    // cambio— y `if (result === null)` nunca la cubrió porque en esta ruta la
    // librería no devuelve `null`: lanza.
    //
    // El `catch` cubre además dos casos que también distinguían: el `authorize`
    // de ResendOTP rechazando un código que pertenece a otro correo, y el límite
    // de 10 intentos por hora agotado.
    //
    // No se registra nada: un código incorrecto es comportamiento normal de un
    // usuario, no una avería. Y un log en línea viajaría en `logLines` de la
    // respuesta (ver `logResetSendFailure` arriba), reabriendo el canal.
    let result;
    try {
      result = await signInViaProvider(ctx, ResendOTP, {
        params: { email, code },
      });
    } catch {
      return null;
    }
    if (result === null) return null;

    // El código pertenece a otra cuenta: no cambiamos ninguna contraseña.
    if (account.userId !== result.userId) return null;

    const { userId, sessionId } = result;
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });
    // Cambiar la contraseña cierra la sesión de los demás dispositivos, pero no
    // la que acaba de crear el canje.
    await invalidateSessions(ctx, { userId, except: [sessionId] });

    return { userId, sessionId };
  },
});
