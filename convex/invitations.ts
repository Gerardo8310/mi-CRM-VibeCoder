import { v } from "convex/values";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { requireOwnerId } from "./authz";
import { looksLikeEmail, normalizeEmail } from "./email";
import { sendEmail } from "./resend";

/**
 * Invitar a alguien al CRM (GER-48, rama 2).
 *
 * EL CORREO NO LLEVA ENLACE, Y ESO ES EL DISEÑO ENTERO
 *
 * El criterio de aceptación del issue pedía "un correo con enlace para crear su
 * contraseña". No se hace, y la desviación está declarada: los filtros de correo
 * corporativos —Outlook Safe Links, Defender, los antivirus de escritorio—
 * **abren los enlaces antes que el destinatario** para inspeccionarlos. Un token
 * de un solo uso llega quemado y la persona ve "este enlace ya se usó" sin haber
 * tocado nada. Es un fallo que no se puede depurar desde aquí, porque depende
 * del cliente de correo de cada quien.
 *
 * Lo que se manda es un aviso: entra al CRM y escribe tu correo. Lo demás lo
 * resuelve el login en dos pasos.
 *
 * POR QUÉ ESTO NO TRAE NINGÚN FLUJO NUEVO
 *
 * "Crear tu primera contraseña" y "recuperar la tuya" son el mismo flujo en
 * cuanto la persona tiene una fila en `authAccounts`. Los dos proveedores de
 * convex/passwordReset.ts —auditados y en producción desde GER-57— sirven tal
 * cual. Por eso este archivo solo crea la cuenta: no genera códigos, no manda
 * códigos y no verifica nada.
 *
 * POR QUÉ NO SE USA `createAccount`, QUE SERÍA LO NATURAL
 *
 * `createAccountFromCredentialsImpl` acaba llamando a `upsertUserAndAccount` con
 * `existingUserId = null`, y de ahí a nuestro `callbacks.createOrUpdateUser`
 * (convex/auth.ts), que **lanza `REGISTRO_CERRADO_MESSAGE`** para cualquier alta
 * que no sea el bootstrap. Insertar las dos filas a mano es lo que permite que
 * convex/auth.ts no se toque: la de `authAccounts` tiene tres campos
 * obligatorios y ninguna lógica.
 */

/**
 * Secreto provisional de una cuenta recién invitada, entre que se inserta la
 * fila y `invite` le pone uno aleatorio de verdad.
 *
 * **NO PUEDE CONTENER DOS PUNTOS**, y esa es toda su seguridad. `Scrypt.verify`
 * (lucia/dist/crypto.js) parte el hash guardado por `:` y **devuelve `false` si
 * no salen exactamente dos trozos**, sin llegar a calcular nada. Es decir: esta
 * cadena no es que sea difícil de acertar, es que **ninguna contraseña puede
 * verificarse contra ella**. Falla cerrado por construcción, no por longitud.
 *
 * Lo mismo valdría para un secreto ausente —`retrieveAccountWithCredentials`
 * pasa `existingAccount.secret ?? ""` y `""` tampoco parte en dos—, pero un
 * literal con nombre dice lo que quiere decir a quien lo encuentre en la base.
 */
const PLACEHOLDER_SECRET = "sin-contrasena-todavia-GER48";

/**
 * ¿Esta persona fue invitada y todavía no ha elegido contraseña?
 *
 * **FUENTE ÚNICA DE LA REGLA.** La usan `methodFor` (convex/passwordLogin.ts),
 * `users:list` (convex/users.ts) y el reenvío de aquí abajo. No la reescribas
 * campo a campo en ningún otro sitio, y menos en el cliente.
 *
 * LA CONJUNCIÓN ES LA REGLA, NO UNA DE LAS DOS MITADES. Mirar solo la ausencia
 * de `passwordSetAt` parecería equivalente y no lo es: las fichas anteriores a
 * este cambio tampoco lo tienen y sí tienen contraseña. Con la regla ingenua, la
 * cuenta de Martha habría dejado de aceptar la suya el día del despliegue —el
 * login le habría exigido un código para una contraseña que ya tenía—. Lo cazó
 * la auditoría (M1) antes de que se escribiera una línea.
 *
 * Como nada escribía `invitedAt` hasta hoy, ninguna ficha existente cumple la
 * conjunción y no hace falta ningún backfill.
 */
export function sinContrasena(user: {
  invitedAt?: number;
  passwordSetAt?: number;
}): boolean {
  return user.invitedAt !== undefined && user.passwordSetAt === undefined;
}

/**
 * Crea la ficha y su cuenta de contraseña. **Aquí vive toda la autorización y
 * toda la validación de una invitación**; la acción de abajo solo hace lo que no
 * cabe en una mutación (azar y red).
 *
 * Es una sola mutación a propósito: las de Convex son transaccionales, así que
 * dos invitaciones simultáneas del mismo correo no pueden colarse ambas leyendo
 * el mismo estado previo.
 */
export const createInvitedUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("vendedor"), v.literal("duena")),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);

    // El recorte va ANTES de validar, no después: sin él una cadena de espacios
    // pasa la regla de "no vacío" y se guarda una ficha sin nombre legible.
    const name = args.name.trim();
    const email = normalizeEmail(args.email);
    if (name.length === 0) {
      throw new Error("Hace falta el nombre de la persona.");
    }
    // No basta con que no esté vacío: sin esto, un correo mal tecleado crea una
    // ficha que no puede entrar nunca y que el MVP no sabe borrar. Ver
    // `looksLikeEmail` (convex/email.ts) para por qué la comprobación es tan
    // pobre a propósito.
    if (!looksLikeEmail(email)) {
      throw new Error("Ese correo no tiene forma de correo. Revísalo.");
    }

    // Los mensajes de aquí SÍ pueden ser concretos, al revés que los de los
    // proveedores de login: quien llega hasta esta línea es una dueña
    // autenticada que está mirando la lista completa del equipo, así que no se
    // le revela nada que no tenga delante.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing !== null) {
      throw new Error(
        "Ya existe alguien con ese correo. Si está inactivo, reactívalo desde su ficha."
      );
    }

    // Y también `authAccounts`, que no es paranoia. Convex no impone unicidad:
    // una fila huérfana con ese correo —una ficha borrada a mano, un alta a
    // medias— dejaría DOS filas para el mismo `(provider, providerAccountId)`, y
    // entonces el `.unique()` con el que la librería busca la cuenta reventaría
    // en el siguiente inicio de sesión de esa persona. Cuesta una lectura.
    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .unique();
    if (existingAccount !== null) {
      throw new Error(
        "Ese correo ya tiene una cuenta de acceso. Búscalo en la lista antes de invitarlo."
      );
    }

    const userId = await ctx.db.insert("users", {
      name,
      email,
      role: args.role,
      // Activo desde el primer instante. No hay estado "pendiente": lo que se
      // quiere mostrar en la pantalla es "todavía no tiene contraseña", y eso lo
      // dice `sinContrasena` sin añadir un tercer valor a `status` que habría
      // que excluir a mano en cada consulta que hoy filtra por "activo".
      status: "activo",
      invitedBy: ownerId,
      invitedAt: Date.now(),
    });

    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      secret: PLACEHOLDER_SECRET,
    });

    // Se devuelven los valores GUARDADOS, no los que mandó el cliente: es lo que
    // se le manda por correo, y tiene que ser lo mismo que quedó en la base.
    return { userId, name, email };
  },
});

/**
 * Lo que `resendInvitation` necesita saber, resuelto donde hay base de datos.
 *
 * Existe porque **una acción no tiene `ctx.db`**: no puede llamar a
 * `requireOwnerId` ni leer una ficha. Si el reenvío intentara autorizarse solo,
 * no compilaría; y si se "arreglara" quitando la comprobación, quedaría un envío
 * de correo sin ninguna autoridad detrás. Lo señaló la auditoría (M3).
 *
 * Que devuelva el correo GUARDADO, y no lo acepte de quien llama, es la otra
 * mitad: si no, la dueña podría reenviar la invitación de una persona a una
 * dirección distinta de la de su ficha.
 */
export const datosParaReenviar = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireOwnerId(ctx);

    const user = await ctx.db.get(userId);
    if (user === null) throw new Error("Ese usuario no existe.");
    if (!sinContrasena(user)) {
      throw new Error("Esa persona ya eligió su contraseña.");
    }
    // Condición conjunta, y esta mitad la pidió la auditoría (N8): a alguien
    // desactivado el correo no le serviría de nada. `methodFor` le responde
    // "password" y `password-reset-request` corta antes de mandarle el código,
    // así que se le estaría prometiendo un camino que no existe.
    if (user.status !== "activo") {
      throw new Error("Esa persona está desactivada. Reactívala primero.");
    }

    return { name: user.name, email: user.email };
  },
});

/**
 * Invitar. Acción porque necesita dos cosas que una mutación no puede hacer:
 * azar criptográfico (`crypto.getRandomValues` no es determinista) y red.
 *
 * EL CONTRATO ES ASIMÉTRICO A PROPÓSITO
 *
 * Hasta que la ficha existe, cualquier problema **lanza** y no se ha creado
 * nada. A partir de ahí **no vuelve a lanzar nunca**: la ficha ya está en la
 * base, y un error sería decirle a la dueña que no se creó cuando sí. Lo que
 * pueda fallar después se resume en `correoEnviado: false`, y la pantalla ofrece
 * reenviar.
 *
 * QUÉ PASA SI SE CAE JUSTO EN MEDIO
 *
 * Queda una cuenta con el secreto provisional. **Falla cerrado** —ver
 * PLACEHOLDER_SECRET— y **se cura sola**: cuando la persona pida su código,
 * `password-reset-verify` llama a `modifyAccountCredentials` y sobrescribe ese
 * literal con un Scrypt de verdad. No hay nada que rescatar a mano.
 *
 * Dicho de otro modo: los 32 bytes de abajo son defensa en profundidad, no el
 * control. El sistema es correcto sin ellos.
 */
export const invite = action({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("vendedor"), v.literal("duena")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ userId: Id<"users">; correoEnviado: boolean }> => {
    const { userId, name, email } = await ctx.runMutation(
      internal.invitations.createInvitedUser,
      args
    );

    try {
      // 32 bytes que nadie ve nunca: no se guardan, no se devuelven y no se
      // registran. La persona no entra con esto — entra eligiendo su contraseña
      // por código. Existe para que la fila quede indistinguible de cualquier
      // otra cuenta en vez de con un literal reconocible.
      await modifyAccountCredentials<DataModel>(ctx, {
        provider: "password",
        account: { id: email, secret: randomSecret() },
      });

      await sendEmail(invitationEmail(name, email));
      return { userId, correoEnviado: true };
    } catch {
      // Aquí SÍ se puede registrar, al revés que en convex/resend.ts. Allí el
      // problema es que `logLines` viaja al cliente y solo hay envío cuando la
      // cuenta existe, así que un log distinguiría cuentas. Aquí quien llama es
      // la dueña autenticada que acaba de crear esa ficha: no se le revela nada
      // que no acabe de escribir ella misma. Sin el correo, de todos modos, para
      // no acumular datos personales en los registros del deployment.
      console.error("invitations.invite: la invitación no pudo enviarse.");
      return { userId, correoEnviado: false };
    }
  },
});

/**
 * Volver a mandar el mismo aviso. No toca la cuenta, no genera ningún código y
 * no cambia ni un dato: es literalmente el correo otra vez.
 *
 * Toda la autoridad y toda la elegibilidad están en `datosParaReenviar`. Esta
 * función solo envía, y solo si aquella la dejó pasar.
 */
export const resendInvitation = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ correoEnviado: boolean }> => {
    const { name, email } = await ctx.runQuery(
      internal.invitations.datosParaReenviar,
      { userId }
    );

    try {
      await sendEmail(invitationEmail(name, email));
      return { correoEnviado: true };
    } catch {
      console.error("invitations.resendInvitation: el reenvío no pudo salir.");
      return { correoEnviado: false };
    }
  },
});

/**
 * 32 bytes en hexadecimal. `crypto.getRandomValues` y no `Math.random()`, que no
 * es criptográficamente seguro — mismo criterio que el código de recuperación
 * (convex/ResendOTP.ts).
 */
function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * El correo de invitación: sin código, sin token y **sin enlace de un solo
 * uso**.
 *
 * La dirección del CRM va como texto, y eso es seguro precisamente porque es
 * **estable e idempotente**: un escáner que la visite no consume nada. Lo que se
 * quema al inspeccionarlo es un token, y aquí no hay ninguno.
 */
function invitationEmail(name: string, email: string) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    throw new Error("Falta SITE_URL en el entorno de Convex.");
  }
  const nombrePila = name.split(/\s+/)[0] ?? name;

  return {
    to: email,
    subject: "Ya tienes acceso a SolarCRM",
    text: [
      `Hola ${nombrePila}:`,
      "",
      "Te dimos acceso a SolarCRM. Para entrar la primera vez:",
      "",
      `1. Abre ${siteUrl}`,
      `2. Escribe tu correo: ${email}`,
      "3. Te enviaremos un código para que elijas tu contraseña.",
      "",
      "No necesitas hacer nada más desde este mensaje.",
      "",
      "Si no esperabas este correo, puedes ignorarlo.",
    ].join("\n"),
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917;line-height:1.5">
  <p>Hola ${nombrePila}:</p>
  <p>Te dimos acceso a <strong>SolarCRM</strong>. Para entrar la primera vez:</p>
  <ol style="padding-left:20px;margin:16px 0">
    <li style="margin-bottom:6px">Abre <a href="${siteUrl}" style="color:#C98A0A">${siteUrl}</a></li>
    <li style="margin-bottom:6px">Escribe tu correo: <strong>${email}</strong></li>
    <li>Te enviaremos un código para que elijas tu contraseña.</li>
  </ol>
  <p>No necesitas hacer nada más desde este mensaje.</p>
  <p style="color:#78716c;font-size:13px">Si no esperabas este correo, puedes ignorarlo.</p>
</div>`,
  };
}
