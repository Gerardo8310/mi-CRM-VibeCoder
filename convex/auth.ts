import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import type { DatabaseReader } from "./_generated/server";
import { PasswordResetRequest, PasswordResetVerify } from "./passwordReset";
import { normalizeEmail } from "./email";
import {
  validatePasswordLocalPart,
  validatePasswordRequirements,
} from "./authz";

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
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Sustituye a la validación por defecto de la librería, que solo exigía 8
      // caracteres no vacíos (Password.ts:251-255). La librería la llama SOLO
      // con `flow: "signUp"` —el otro caso, "reset-verification", ya no existe
      // en este proveedor— así que nunca corre al iniciar sesión: endurecer la
      // política no puede dejar fuera a nadie que ya tenga cuenta (GER-59 · 3.1).
      //
      // Recibe únicamente la contraseña, sin el correo (Password.ts:88). La
      // regla que sí necesita el correo va en `profile()`, justo debajo.
      validatePasswordRequirements,

      profile(params) {
        // Defensa en profundidad sobre las dos ramas de recuperación de la
        // librería (GER-53 · auditoría M2, y GER-57 · Issue 2.1). Desde GER-57
        // este proveedor ya no configura `reset`, así que la propia librería
        // rechaza sola ambos flujos (Password.ts:167 y :180); esto se queda
        // porque `profile` es lo primero que corre en el `authorize` de
        // `Password`, así que detiene la petición antes incluso de esa
        // comprobación, y porque documenta a dónde ha ido cada flujo.
        // El error es constante a propósito: no revela nada sobre el correo.
        if (params.flow === "reset" || params.flow === "reset-verification") {
          throw new Error(
            "Usa los proveedores password-reset-request / password-reset-verify."
          );
        }
        // Forma canónica del correo (GER-57 · Issue 2.2). `profile` corre en
        // signUp y en signIn, así que este es el único sitio que hay que tocar
        // para que ambos flujos usen el mismo identificador: `createAccount` y
        // `retrieveAccount` reciben `profile.email` (Password.ts:137, :147,
        // :159). Sin esto, "Ana@x.com" y "ana@x.com" son dos cuentas.
        const email = normalizeEmail(params.email as string);

        // La mitad de la política que necesita el correo (GER-59 · 3.1). Va
        // aquí porque `profile` es el único enganche que recibe los `params`
        // completos; `validatePasswordRequirements` solo ve la contraseña.
        //
        // El `flow === "signUp"` NO es decorativo: `profile` también corre al
        // iniciar sesión, y sin esa condición alguien cuya contraseña contenga
        // su propio correo dejaría de poder entrar el día que despleguemos esto.
        // La política se aplica al crear y al cambiar, nunca al entrar.
        if (params.flow === "signUp" && typeof params.password === "string") {
          validatePasswordLocalPart(params.password, email);
        }

        return {
          email,
          name: (params.name as string) || "Sin nombre",
          // role/status reales los decide callbacks.createOrUpdateUser abajo;
          // este valor solo rellena el tipo del documento.
          role: "vendedor" as const,
          status: "activo" as const,
        };
      },
    }),
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

      const someUserExists = await ctx.db.query("users").first();
      if (someUserExists) {
        throw new Error(
          "El registro abierto está deshabilitado. Pide a Martha que te invite desde Gestión de usuarios."
        );
      }

      // Bootstrap: el primer usuario del sistema es siempre la dueña.
      // El correo ya viene canonizado desde `profile()`, pero se vuelve a
      // normalizar porque esta rama es la única que ESCRIBE en `users`: si
      // mañana llegara por otro camino, la ficha seguiría naciendo canónica.
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
