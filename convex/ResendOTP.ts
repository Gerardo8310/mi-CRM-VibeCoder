import { Email } from "@convex-dev/auth/providers/Email";
import { normalizeEmail } from "./email";
import { CODE_GROUP_SIZE, CODE_LENGTH } from "./authConstants";

/**
 * Proveedor de correo que manda el código de recuperación (GER-53).
 *
 * Dos condiciones sostienen el flujo legítimo: el `authorize` de abajo exige que
 * el código venga acompañado del correo correcto, y `verifyCodeAndSignIn` corta
 * a 10 intentos fallidos por hora y por correo.
 *
 * La segunda solo se sostiene si el "por correo" es un correo canónico, y por
 * eso este proveedor no se usa nunca directamente desde el cliente: los dos
 * proveedores de convex/passwordReset.ts lo invocan con el correo ya
 * normalizado. La librería indexa el límite por `params.email` tal cual se lo
 * den (mutations/verifyCodeAndSignIn.ts:42).
 *
 * POR QUÉ EL CÓDIGO ES LARGO Y ALFANUMÉRICO (GER-58)
 *
 * Porque hay una rama donde ese límite de 10 intentos sencillamente no existe.
 * `auth:signIn` acepta que la llamen SIN `provider` y solo con `params.code`
 * (signIn.js:13-24). Ahí `verifyCodeAndSignInImpl` calcula el identificador del
 * límite como `params.email ?? params.phone` — que en esa forma de llamada es
 * `undefined`, así que no comprueba ni consume ningún cupo
 * (verifyCodeAndSignIn.js:22-36). Y el código se busca por el SHA-256 del código
 * A SECAS, sin el correo en el índice (verifyCodeAndSignIn.js:64-68): el código
 * es el secreto entero.
 *
 * Las dos respuestas se distinguen: un código incorrecto devuelve
 * `{tokens: null}`, y uno correcto lanza "Provider `resend-otp` is not
 * configured" (porque en esa rama `allowExtraProviders` es `false`) revirtiendo
 * la transacción, así que el código ni siquiera se gasta y luego se canjea por la
 * vía legítima en un solo intento.
 *
 * ESA RAMA SIGUE AHÍ Y NO SE PUEDE CERRAR desde nuestro código: `auth:signIn` es
 * la acción pública de la librería, envolverla dejaría la original expuesta bajo
 * otro nombre, y registrar este proveedor como principal sería peor —permitiría
 * pedir códigos saltándose `consumeResetSlot`—. Lo único nuestro es la entropía.
 *
 * Doce caracteres de 32 símbolos son 2⁶⁰ ≈ 10¹⁸ candidatos. A mil intentos por
 * segundo, la probabilidad de acertar durante los 15 minutos de vigencia es de
 * ~8×10⁻¹³. Antes, con ocho dígitos (10⁸), ese mismo ritmo acertaba en unas 28
 * horas. El oráculo no desaparece: deja de ser buscable. Escrito así a propósito,
 * para que nadie lo lea como un cierre.
 *
 * El `id` NO puede ser "resend": la librería sustituye el remitente por
 * `onboarding@resend.dev` cuando coinciden ese id y el `from` por defecto
 * (src/server/implementation/signIn.ts).
 */

// La librería usa 1 hora por defecto (src/providers/Email.ts) — demasiado
// para un código corto que viaja por correo.
const CODE_MAX_AGE_SECONDS = 15 * 60;

/**
 * Alfabeto del código: los diez dígitos y las 26 letras MENOS `I`, `L`, `O` y
 * `U`. Fuente única — lo usan el generador, el normalizador y el formateador.
 *
 * Las tres primeras se van porque se confunden con `1` y `0` al copiar el código
 * de un correo. La `U` se va para dejar el total exacto en **32**, y eso no es
 * cosmética: 256 es múltiplo de 32, así que `byte % 32` reparte los 256 valores
 * posibles de un byte en exactamente 8 por símbolo. **No hay sesgo de módulo y
 * no hace falta descartar ningún byte** — con los diez dígitos sí hacía falta,
 * porque 256 no es múltiplo de 10.
 */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Caracteres que el alfabeto no admite pero que alguien teclearía igual al leer
 * el código de su correo. Mapearlos es seguro por construcción: ninguno de los
 * cuatro está en el alfabeto, así que esta sustitución nunca puede convertir un
 * código válido en otro código válido distinto — solo rescata entradas que si no
 * fallarían.
 *
 * La `U` no se mapea a nada: se cayó del alfabeto por aritmética, no por
 * parecerse a otro carácter, así que adivinar a qué la quiso convertir el usuario
 * sería inventar. Se descarta como cualquier otro carácter ajeno.
 */
const CONFUSABLES: Record<string, string> = {
  O: "0",
  I: "1",
  L: "1",
};

/**
 * Genera el código. `crypto.getRandomValues` y no `Math.random()`, que no es
 * criptográficamente seguro.
 *
 * Sin bucle de rechazo: ver por qué en el comentario de `CODE_ALPHABET`.
 */
function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Deja el código en la forma exacta que se comparó al generarlo: mayúsculas, sin
 * separadores, sin espacios y sin nada que no esté en el alfabeto.
 *
 * Es el equivalente de `normalizeEmail` para el código, y por el mismo motivo:
 * la librería hashea `params.code` TAL CUAL se lo demos
 * (verifyCodeAndSignIn.js:64), así que si no lo canonizamos nosotros antes, el
 * mismo código escrito en minúsculas o con los guiones de presentación no
 * cuadraría.
 *
 * Los códigos antiguos de ocho dígitos pasan por aquí sin cambiar —los dígitos
 * no los toca ni el paso a mayúsculas ni el filtrado—, así que los que estuvieran
 * en vuelo al desplegar se siguen canjeando.
 */
export function normalizeResetCode(raw: string): string {
  let normalized = "";
  for (const char of raw.toUpperCase()) {
    const mapped = CONFUSABLES[char] ?? char;
    if (CODE_ALPHABET.includes(mapped)) normalized += mapped;
  }
  return normalized;
}

/**
 * Agrupa el código para que se pueda leer y teclear: `K7M4-9XQP-3JRT`.
 *
 * SOLO presentación. El token que se guarda y se compara es el de
 * `generateCode()`, sin separadores; los guiones los quita `normalizeResetCode`
 * en cuanto vuelven.
 */
function formatCodeForDisplay(code: string): string {
  const groups = [];
  for (let i = 0; i < code.length; i += CODE_GROUP_SIZE) {
    groups.push(code.slice(i, i + CODE_GROUP_SIZE));
  }
  return groups.join("-");
}

// Los dos cuerpos reciben el código YA AGRUPADO. La agrupación es de lectura:
// quien lo escriba sin guiones entra igual, porque `normalizeResetCode` los
// quita. Se dice en el mensaje para que nadie dude.
const DASHES_NOTE =
  "Los guiones son solo para leerlo mejor: puedes escribirlo sin ellos.";

function plainTextBody(displayCode: string, minutes: number) {
  return [
    "Recibimos una solicitud para cambiar tu contraseña de SolarCRM.",
    "",
    `Tu código es: ${displayCode}`,
    "",
    DASHES_NOTE,
    "",
    `Caduca en ${minutes} minutos y solo sirve una vez.`,
    "",
    "Si no lo pediste, ignora este mensaje: tu contraseña no cambia hasta que alguien introduce este código.",
  ].join("\n");
}

// El tamaño y el interletraje bajaron con GER-58: el código pasó de 8 caracteres
// a 14 con separadores, y con los valores anteriores se salía del ancho en el
// cliente de correo del móvil.
function htmlBody(displayCode: string, minutes: number) {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917;line-height:1.5">
  <p>Recibimos una solicitud para cambiar tu contraseña de <strong>SolarCRM</strong>.</p>
  <p style="margin:24px 0">
    <span style="display:inline-block;padding:12px 16px;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:6px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:22px;font-weight:600;letter-spacing:2px;white-space:nowrap">${displayCode}</span>
  </p>
  <p style="color:#78716c;font-size:13px">${DASHES_NOTE}</p>
  <p>Caduca en ${minutes} minutos y solo sirve una vez.</p>
  <p style="color:#78716c;font-size:13px">Si no lo pediste, ignora este mensaje: tu contraseña no cambia hasta que alguien introduce este código.</p>
</div>`;
}

export const ResendOTP = Email({
  id: "resend-otp",
  from: "SolarCRM <no-reply@geo-pv.com>",
  maxAge: CODE_MAX_AGE_SECONDS,

  async generateVerificationToken() {
    return generateCode();
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
    // `token` es la forma canónica —la que se hasheó al crear la fila—; lo que
    // se envía es su presentación agrupada. Nunca al revés.
    const displayCode = formatCodeForDisplay(token);
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
        text: plainTextBody(displayCode, minutes),
        html: htmlBody(displayCode, minutes),
      }),
    });

    if (!response.ok) {
      // NO se registra nada aquí, y no es un olvido (GER-54).
      //
      // Esta función corre DENTRO de la acción `auth:signIn`, y la respuesta de
      // `POST /api/action` incluye un campo `logLines` con lo que la ejecución
      // haya escrito por consola (lo consume el propio cliente HTTP de Convex,
      // browser/http_client.js). Un `console.error` aquí saldría en el cuerpo de
      // la respuesta SOLO cuando la cuenta existe —porque solo entonces se
      // intenta el envío—, así que reabriría por `logLines` exactamente el canal
      // de enumeración que GER-54 cierra. Medido: con la clave de Resend
      // inválida, el correo existente devolvía `logLines` con dos entradas y el
      // inexistente ninguna.
      //
      // El registro de la avería se hace desde una mutación programada, fuera de
      // esta ejecución: ver `logResetSendFailure` en convex/passwordReset.ts.
      //
      // Nunca incluir `token` ni el destinatario en este mensaje.
      throw new Error(
        `Resend rechazó el envío del código (HTTP ${response.status}).`
      );
    }
  },
});
