import { Email } from "@convex-dev/auth/providers/Email";
import { normalizeEmail } from "./email";
import { CODE_LENGTH } from "./authConstants";

/**
 * Proveedor de correo que manda el código de recuperación (GER-53).
 *
 * Dos condiciones sostienen que un código numérico corto sea aceptable: el
 * `authorize` de abajo exige que el código venga acompañado del correo correcto,
 * y `verifyCodeAndSignIn` corta a 10 intentos fallidos por hora y por correo.
 *
 * La segunda solo se sostiene si el "por correo" es un correo canónico, y por
 * eso este proveedor no se usa nunca directamente desde el cliente: los dos
 * proveedores de convex/passwordReset.ts lo invocan con el correo ya
 * normalizado. La librería indexa el límite por `params.email` tal cual se lo
 * den (mutations/verifyCodeAndSignIn.ts:42).
 *
 * POR QUÉ 8 DÍGITOS Y NO 6 (GER-57 · Issue 2.7)
 *
 * Porque hay una rama donde ese límite de 10 intentos sencillamente no existe.
 * `auth:signIn` acepta que la llamen SIN `provider` y solo con `params.code`
 * (signIn.ts:60). Ahí `verifyCodeAndSignInImpl` calcula el identificador del
 * límite como `params.email ?? params.phone` — que en esa forma de llamada es
 * `undefined`, así que no comprueba ni consume ningún cupo
 * (verifyCodeAndSignIn.ts:42-53). Reproducido contra dev el 2026-07-29: tras un
 * intento fallido por esa vía, `attemptsLeft` seguía idéntico hasta el último
 * decimal.
 *
 * Y las dos respuestas se distinguen: un código incorrecto devuelve
 * `{tokens: null}`, y uno correcto lanza "Provider `resend-otp` is not
 * configured" (porque en esa rama `allowExtraProviders` es `false`) revirtiendo
 * la transacción, así que el código ni siquiera se gasta. Es decir: un anónimo
 * que conozca un correo con cuenta puede pedirle el código a la víctima —5
 * veces por hora, lo que permite el límite de solicitudes— y buscar cada uno
 * por fuerza bruta sin freno alguno.
 *
 * No se puede tapar desde aquí: `auth:signIn` es la acción pública de la
 * librería y no hay forma de envolverla sin dejar la original expuesta bajo
 * otro nombre. Lo que sí es nuestro es la entropía del código. Pasar de 6 a 8
 * dígitos lleva el espacio de 10⁶ a 10⁸: no cierra la vía, la encarece cien
 * veces. Queda declarado como riesgo residual, no como problema resuelto.
 *
 * El `id` NO puede ser "resend": la librería sustituye el remitente por
 * `onboarding@resend.dev` cuando coinciden ese id y el `from` por defecto
 * (src/server/implementation/signIn.ts).
 */

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
        // Sin el código (GER-59 · 3.3). Antes iba en el asunto, que es
        // justo lo que se lee sin desbloquear el teléfono: en la
        // previsualización de la bandeja y en la pantalla de bloqueo. Quien
        // tuviera el móvil a la vista un momento se llevaba el código entero
        // sin tocarlo. En el cuerpo sigue estando.
        subject: "Código para recuperar tu contraseña de SolarCRM",
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
