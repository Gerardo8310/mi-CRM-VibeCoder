/**
 * Forma canónica de un correo (GER-54 · auditoría de seguridad del login).
 *
 * Existe como módulo propio por una razón concreta: la migración de datos
 * (convex/migrations.ts) y el código que normaliza en tiempo de ejecución tienen
 * que aplicar EXACTAMENTE la misma transformación. Si divergieran, las cuentas
 * migradas dejarían de encontrarse al iniciar sesión.
 *
 * Solo minúsculas y recorte de espacios. Nada de "normalizaciones" más listas
 * —quitar puntos, cortar el `+etiqueta` de Gmail— porque no son universales
 * entre proveedores y convertirían correos distintos en el mismo identificador
 * de acceso.
 *
 * NOTA: en el Issue 1 (GER-56) esto solo lo usa la migración, que todavía no
 * corre. El cableado en auth.ts / passwordReset.ts / ResendOTP.ts entra en el
 * Issue 2, después de ejecutar el dry-run en producción.
 *
 * Este módulo NO IMPORTA NADA, y eso no es casualidad: gracias a ello la interfaz
 * puede traerse estas dos funciones por el alias `@convex/*` sin arrastrar
 * `@convex-dev/auth` al bundle del navegador, igual que convex/authConstants.ts.
 * Si algún día necesita un import de servidor, deja de ser compartible.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * ¿Esto tiene forma de correo? (GER-48, rama 2.)
 *
 * **Deliberadamente pobre, y eso es la decisión, no un atajo.** Validar correos
 * con precisión es imposible en la práctica: las expresiones que lo intentan
 * acaban rechazando direcciones perfectamente válidas, y la única prueba real de
 * que una dirección existe es mandarle algo. La autoridad de entregabilidad es
 * Resend, no esto.
 *
 * Lo que sí cierra es el caso tonto: `invitations.invite` solo comprobaba que el
 * correo no estuviera vacío, y el campo del panel, al no estar dentro de un
 * `<form>`, nunca dispara la validación del navegador. Con eso, un dedo torcido
 * creaba una ficha con una cadena sin arroba: **una persona que no puede entrar
 * nunca y que el MVP tampoco permite borrar**, porque solo sabe desactivar.
 * Encontrado al provocar a propósito el fallo de envío.
 *
 * Exige una arroba, algo a cada lado, ningún espacio ni carácter de control, y
 * un punto interior en el dominio. Un dominio sin punto —`ana@localhost`— es
 * legítimo en una red interna, pero no en un CRM cuyo correo sale por internet.
 *
 * Los espacios interiores hay que mirarlos aparte porque `normalizeEmail` solo
 * recorta los extremos: sin esa comprobación `ana @empresa.com` pasaba entero y
 * creaba la misma ficha inservible que motivó esta función (auditoría N12).
 */
export function looksLikeEmail(normalized: string): boolean {
  // Dos comprobaciones y no una expresión con escapes: un carácter de control
  // literal en el fuente es invisible en cualquier editor y no sobrevive a un
  // copiar y pegar. Escrito así se lee y se mantiene.
  //
  // El guion NO se descarta: `no-reply@geo-pv.com` es perfectamente válido.
  if (/\s/.test(normalized)) return false; // espacios de cualquier tipo, NBSP incluido
  for (const char of normalized) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false; // controles y DEL
  }

  const partes = normalized.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  if (local.length === 0) return false;
  const punto = dominio.indexOf(".");
  return punto > 0 && punto < dominio.length - 1;
}
