/**
 * Constantes de autenticación que el servidor y la interfaz tienen que compartir
 * (GER-59 · sugerencia de la auditoría de código de GER-57).
 *
 * Antes vivían duplicadas —una copia en `convex/` y otra en
 * `src/app/(auth)/login/page.tsx`— sincronizadas solo por un comentario que
 * pedía cambiar las dos a la vez. El auditor lo marcó como riesgo de
 * divergencia: nada obligaba a cumplirlo, y divergir significa que la interfaz
 * promete una regla y el servidor aplica otra.
 *
 * Este módulo no importa nada. Es deliberado: al no arrastrar dependencias de
 * servidor, el cliente puede importarlo por el alias `@convex/*` de
 * `tsconfig.json` sin llevarse `@convex-dev/auth` al bundle del navegador.
 */

/**
 * Dígitos del código de recuperación.
 *
 * Ocho y no seis por el oráculo de canje sin proveedor que documenta GER-58:
 * existe una ruta donde el límite de intentos no se aplica, así que la longitud
 * del código es la única barrera real. Ver la cabecera de convex/ResendOTP.ts.
 */
export const CODE_LENGTH = 8;

/** Longitud mínima de una contraseña. Ver la política en convex/authz.ts. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Por debajo de esta longitud, la parte local del correo NO se compara contra
 * la contraseña.
 *
 * Es una excepción explícita a la regla "la contraseña no puede contener tu
 * correo", no un descuido: con una parte local de dos o tres caracteres —`ana@`,
 * `jl@`— la coincidencia ocurre por azar en contraseñas perfectamente buenas, y
 * la regla rechazaría más de lo que protege. El auditor pidió que constara como
 * política y no solo como comentario suelto (GER-57, severidad Media).
 */
export const MIN_LOCAL_PART_FOR_PASSWORD_CHECK = 4;
