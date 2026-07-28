import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { retrieveAccount, signInViaProvider } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ResendOTP } from "./ResendOTP";

/**
 * Solicitud de código para recuperar la contraseña (GER-53).
 *
 * Por qué existe este proveedor en vez de usar el `flow: "reset"` que trae
 * `Password` (auditoría M2, dos rondas): pedir un código destruye el código
 * anterior (src/server/implementation/mutations/createVerificationCode.ts) y
 * la librería no limita esa petición — solo limita los intentos de verificar.
 * Alguien podría automatizar solicitudes y dejar a un usuario sin poder
 * recuperar su cuenta nunca, además de saturar su buzón.
 *
 * Poner el límite en una acción envolvente no bastaba: `auth:signIn` es una
 * acción pública y se la salta llamándola directo. Ninguno de los enganches
 * de `Password` sirve tampoco — `profile` es síncrono, `generateVerificationToken`
 * no recibe contexto ni parámetros, y `sendVerificationRequest` corre cuando
 * el código anterior ya se destruyó.
 *
 * La solución es mover la autoridad al punto de entrada: el `authorize` de un
 * proveedor propio, que sí es asíncrono y recibe el contexto completo. Aquí no
 * hay ruta alternativa. La puerta antigua se cierra en convex/auth.ts, donde
 * el `profile` de `Password` rechaza `flow: "reset"` antes de tocar nada.
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

  authorize: async (params, ctx) => {
    const email = params.email;
    if (typeof email !== "string" || email.length === 0) {
      return null;
    }

    // AUTORIDAD DEL LÍMITE (auditoría M2). Es la primera sentencia con efecto
    // del único camino que puede pedir un código: nada crea ni invalida nada
    // antes de pasar por aquí. Si rechaza, salimos sin tocar el código vigente
    // y sin llamar a Resend.
    const allowed = await ctx.runMutation(
      internal.passwordReset.consumeResetSlot,
      { email }
    );
    if (!allowed) return null;

    let accountId;
    try {
      const { account } = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email },
      });
      accountId = account._id;
    } catch {
      // La cuenta no existe. Salimos igual que en el caso válido para no
      // revelar quién tiene cuenta (ver GER-54 para la normalización completa).
      return null;
    }

    // Crea el código y envía el correo. Puede lanzar si Resend falla: en ese
    // caso el hueco ya se consumió y el usuario tendrá que esperar al cooldown.
    // Se deja propagar a propósito, para que el fallo quede en los logs de
    // Convex; la interfaz muestra el mismo mensaje genérico igualmente.
    await signInViaProvider(ctx, ResendOTP, {
      accountId,
      params: { email },
    });

    // Pedir el código nunca inicia sesión: devolver null evita que
    // handleCredentials genere tokens (src/server/implementation/signIn.ts).
    return null;
  },
});
