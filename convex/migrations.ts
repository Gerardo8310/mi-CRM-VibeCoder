import { internalMutation, internalQuery } from "./_generated/server";
import type { DatabaseReader, DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeEmail } from "./email";

/**
 * Migración de un solo uso: pasar los correos a su forma canónica (GER-54).
 *
 * ESTE ARCHIVO ES INERTE EN GER-56. Nada lo llama y ningún comportamiento
 * cambia al desplegarlo. Se despliega ahora, antes de tocar la autenticación,
 * para poder ejecutar `inspectEmailNormalization` contra producción y revisar
 * las colisiones ANTES de activar la normalización en el Issue 2. Al revés
 * —desplegar el comportamiento y descubrir después una colisión— dejaría
 * cuentas sin poder entrar hasta una segunda corrección.
 *
 * Qué se normaliza y qué no:
 *  - `users.email`: sí.
 *  - `authAccounts` con `provider === "password"`: sí, tanto `providerAccountId`
 *    (que es el correo con el que se inicia sesión) como `emailVerified`.
 *  - `authAccounts` de Google: NO. Ahí `providerAccountId` es el `sub` de
 *    Google, un identificador opaco que no es un correo; tocarlo rompería el
 *    vínculo de la cuenta. Tampoco hace falta: el login con Google busca por
 *    `users.by_email`, no por la cuenta.
 */

type EmailChange = { id: string; from: string; to: string };

type Report = {
  usersTotal: number;
  passwordAccountsTotal: number;
  /** Filas que la migración cambiaría. Sin secretos ni hashes. */
  userEmailChanges: EmailChange[];
  passwordAccountChanges: EmailChange[];
  /** Dos usuarios cuyo correo colapsa en el mismo valor canónico. */
  userEmailCollisions: { normalized: string; userIds: string[] }[];
  /** Dos cuentas de contraseña que colapsan en el mismo identificador. */
  passwordAccountCollisions: { normalized: string; accountIds: string[] }[];
  /** Cuenta de contraseña cuyo correo no cuadra con la ficha de su usuario. */
  userAccountMismatches: {
    accountId: string;
    userId: string;
    accountEmail: string;
    userEmail: string;
  }[];
  /** `true` solo si no hay colisiones ni incoherencias. */
  safeToMigrate: boolean;
};

/**
 * Construye el informe. Solo lee — la comparten el dry-run y la migración para
 * que esta última decida sobre exactamente los mismos datos que revisaste tú.
 */
async function buildReport(db: DatabaseReader): Promise<Report> {
  const users = await db.query("users").collect();
  const accounts = await db.query("authAccounts").collect();
  const passwordAccounts = accounts.filter((a) => a.provider === "password");

  const userEmailChanges: EmailChange[] = [];
  for (const user of users) {
    const canonical = normalizeEmail(user.email);
    if (canonical !== user.email) {
      userEmailChanges.push({ id: user._id, from: user.email, to: canonical });
    }
  }

  const passwordAccountChanges: EmailChange[] = [];
  for (const account of passwordAccounts) {
    const canonical = normalizeEmail(account.providerAccountId);
    const verifiedNeedsFix =
      account.emailVerified !== undefined &&
      normalizeEmail(account.emailVerified) !== account.emailVerified;
    if (canonical !== account.providerAccountId || verifiedNeedsFix) {
      passwordAccountChanges.push({
        id: account._id,
        from: account.providerAccountId,
        to: canonical,
      });
    }
  }

  // 1. Colisiones entre fichas de usuario.
  const usersByCanonical = new Map<string, string[]>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    usersByCanonical.set(key, [...(usersByCanonical.get(key) ?? []), user._id]);
  }
  const userEmailCollisions = [...usersByCanonical.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalized, userIds]) => ({ normalized, userIds }));

  // 2. Colisiones entre cuentas de contraseña. Se comprueba aparte de las
  //    fichas: son tablas distintas y una puede colisionar sin la otra.
  const accountsByCanonical = new Map<string, string[]>();
  for (const account of passwordAccounts) {
    const key = normalizeEmail(account.providerAccountId);
    accountsByCanonical.set(key, [
      ...(accountsByCanonical.get(key) ?? []),
      account._id,
    ]);
  }
  const passwordAccountCollisions = [...accountsByCanonical.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalized, accountIds]) => ({ normalized, accountIds }));

  // 3. Incoherencias entre la ficha y su cuenta de contraseña. No debería
  //    haberlas: hoy no existe ninguna función que cambie el correo de un
  //    usuario. Si aparece una, es una anomalía que hay que entender antes de
  //    tocar nada — normalizar encima solo la enterraría.
  const userAccountMismatches: Report["userAccountMismatches"] = [];
  for (const account of passwordAccounts) {
    const user = users.find((u) => u._id === account.userId);
    if (user === undefined) {
      userAccountMismatches.push({
        accountId: account._id,
        userId: account.userId,
        accountEmail: account.providerAccountId,
        userEmail: "(la ficha de usuario no existe)",
      });
      continue;
    }
    if (normalizeEmail(user.email) !== normalizeEmail(account.providerAccountId)) {
      userAccountMismatches.push({
        accountId: account._id,
        userId: user._id,
        accountEmail: account.providerAccountId,
        userEmail: user.email,
      });
    }
  }

  return {
    usersTotal: users.length,
    passwordAccountsTotal: passwordAccounts.length,
    userEmailChanges,
    passwordAccountChanges,
    userEmailCollisions,
    passwordAccountCollisions,
    userAccountMismatches,
    safeToMigrate:
      userEmailCollisions.length === 0 &&
      passwordAccountCollisions.length === 0 &&
      userAccountMismatches.length === 0,
  };
}

/**
 * DRY-RUN. No escribe nada. Ejecutar desde el dashboard de Convex (o
 * `npx convex run migrations:inspectEmailNormalization`) y revisar la salida
 * ANTES de desplegar el Issue 2.
 *
 * Si `safeToMigrate` es `false`, hay que resolver a mano lo que aparezca en
 * `userEmailCollisions`, `passwordAccountCollisions` o `userAccountMismatches`
 * antes de continuar. Una colisión significa que dos cuentas distintas pasarían
 * a compartir identificador de acceso: eso no lo puede decidir una migración.
 *
 * El informe incluye correos (son justo lo que hay que revisar) pero nunca
 * `secret` ni ningún hash.
 */
export const inspectEmailNormalization = internalQuery({
  args: {},
  handler: async (ctx): Promise<Report> => {
    return await buildReport(ctx.db);
  },
});

/**
 * LA MIGRACIÓN. Ejecutar una sola vez, justo después de desplegar el Issue 2.
 *
 * Fail-closed: vuelve a construir el mismo informe y aborta si aparece
 * cualquier colisión o incoherencia. Como las mutaciones de Convex son
 * transaccionales, abortar no deja nada a medias.
 *
 * Es idempotente: al segundo pase no encuentra nada que cambiar.
 */
export const normalizeEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const db: DatabaseWriter = ctx.db;
    const report = await buildReport(db);

    if (!report.safeToMigrate) {
      throw new Error(
        "Migración abortada: hay colisiones o incoherencias. Ejecuta " +
          "migrations:inspectEmailNormalization y resuélvelas a mano primero. " +
          `Colisiones de usuario: ${report.userEmailCollisions.length}, ` +
          `de cuenta: ${report.passwordAccountCollisions.length}, ` +
          `incoherencias: ${report.userAccountMismatches.length}.`
      );
    }

    for (const change of report.userEmailChanges) {
      await db.patch(change.id as Id<"users">, { email: change.to });
    }

    for (const change of report.passwordAccountChanges) {
      const accountId = change.id as Id<"authAccounts">;
      const account = await db.get(accountId);
      if (account === null) continue;
      await db.patch(accountId, {
        providerAccountId: normalizeEmail(account.providerAccountId),
        ...(account.emailVerified !== undefined
          ? { emailVerified: normalizeEmail(account.emailVerified) }
          : {}),
      });
    }

    return {
      usersPatched: report.userEmailChanges.length,
      passwordAccountsPatched: report.passwordAccountChanges.length,
    };
  },
});
