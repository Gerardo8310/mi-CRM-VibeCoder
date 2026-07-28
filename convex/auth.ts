import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import type { DatabaseReader } from "./_generated/server";
import { ResendOTP } from "./ResendOTP";
import { PasswordResetRequest } from "./passwordReset";

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
      profile(params) {
        // Cierra la rama `reset` de la librería (GER-53 · auditoría M2). El
        // `profile` es lo primero que corre en el `authorize` de Password, así
        // que esto detiene la petición antes de `retrieveAccount` y antes de
        // crear o destruir ningún código. Pedir el código va por el proveedor
        // "password-reset-request", que sí pasa por el límite (convex/
        // passwordReset.ts). El error es constante a propósito: no revela nada
        // sobre el correo. No afecta a `reset-verification`, que sigue igual.
        if (params.flow === "reset") {
          throw new Error("Usa el proveedor password-reset-request.");
        }
        return {
          email: params.email as string,
          name: (params.name as string) || "Sin nombre",
          // role/status reales los decide callbacks.createOrUpdateUser abajo;
          // este valor solo rellena el tipo del documento.
          role: "vendedor" as const,
          status: "activo" as const,
        };
      },
      // Habilita `flow: "reset-verification"`: verifica el código y aplica la
      // contraseña nueva. También invalida las sesiones de los demás
      // dispositivos (src/providers/Password.ts).
      reset: ResendOTP,
    }),
    // Pedir el código de recuperación. Ver convex/passwordReset.ts.
    PasswordResetRequest,
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
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        // Usuario que ya existe: no tocar su ficha (rol/nombre) al iniciar sesión.
        return args.existingUserId;
      }

      if (args.type === "oauth") {
        // Login con Google. Registro cerrado: solo entra quien ya está
        // provisionado con ese correo — nunca se crea un usuario aquí.
        const email = args.profile.email as string | undefined;
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
      return await ctx.db.insert("users", {
        name: (args.profile.name as string) || "Sin nombre",
        email: args.profile.email as string,
        role: "duena",
        status: "activo",
      });
    },
  },
});
