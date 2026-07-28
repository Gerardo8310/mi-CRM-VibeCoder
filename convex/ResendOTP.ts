import { Email } from "@convex-dev/auth/providers/Email";

/**
 * Proveedor de correo que manda el código de recuperación (GER-53).
 *
 * Un código de 6 dígitos parece poco, pero es seguro aquí por dos motivos
 * que aporta la librería: el `authorize` por defecto de `Email()` exige que
 * el código venga acompañado del correo correcto (node_modules/@convex-dev/
 * auth/src/providers/Email.ts), y `verifyCodeAndSignIn` corta a 10 intentos
 * fallidos por hora y por correo. Sin esas dos condiciones haría falta un
 * código mucho más largo.
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
