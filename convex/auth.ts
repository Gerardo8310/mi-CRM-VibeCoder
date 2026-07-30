import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import type { DatabaseReader } from "./_generated/server";
import { PasswordResetRequest, PasswordResetVerify } from "./passwordReset";
import {
  PasswordSignIn,
  PasswordSignUp,
  REGISTRO_CERRADO_MESSAGE,
} from "./passwordLogin";
import { normalizeEmail } from "./email";
import { validatePasswordRequirements } from "./authz";

/**
 * Autenticación por correo + contraseña (GER-7) y, desde GER-51, "Entrar
 * con Google" como segundo método.
 *
 * El flujo normal del MVP es invitación por correo (GER-48) — no hay
 * registro público. La única excepción es arrancar de cero: el "signUp"
 * solo funciona mientras la tabla `users` esté vacía (crea a la dueña);
 * en cuanto existe un usuario, el alta se bloquea sola y todo pasa por
 * "Gestión de usuarios". Ver el toggle temporal en (auth)/login/page.tsx.
 *
 * Google también respeta el registro cerrado: solo entra quien ya tiene
 * un usuario provisionado con ese correo (ver createOrUpdateUser abajo).
 * Nunca crea una cuenta nueva vía Google.
 *
 * DÓNDE VIVE CADA FLUJO DESDE GER-54
 *
 * `Password` ya no atiende ninguno. Su `profile()` rechaza cualquier entrada, y
 * el proveedor sigue registrado por dos cosas que sí se usan: es el titular del
 * identificador de cuenta "password" en `authAccounts` y de su `crypto` (Scrypt
 * de lucia), que resuelven por nombre `retrieveAccount`, `createAccount` y
 * `modifyAccountCredentials`.
 *
 * - entrar  → `password-signin`         (convex/passwordLogin.ts)
 * - alta    → `password-signup`         (convex/passwordLogin.ts)
 * - pedir código → `password-reset-request` (convex/passwordReset.ts, GER-53/57)
 * - canjearlo    → `password-reset-verify`  (convex/passwordReset.ts, GER-57)
 *
 * El motivo es el mismo en los cuatro casos: la librería relanza sus strings
 * internos al cuerpo HTTP, y con proveedores propios controlamos qué se
 * responde. Ver la cabecera de convex/passwordLogin.ts.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // El enganche se queda configurado aunque `profile()` rechace todo, y no
      // es decorativo: SIGUE SIENDO ALCANZABLE. La librería lo invoca en
      // Password.ts:129-135, **antes** de llamar a `profile()` en :136, así que
      // una llamada directa con `flow: "signUp"` o `"reset-verification"` pasa
      // por él y la política se aplica igualmente, aunque la petición muera una
      // línea después. Sin esto, esa superficie quedaría sin cubrir.
      //
      // (Con `flow: "signIn"` la librería deja `passwordToValidate` en `null` y
      // no llama aquí, así que nunca corre al iniciar sesión — que es lo que
      // garantiza que endurecer la política no deje fuera a quien ya tiene una
      // contraseña que no la cumple.)
      //
      // Recibe únicamente la contraseña, sin el correo (Password.ts:88); de ahí
      // que la política esté partida en convex/authz.ts.
      validatePasswordRequirements,

      /**
       * La puerta antigua, cerrada del todo (GER-54).
       *
       * `Password` no atiende ningún flujo: los cuatro viven en proveedores
       * propios (ver la cabecera de este archivo). Este `throw` incondicional es
       * lo que lo hace cierto, y es lo primero que corre en el `authorize` de
       * `Password` salvo el validador de contraseña (Password.ts:136), así que
       * ninguna entrada por aquí alcanza `authAccounts`: las ramas que consultan
       * o crean cuentas están todas después (:141, :153, :166, :178, :208).
       *
       * Sin esto el arreglo de GER-54 sería cosmético: bastaría llamar a
       * `signIn("password", {flow:"signIn"})` para recuperar los cuerpos
       * distinguibles, o a `{flow:"signUp"}` para recuperar el oráculo de
       * contraseña sin límite de intentos.
       *
       * Incondicional y no una lista de flujos, por dos razones: cubre también
       * `email-verification` y los flujos desconocidos —que morían más adelante
       * con mensajes de la librería—, y elimina la única ruta que quedaba a
       * `normalizeEmail(params.email as string)` con `email` ausente, que
       * reventaba con un TypeError.
       *
       * El mensaje es constante: no depende del correo ni de si existe.
       */
      profile() {
        throw new Error(
          "Usa los proveedores password-signin / password-signup / password-reset-request / password-reset-verify."
        );
      },
    }),
    // Entrar y darse de alta, en dos proveedores propios (GER-54).
    // Ver convex/passwordLogin.ts.
    PasswordSignIn,
    PasswordSignUp,
    // Recuperación de contraseña por código, en dos proveedores propios.
    // Ver convex/passwordReset.ts.
    PasswordResetRequest,
    PasswordResetVerify,
    Google({
      // El profile() por defecto de Convex Auth no conserva email_verified;
      // lo reenviamos explícitamente porque createOrUpdateUser lo exige.
      profile(googleProfile) {
        return {
          id: googleProfile.sub,
          name: googleProfile.name,
          email: googleProfile.email,
          email_verified: googleProfile.email_verified,
        };
      },
    }),
  ],
  /**
   * Duraciones explícitas en vez de heredadas (GER-59 · 3.2).
   *
   * Antes no se configuraba ninguna, así que corrían los valores por defecto de
   * la librería: 30 días de sesión total, 30 días de inactividad
   * (sessions.ts) y **1 hora** de JWT (tokens.ts). Escribirlas aquí no es
   * cosmético: fija el contrato en el repositorio en vez de dejarlo a merced de
   * la versión de la dependencia.
   *
   * Lo que acota de verdad es `jwt.durationMs`. El control de acceso NO es este
   * —`requireActiveUserId` (convex/authz.ts) deniega en la siguiente llamada—
   * pero un JWT ya emitido sigue siendo válido hasta que caduca, aunque su
   * sesión se haya revocado: `ctx.auth.getUserIdentity()` solo verifica la
   * firma. Pasar de 1 hora a 15 minutos reduce esa ventana en la misma
   * proporción. El precio es más renovaciones, que el cliente hace solo.
   *
   * `inactiveDurationMs` baja a 7 días: quien no entra en una semana vuelve a
   * autenticarse. La duración total se deja en los 30 días de siempre.
   */
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 días
    inactiveDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 días
  },
  jwt: {
    durationMs: 15 * 60 * 1000, // 15 minutos
  },

  callbacks: {
    /**
     * Defensa en profundidad contra el acceso de un usuario desactivado
     * (GER-56). El control de verdad está en `requireActiveUserId`
     * (convex/authz.ts), porque este callback NO cubre las sesiones ya
     * abiertas: `refreshSessionImpl` emite tokens nuevos para una sesión
     * existente sin volver a llamarlo.
     *
     * Lo que sí aporta: corre en los tres flujos de login justo antes de
     * persistir la sesión, así que no se crean sesiones para quien no puede
     * usarlas. Y como lanzar aborta la transacción completa, un usuario
     * desactivado tampoco puede cambiar su contraseña por código: el canje
     * crea sesión, así que se revierte entero.
     *
     * El mensaje no llega al cliente (Convex redacta en producción los errores
     * que no son `ConvexError`); la interfaz sigue mostrando el texto genérico
     * de "correo o contraseña incorrectos", que es lo que queremos: distinguir
     * "desactivado" revelaría el estado de la cuenta.
     */
    async beforeSessionCreation(ctx, { userId }) {
      const db = ctx.db as unknown as DatabaseReader;
      const user = await db.get(userId);
      if (user === null || user.status !== "activo") {
        throw new Error("Cuenta desactivada.");
      }
    },

    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        // Usuario que ya existe: no tocar su ficha (rol/nombre) al iniciar sesión.
        return args.existingUserId;
      }

      if (args.type === "oauth") {
        // Login con Google. Registro cerrado: solo entra quien ya está
        // provisionado con ese correo — nunca se crea un usuario aquí.
        // Canonizado antes de buscar (GER-57 · Issue 2.2): la búsqueda es por
        // el índice `by_email`, que compara la cadena exacta. Si Google
        // devolviera el correo con otra caja que la ficha provisionada, un
        // usuario legítimo se quedaría fuera con el mensaje de "no autorizada".
        const rawEmail = args.profile.email as string | undefined;
        const email = rawEmail === undefined ? undefined : normalizeEmail(rawEmail);
        const verified = args.profile.email_verified === true;
        // El ctx del callback de Convex Auth no conoce nuestros índices
        // (solo los del sistema); ctx.db es, en tiempo de ejecución, el
        // mismo DatabaseReader que usa el resto de convex/.
        const db = ctx.db as unknown as DatabaseReader;
        const match =
          verified && email
            ? await db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", email))
                .unique()
            : null;
        if (!match) {
          throw new Error(
            "Esta cuenta de Google no está autorizada. Pide a Martha que te invite desde Gestión de usuarios."
          );
        }
        return match._id;
      }

      // AUTORIDAD del registro cerrado: corre dentro de la transacción de
      // `createAccount`, así que cierra la carrera entre dos altas simultáneas.
      // `PasswordSignUp` comprueba lo mismo antes, pero eso es un cortacircuitos
      // para que el alta no llegue a tocar `authAccounts` (ver
      // convex/passwordLogin.ts) — no sustituye a esto.
      //
      // Mismo texto que allí, importado y no copiado: las dos respuestas
      // posibles a un alta rechazada no deben distinguirse entre sí.
      const someUserExists = await ctx.db.query("users").first();
      if (someUserExists) {
        throw new Error(REGISTRO_CERRADO_MESSAGE);
      }

      // Bootstrap: el primer usuario del sistema es siempre la dueña.
      // El correo ya viene canonizado de quien llama —`PasswordSignUp` desde
      // GER-54, no el `profile()` de `Password`, que ya no atiende nada—, pero se
      // vuelve a normalizar porque esta rama es la única que ESCRIBE en `users`:
      // si mañana llegara por otro camino, la ficha seguiría naciendo canónica.
      // `normalizeEmail` es idempotente, así que repetirlo no cuesta nada.
      return await ctx.db.insert("users", {
        name: (args.profile.name as string) || "Sin nombre",
        email: normalizeEmail(args.profile.email as string),
        role: "duena",
        status: "activo",
      });
    },
  },
});
