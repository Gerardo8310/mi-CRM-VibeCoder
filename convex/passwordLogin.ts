import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { normalizeEmail } from "./email";
import { MIN_PASSWORD_MESSAGE, validatePassword } from "./authz";
import { sinContrasena } from "./invitations";

/**
 * Entrar y darse de alta con contraseña, en dos proveedores propios (GER-54).
 *
 * QUÉ PROBLEMA CIERRA
 *
 * La frontera pública de autenticación devolvía cuerpos HTTP distintos según
 * existiera o no la cuenta, así que cualquiera podía enumerar la membresía del
 * CRM sin pasar por la interfaz. `retrieveAccount` relanza en crudo el string
 * que le da la librería —"InvalidAccountId", "InvalidSecret",
 * "TooManyFailedAttempts"— (server/implementation/index.ts:600-602), el proxy lo
 * convierte en HTTP ≥400 con ese texto en el cuerpo y el cliente lo reexpone
 * (nextjs/client.tsx:33-35).
 *
 * Y había un segundo canal, peor, por `flow: "signUp"`:
 * `createAccountFromCredentialsImpl` verifica el secreto contra la cuenta
 * existente (mutations/createAccountFromCredentials.ts:49-53) SIN pasar por
 * `isSignInRateLimited` ni `recordFailedSignIn` —a diferencia del login normal—
 * y, si acierta, devuelve la cuenta existente sin lanzar (:57-61), con lo que
 * `Password` emitía tokens. Es decir: probar contraseñas a ritmo ilimitado y
 * entrar al acertar, saltándose los 10 intentos por hora que protegen el login.
 * Medido contra dev: seis intentos fallidos por esa vía dejaron `authRateLimits`
 * vacía, frente a un solo intento por `flow: "signIn"` que ya dejó la fila con
 * `attemptsLeft: 9`.
 *
 * LA INVARIANTE QUE SE PERSIGUE (redacción de la auditoría)
 *
 * Para la misma entrada, la respuesta NO depende de la existencia de la cuenta,
 * de que el secreto sea correcto en una cuenta inactiva, ni del estado de Resend.
 *
 * No es "respuesta constante en todo fallo": unos parámetros inválidos sí pueden
 * devolver un error de política. Lo que no puede es depender de esos tres
 * factores.
 *
 * POR QUÉ FUNCIONA
 *
 * Cuando un `authorize` de credenciales devuelve `null`, `handleCredentials`
 * devuelve `{kind:"signedIn", signedIn:null}` (signIn.ts:191-193) y la acción
 * pública responde `{tokens: null}` (index.ts:420-425). Mismo estado y mismo
 * cuerpo para cuenta inexistente, contraseña incorrecta, límite agotado y cuenta
 * desactivada.
 *
 * POR QUÉ NO SE REIMPLEMENTA `Password`
 *
 * Mismo patrón que GER-57 (convex/passwordReset.ts), ya en producción: se usan
 * las exportaciones públicas de `@convex-dev/auth/server` —las mismas que
 * importa providers/Password.ts:33-38— pasándoles `provider: "password"`. Con
 * ese nombre resuelven el `crypto` del proveedor `Password`
 * (retrieveAccountWithCredentials.ts:50, createAccountFromCredentials.ts:39), así
 * que el Scrypt de lucia sigue siendo el único que hashea y verifica en todo el
 * sistema. `Password` se queda registrado en convex/auth.ts precisamente para
 * eso: es el titular del identificador de cuenta "password" y de su `crypto`.
 *
 * LO QUE ESTO NO ARREGLA, Y ESTÁ DECLARADO
 *
 * Normaliza el cuerpo, no el tiempo. `retrieveAccountWithCredentialsImpl` sale
 * en :42-44 antes de calcular Scrypt si la cuenta no existe, así que una cuenta
 * existente y activa sigue tardando mediblemente más. Cerrarlo exigiría un hash
 * señuelo, que la auditoría de GER-59 desaconsejó explícitamente. Riesgo
 * aceptado, documentado en el README.
 */

/**
 * Texto único para "no hay registro abierto". Lo comparten este archivo y el
 * guard de `callbacks.createOrUpdateUser` (convex/auth.ts) a propósito: son las
 * dos respuestas posibles a un alta rechazada y no deben distinguirse entre sí.
 */
export const REGISTRO_CERRADO_MESSAGE =
  "El registro abierto está deshabilitado. Pide a Martha que te invite desde Gestión de usuarios.";

/**
 * Mismo criterio: un correo ausente o vacío no merece una respuesta que se
 * distinga de las demás formas de mandar basura.
 */
const CORREO_REQUERIDO_MESSAGE = "Hace falta un correo válido.";

/**
 * ¿Hay algún usuario en el sistema? Es la única lectura que necesita
 * `PasswordSignUp` para decidir, y va en una query interna porque el `authorize`
 * de un proveedor corre en una acción, sin acceso directo a la base.
 *
 * NO es la autoridad de unicidad. Esa sigue siendo el guard `someUserExists` de
 * `callbacks.createOrUpdateUser` (convex/auth.ts), que corre DENTRO de la
 * transacción de `createAccount` y por tanto sí cierra la carrera entre dos
 * altas simultáneas. Esta lectura es un cortacircuitos: existe para que el alta
 * muera antes de tocar `authAccounts`.
 */
export const anyUserExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("users").first()) !== null;
  },
});

/**
 * Qué pedirle a este correo en el segundo paso del login (GER-48, rama 2).
 *
 * `"setup"` significa "esta persona fue invitada y todavía no ha elegido
 * contraseña": hay que mandarle un código, no pedirle algo que no tiene.
 * `"password"` es todo lo demás.
 *
 * POR QUÉ EXISTE: hasta ahora la pantalla pedía correo y contraseña a la vez, así
 * que a un invitado no le quedaba más remedio que pulsar "¿Olvidaste tu
 * contraseña?". No la olvidó — nunca la tuvo, y el CRM le hacía decir lo
 * contrario.
 *
 * EL VALOR POR DEFECTO ES EL QUE NO DICE NADA. Un correo que no existe responde
 * `"password"`, igual que una cuenta normal, igual que una desactivada, igual
 * que una que entra solo con Google. La única clase que esta función distingue
 * es "invitado que aún no ha entrado".
 *
 * ESA FUGA ES REAL Y ESTÁ ACEPTADA. Cualquiera puede preguntar por cualquier
 * correo, y de uno recién invitado sabrá que lo está. Se eligió a sabiendas
 * frente a la alternativa —no delatar a nadie a cambio de mantener el "olvidé mi
 * contraseña" postizo—, y la ventana se cierra sola en cuanto la persona entra:
 * a partir de ahí su ficha responde como las demás. Lo que NO se puede hacer es
 * ampliarla: cualquier respuesta nueva aquí es un canal nuevo.
 */
export const methodFor = query({
  args: { email: v.string() },
  returns: v.union(v.literal("password"), v.literal("setup")),
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (normalized.length === 0) return "password";

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    // Una ficha desactivada responde como cualquier otra: `password-reset-request`
    // no le mandaría el código de todos modos (GER-54), así que ofrecerle el
    // camino del código sería prometerle algo que no ocurre.
    if (user === null || user.status !== "activo") return "password";

    return sinContrasena(user) ? "setup" : "password";
  },
});

/**
 * Iniciar sesión con correo y contraseña.
 *
 * El orden de los dos `retrieveAccount` es el diseño, no una comodidad.
 *
 * El primero va SIN `secret`: solo lee la cuenta y su usuario. Todo el bloque
 * del límite de intentos —`isSignInRateLimited`, `recordFailedSignIn`,
 * `resetSignInRateLimit`— vive dentro de `if (account.secret !== undefined)`
 * (retrieveAccountWithCredentials.ts:45-60), así que esta lectura no comprueba,
 * no consume y no reinicia nada.
 *
 * Solo si el usuario está activo se hace el segundo, CON `secret`, que es el que
 * verifica y el que consume el límite.
 *
 * Por qué no basta comprobar el estado después de verificar: quedaría un oráculo
 * por el ESTADO DEL CONTADOR. `retrieveAccountWithCredentialsImpl` llama a
 * `resetSignInRateLimit` cuando el secreto acierta (:59), y esa función BORRA la
 * fila (rateLimit.ts:39-50). Con la comprobación al final, un atacante contra una
 * cuenta desactivada gastaría 9 intentos, probaría una candidata —respuesta
 * indistinguible— y con un décimo intento sabría la verdad: si quedan intentos,
 * la fila se borró y la candidata era correcta; si salta el límite, no lo era.
 * Con la lectura previa, una cuenta inactiva no llega nunca a `Provider.verify`:
 * su fila no se crea, no baja y no se borra.
 *
 * Precio: dos mutaciones `auth:store` por inicio de sesión en vez de una. A
 * este volumen —unidades al día— no significa nada, y queda dicho.
 *
 * `beforeSessionCreation` (GER-56, convex/auth.ts) sigue en su sitio y sigue
 * siendo necesario: alguien puede desactivar al usuario entre las dos
 * mutaciones, o entre la segunda y la creación de la sesión. Ahí es defensa
 * contra carreras, no el control de normalización.
 */
export const PasswordSignIn = ConvexCredentials<DataModel>({
  id: "password-signin",

  authorize: async (params, ctx) => {
    // Fail-closed. `Password` daba por hecho que los campos estaban y reventaba
    // más adelante con un TypeError.
    if (typeof params.email !== "string" || typeof params.password !== "string") {
      return null;
    }
    const email = normalizeEmail(params.email);
    const password = params.password;
    if (email.length === 0) return null;

    try {
      // 1. ¿Existe la cuenta y su usuario sigue activo? Sin `secret`.
      const { user } = await retrieveAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: email },
      });
      // `user` llega con aserción no-nula desde la librería
      // (retrieveAccountWithCredentials.ts:64), así que una fila huérfana de
      // `authAccounts` lo trae `null` en tiempo de ejecución. La comprobación no
      // es ceremonia del tipo.
      if (user === null || user.status !== "activo") return null;

      // 2. Ahora sí: verifica el secreto y consume el límite.
      const { account } = await retrieveAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: email, secret: password },
      });

      return { userId: account.userId };
    } catch {
      // Los tres strings de la librería acaban aquí, indistinguibles:
      // "InvalidAccountId", "InvalidSecret" y "TooManyFailedAttempts".
      return null;
    }
  },
});

/**
 * Darse de alta. En la práctica: rechazar el alta.
 *
 * El flujo del MVP es invitación por correo (GER-48); el alta abierta solo
 * existe para arrancar de cero, mientras `users` esté vacía, y crea a la dueña.
 * En producción, por tanto, este proveedor tiene UNA sola respuesta posible, y
 * eso es exactamente lo que cierra el canal: la comprobación de registro cerrado
 * va PRIMERO, antes de mirar `authAccounts`, así que `Provider.verify` no se
 * alcanza nunca y no hay nada que distinguir ni que cronometrar.
 *
 * Las guardas de tipo de después solo son alcanzables durante el bootstrap. No
 * son decorativas: la librería pasaba `params.password as string` con una
 * aserción, y un alta sin contraseña llegaba a `createAccount` con
 * `secret: undefined`, que crea una cuenta SIN secreto.
 */
export const PasswordSignUp = ConvexCredentials<DataModel>({
  id: "password-signup",

  authorize: async (params, ctx) => {
    // 1. AUTORIDAD DEL CANAL. Primera sentencia, y sin tocar `authAccounts`.
    if (await ctx.runQuery(internal.passwordLogin.anyUserExists)) {
      throw new Error(REGISTRO_CERRADO_MESSAGE);
    }

    // 2. Guardas de tipo. Mismo mensaje que una contraseña corta, a propósito:
    //    las formas de incumplir la política no deben distinguirse.
    if (typeof params.password !== "string") {
      throw new Error(MIN_PASSWORD_MESSAGE);
    }
    if (typeof params.email !== "string") {
      throw new Error(CORREO_REQUERIDO_MESSAGE);
    }
    const password = params.password;
    const email = normalizeEmail(params.email);
    if (email.length === 0) {
      throw new Error(CORREO_REQUERIDO_MESSAGE);
    }
    const name =
      typeof params.name === "string" && params.name.length > 0
        ? params.name
        : "Sin nombre";

    // 3. Política completa (convex/authz.ts). Aquí sí se puede llamar a la
    //    versión que necesita el correo, porque tenemos los dos datos: el
    //    enganche `validatePasswordRequirements` de la librería solo recibe la
    //    contraseña, y de ahí que la política esté partida en tres.
    validatePassword(password, email);

    // 4. `provider: "password"` para que el secreto se hashee con el Scrypt del
    //    proveedor `Password`. `role` y `status` reales los decide
    //    `callbacks.createOrUpdateUser`: en el bootstrap, "duena" y "activo".
    const { user } = await createAccount<DataModel>(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: {
        email,
        name,
        role: "vendedor" as const,
        status: "activo" as const,
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    return { userId: user._id };
  },
});
