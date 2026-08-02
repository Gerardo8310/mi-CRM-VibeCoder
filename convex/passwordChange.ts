import { v } from "convex/values";
import {
  getAuthSessionId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { requireActiveUserId, validatePassword } from "./authz";
import { sinContrasena } from "./invitations";

/**
 * Cambiar la contraseña desde dentro, con la actual como prueba (GER-49).
 *
 * POR QUÉ NO HAY UN PROVEEDOR NUEVO AQUÍ
 *
 * Los otros tres flujos de credenciales de este repositorio —entrar, pedir
 * código, canjearlo— son proveedores `ConvexCredentials` porque todos terminan
 * *creando una sesión*, y eso solo se puede hacer desde dentro de la máquina de
 * la librería. Este no: quien cambia su contraseña **ya está dentro**. Lo
 * comprobado en las firmas de `@convex-dev/auth/server`:
 *
 *   retrieveAccount, modifyAccountCredentials, invalidateSessions
 *       -> aceptan un `GenericActionCtx` normal
 *   signInViaProvider
 *       -> exige `GenericActionCtxWithAuthConfig`, es decir, un proveedor
 *
 * Como aquí no se inicia sesión, no hace falta `signInViaProvider`, y con él
 * desaparece la única razón para declarar un proveedor. Así `convex/auth.ts` no
 * se toca y no se estrena ninguna puerta de entrada nueva.
 *
 * LA VERIFICACIÓN DE LA CONTRASEÑA ACTUAL ES LA MISMA QUE LA DEL LOGIN
 *
 * `retrieveAccount` con `secret` es literalmente lo que ejecuta el inicio de
 * sesión (retrieveAccountWithCredentials.js:29). Comparar hashes a mano sería
 * reimplementar Scrypt y su formato `sal:hash`; esto reutiliza el mismo camino,
 * con su mismo límite de intentos — ver `changePassword`.
 */

/**
 * Identidad y estado de quien llama, leídos del servidor.
 *
 * Existe porque **una acción no tiene `ctx.db` y por tanto no puede autorizar**
 * (hallazgo M3 de GER-48): tiene que delegar en una query interna, que sí lo
 * tiene y que corre con la identidad de quien llamó a la acción.
 *
 * De aquí sale el correo con el que se identifica la cuenta. **El cliente no
 * manda correo ni identificador**, y esa es la propiedad que impide que esta
 * pantalla pueda tocar la contraseña de otra persona.
 */
export const datosParaCambiar = internalQuery({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    tieneContrasena: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await requireActiveUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) throw new Error("Necesitas iniciar sesión.");

    // Dos condiciones, y las dos hacen falta:
    //
    // 1. Que exista la fila de `authAccounts` del proveedor "password". Si no
    //    existe, `retrieveAccount` lanzaría `InvalidAccountId` y acabaríamos
    //    diciendo "contraseña incorrecta" a quien no tiene ninguna.
    // 2. Que la persona haya ELEGIDO su contraseña. Un invitado que aún no ha
    //    entrado tiene fila, pero con el literal sin dos puntos de
    //    `convex/invitations.ts`, que Scrypt no puede verificar nunca.
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password")
      )
      .unique();

    return {
      userId,
      email: user.email,
      tieneContrasena: account !== null && !sinContrasena(user),
    };
  },
});

/**
 * El resultado NO viaja como excepción, y no es una preferencia de estilo.
 *
 * **En producción Convex redacta el texto de los errores**: el cliente recibe
 * "Server Error" sin mensaje. Si "contraseña actual incorrecta" fuera un
 * `throw`, la pantalla no podría distinguirlo de un fallo de red, y el criterio
 * de aceptación de GER-49 exige un error claro que además conserve lo escrito en
 * los otros campos. Medido en GER-48 con el panel de invitar.
 *
 * Por eso los desenlaces previsibles son *valores de retorno*. Se reserva el
 * `throw` para lo que de verdad es una avería.
 */
const resultado = v.union(
  v.object({ ok: v.literal(true) }),
  v.object({
    ok: v.literal(false),
    motivo: v.union(
      v.literal("actual-incorrecta"),
      v.literal("demasiados-intentos"),
      v.literal("igual-a-la-actual"),
      v.literal("sin-contrasena")
    ),
  }),
  // El texto lo produce `validatePassword` (convex/authz.ts), que es la
  // autoridad de la política. Se devuelve tal cual para que la regla siga
  // teniendo un solo dueño en vez de una copia en el navegador.
  v.object({
    ok: v.literal(false),
    motivo: v.literal("politica"),
    mensaje: v.string(),
  })
);

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: resultado,
  handler: async (ctx, { currentPassword, newPassword }) => {
    // 1. Quién es. Autoridad e identidad, del servidor.
    const { userId, email, tieneContrasena } = await ctx.runQuery(
      internal.passwordChange.datosParaCambiar,
      {}
    );

    // 2. Cuál es la sesión propia, para NO cerrarla en el paso 9.
    //    `getAuthSessionId` también sirve en acciones: solo pide un ctx con
    //    `auth` (implementation/sessions.d.ts:40).
    const sessionId = await getAuthSessionId(ctx);
    if (sessionId === null) throw new Error("Necesitas iniciar sesión.");

    // 3. Quien entró por Google sin haber elegido contraseña no tiene ninguna
    //    "actual" que verificar. Se dice, en vez de fingir que se equivocó.
    if (!tieneContrasena) {
      return { ok: false as const, motivo: "sin-contrasena" as const };
    }

    // 4. La política, ANTES de tocar nada y antes de gastar un intento del
    //    límite. Es la misma función que usan el alta y el canje del código.
    try {
      validatePassword(newPassword, email);
    } catch (error) {
      return {
        ok: false as const,
        motivo: "politica" as const,
        mensaje:
          error instanceof Error
            ? error.message
            : "Esa contraseña no se puede usar.",
      };
    }

    // 5. Antes de verificar, porque no gasta intentos del límite y porque
    //    cambiar una contraseña por sí misma no cambia nada.
    if (newPassword === currentPassword) {
      return { ok: false as const, motivo: "igual-a-la-actual" as const };
    }

    // 6. La prueba de que es quien dice. Este camino COMPARTE EL LÍMITE DE
    //    INTENTOS CON EL LOGIN: `retrieveAccountWithCredentialsImpl` consulta
    //    `isSignInRateLimited` y apunta cada fallo con `recordFailedSignIn`
    //    sobre la misma cuenta (retrieveAccountWithCredentials.js:26-33).
    //
    //    De ahí que el `catch` no sea genérico. Agotados los diez intentos de la
    //    hora, ni siquiera la contraseña correcta pasa, y presentar eso como
    //    "contraseña incorrecta" dejaría a la persona probando una que sabe
    //    buena. `retrieveAccount` hace `throw new Error(result)` con el literal
    //    de la librería (implementation/index.js:373-379), así que se distingue
    //    por el mensaje.
    let account;
    try {
      ({ account } = await retrieveAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: email, secret: currentPassword },
      }));
    } catch (error) {
      const motivo =
        error instanceof Error && error.message === "TooManyFailedAttempts"
          ? ("demasiados-intentos" as const)
          : ("actual-incorrecta" as const);
      return { ok: false as const, motivo };
    }

    // 7. Defensa en profundidad. El correo salió de la ficha de esta misma
    //    persona, así que hoy no hay ninguna secuencia que pueda incumplirlo;
    //    la comprobación convierte ese invariante implícito en explícito, para
    //    que un cambio futuro en cómo se obtiene el correo no pueda acabar
    //    reescribiendo la credencial de otra cuenta en silencio.
    if (account.userId !== userId) {
      throw new Error("La cuenta no corresponde a la sesión.");
    }

    // 8, 9 y 10 VAN EN ESTE ORDEN Y NO EN OTRO (hallazgo M4 de GER-48).
    //
    // Son transacciones distintas y cualquiera puede fallar dejando hechas las
    // anteriores, así que se ordenan por lo que cuesta perderlas:
    //
    //   8. La contraseña nueva.
    //   9. El cierre de las demás sesiones — la razón de ser del cambio.
    //  10. La marca de "ya tiene contraseña", que es solo clasificación.
    //
    // Con la marca en medio, un fallo suyo impediría llegar al cierre de
    // sesiones: la contraseña quedaría cambiada y los otros dispositivos,
    // dentro. Al final, lo peor que pasa es que la persona siga clasificada como
    // "sin contraseña" teniéndola, y el siguiente canje de código lo arregla.
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });

    // QUÉ PROMETE ESTA LÍNEA, EXACTAMENTE (hallazgo M1 de la auditoría de
    // diseño de GER-49):
    //
    // `invalidateSessionsImpl` BORRA las filas de `authSessions` y, vía
    // `deleteSession`, sus refresh tokens (mutations/invalidateSessions.js:16-30).
    // Eso es inmediato. Lo que NO hace es invalidar un JWT ya emitido: la
    // autoridad de acceso (`getActiveUserId`, convex/authz.ts) comprueba usuario
    // y estado, no que la sesión siga existiendo, y `getUserIdentity()` solo
    // verifica la firma — está escrito en convex/auth.ts.
    //
    // Con `jwt.durationMs` en 15 minutos, ese es el techo del acceso residual
    // del otro dispositivo; sin refresh token no puede renovar, así que al
    // caducar queda fuera. La interfaz lo dice con esas palabras: prometer la
    // expulsión inmediata sería mentir. Es la misma ventana que ya tiene
    // desactivar a una persona (GER-48), y se aceptó para no meter una lectura
    // más en cada función protegida del CRM.
    await invalidateSessions(ctx, { userId, except: [sessionId] });

    // Y solo entonces la clasificación. Se reutiliza la mutación del canje del
    // código en vez de escribir otra igual.
    await ctx.runMutation(internal.passwordReset.markPasswordSet, { userId });

    return { ok: true as const };
  },
});
