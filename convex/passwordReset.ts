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
import { ResendOTP } from "./ResendOTP";
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
 * propio cupo de 10 intentos, y un código de 6 dígitos se vuelve adivinable.
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

export const PasswordResetRequest = ConvexCredentials({
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
      const { account } = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email },
      });
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

    // 3. Crea el código y envía el correo. Puede lanzar si Resend falla: en ese
    //    caso el hueco ya se consumió y el usuario tendrá que esperar al
    //    cooldown. Se deja propagar a propósito, para que el fallo quede en los
    //    logs de Convex; la interfaz muestra el mismo mensaje genérico
    //    igualmente.
    await signInViaProvider(ctx, ResendOTP, {
      accountId,
      params: { email },
    });

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
export const PasswordResetVerify = ConvexCredentials({
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
    const code = params.code;
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
    try {
      ({ account } = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email },
      }));
    } catch {
      // Cuenta inexistente. Mismo desenlace que un código incorrecto.
      return null;
    }

    // Aquí sí se consume el código. `params` es un objeto que construimos
    // nosotros —no el del cliente— para que el identificador del límite sea el
    // correo canónico.
    const result = await signInViaProvider(ctx, ResendOTP, {
      params: { email, code },
    });
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
