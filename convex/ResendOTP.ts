import { Email } from "@convex-dev/auth/providers/Email";
import { normalizeEmail } from "./email";

/**
 * Proveedor de correo que manda el código de recuperación (GER-53).
 *
 * Un código de 6 dígitos parece poco, pero es seguro aquí por dos motivos: el
 * `authorize` de abajo exige que el código venga acompañado del correo correcto,
 * y `verifyCodeAndSignIn` corta a 10 intentos fallidos por hora y por correo.
 * Sin esas dos condiciones haría falta un código mucho más largo.
 *
 * Ese segundo motivo solo se sostiene si el "por correo" es un correo canónico,
 * y por eso este proveedor no se usa nunca directamente desde el cliente: los
 * dos proveedores de convex/passwordReset.ts lo invocan con el correo ya
 * normalizado. La librería indexa el límite por `params.email` tal cual se lo
 * den (mutations/verifyCodeAndSignIn.ts:42).
 *
 * El `id` NO puede ser "resend": la librería sustituye el remitente por
 * `onboarding@resend.dev` cuando coinciden ese id y el `from` por defecto
 * (src/server/implementation/signIn.ts).
 */

const CODE_LENGTH = 6;

// La librería usa 1 hora por defecto (src/providers/Email.ts) — demasiado
// para un código corto que viaja por correo.
const CODE_MAX_AGE_SECONDS = 15 * 60;

// 250 es el mayor múltiplo de 10 que cabe en un byte.
const LARGEST_UNBIASED_BYTE = 250;

/**
 * Genera el código sin sesgo de módulo. Hacer `byte % 10` sobre 0..255
 * favorecería a los dígitos 0-5, porque 256 no es múltiplo de 10: descartamos
 * los bytes a partir de 250 y volvemos a pedir. `Math.random()` no vale aquí
 * por no ser criptográficamente seguro.
 */
function generateNumericCode(): string {
  const buffer = new Uint8Array(1);
  let code = "";
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(buffer);
    if (buffer[0] >= LARGEST_UNBIASED_BYTE) continue;
    code += (buffer[0] % 10).toString();
  }
  return code;
}

function plainTextBody(code: string, minutes: number) {
  return [
    "Recibimos una solicitud para cambiar tu contraseña de SolarCRM.",
    "",
    `Tu código es: ${code}`,
    "",
    `Caduca en ${minutes} minutos y solo sirve una vez.`,
    "",
    "Si no lo pediste, ignora este mensaje: tu contraseña no cambia hasta que alguien introduce este código.",
  ].join("\n");
}

function htmlBody(code: string, minutes: number) {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917;line-height:1.5">
  <p>Recibimos una solicitud para cambiar tu contraseña de <strong>SolarCRM</strong>.</p>
  <p style="margin:24px 0">
    <span style="display:inline-block;padding:12px 20px;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:6px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:28px;font-weight:600;letter-spacing:6px">${code}</span>
  </p>
  <p>Caduca en ${minutes} minutos y solo sirve una vez.</p>
  <p style="color:#78716c;font-size:13px">Si no lo pediste, ignora este mensaje: tu contraseña no cambia hasta que alguien introduce este código.</p>
</div>`;
}

export const ResendOTP = Email({
  id: "resend-otp",
  from: "SolarCRM <no-reply@geo-pv.com>",
  maxAge: CODE_MAX_AGE_SECONDS,

  async generateVerificationToken() {
    return generateNumericCode();
  },

  /**
   * Sustituye al `authorize` por defecto de `Email()` (GER-57 · Issue 2.2), que
   * compara `account.providerAccountId !== params.email` como cadenas exactas
   * (providers/Email.ts:50). Se puede sobrescribir porque `providerDefaults`
   * fusiona `provider.options` —donde acaba esta configuración— encima del
   * proveedor ya construido (server/provider_utils.ts, `providerDefaults`).
   *
   * Comparar normalizado en AMBOS lados es lo que hace que el cambio sea seguro
   * de desplegar antes de la migración de datos: mientras haya cuentas cuyo
   * `providerAccountId` todavía no sea canónico, la comparación cruda las
   * rechazaría aunque el correo fuera el mismo.
   */
  async authorize(params, account) {
    const claimedEmail = params.email;
    // `account` viene tipado sobre el `GenericDataModel` de la librería, así
    // que sus campos son `Value` y no `string`. La comprobación no es
    // ceremonia del tipo: es la que garantiza que nunca comparamos dos cosas
    // que no son correos.
    const accountEmail = account.providerAccountId;
    if (typeof claimedEmail !== "string" || typeof accountEmail !== "string") {
      throw new Error("Verificar el código requiere un `email` en los params.");
    }
    if (normalizeEmail(accountEmail) !== normalizeEmail(claimedEmail)) {
      throw new Error("El código no corresponde a ese correo.");
    }
  },

  async sendVerificationRequest({ identifier: email, token, provider }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Falta RESEND_API_KEY en el entorno de Convex.");
    }

    const minutes = Math.round(CODE_MAX_AGE_SECONDS / 60);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: [email],
        subject: `${token} es tu código para recuperar tu contraseña`,
        text: plainTextBody(token, minutes),
        html: htmlBody(token, minutes),
      }),
    });

    if (!response.ok) {
      // Nunca incluir `token` en este mensaje: acaba en los logs de Convex.
      throw new Error(
        `Resend rechazó el envío del código (HTTP ${response.status}).`
      );
    }
  },
});
