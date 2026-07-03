import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

/**
 * Autenticación por correo + contraseña (GER-7).
 *
 * El flujo normal del MVP es invitación por correo (GER-48) — no hay
 * registro público. La única excepción es arrancar de cero: el "signUp"
 * solo funciona mientras la tabla `users` esté vacía (crea a la dueña);
 * en cuanto existe un usuario, el alta se bloquea sola y todo pasa por
 * "Gestión de usuarios". Ver el toggle temporal en (auth)/login/page.tsx.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string) || "Sin nombre",
          // role/status reales los decide callbacks.createOrUpdateUser abajo;
          // este valor solo rellena el tipo del documento.
          role: "vendedor" as const,
          status: "activo" as const,
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
