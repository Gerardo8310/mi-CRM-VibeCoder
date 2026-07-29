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
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
