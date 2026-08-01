/**
 * El envío de correo, en un solo sitio (GER-48, rama 2).
 *
 * Hasta ahora solo salía un correo del CRM —el código de recuperación— y su
 * `fetch` vivía dentro de `convex/ResendOTP.ts`. Con las invitaciones son dos, y
 * lo que importa no es ahorrarse diez líneas: es que el **contrato de silencio**
 * de abajo no acabe existiendo en dos copias que alguien pueda editar por
 * separado.
 *
 * EL CONTRATO, QUE ES LO ÚNICO DELICADO DE ESTE ARCHIVO
 *
 * 1. **No se registra NADA aquí, ni siquiera un fallo.** Esta función corre
 *    dentro de la acción `auth:signIn` cuando la llama `ResendOTP`, y la
 *    respuesta de `POST /api/action` incluye un campo `logLines` con lo que la
 *    ejecución haya escrito por consola (lo consume el propio cliente HTTP de
 *    Convex, browser/http_client.js). Como el envío solo se intenta cuando la
 *    cuenta existe, un `console.error` aquí aparecería en el cuerpo de la
 *    respuesta ÚNICAMENTE en ese caso, y volvería a distinguir cuenta existente
 *    de inexistente — el canal de enumeración que cerró GER-54. Medido entonces
 *    con la clave de Resend inválida: el correo existente devolvía `logLines`
 *    con dos entradas y el inexistente ninguna.
 *
 * 2. **El mensaje del error no lleva el destinatario ni ningún token.** Solo el
 *    código de estado que devolvió Resend. El detalle de la avería se
 *    diagnostica en el panel de Resend, que es donde vive.
 *
 * 3. **Se comprueba `response.ok`.** `fetch` no lanza con un 4xx ni con un 5xx;
 *    sin esta comprobación, un envío rechazado se daría por bueno.
 *
 * Quien necesite dejar constancia de una avería lo hace FUERA de la ejecución
 * que responde al cliente — ver `logResetSendFailure` en convex/passwordReset.ts,
 * que es una mutación programada justamente por esto.
 */

/**
 * Remitente único. El dominio está verificado en Resend; cambiarlo aquí lo
 * cambia en los dos correos que manda el CRM.
 */
export const EMAIL_FROM = "SolarCRM <no-reply@geo-pv.com>";

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY en el entorno de Convex.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    // Ver el punto 2 de la cabecera: ni destinatario ni token, nunca.
    throw new Error(`Resend rechazó el envío (HTTP ${response.status}).`);
  }
}
