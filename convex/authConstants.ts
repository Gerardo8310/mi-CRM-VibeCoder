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
 * Caracteres del código de recuperación.
 *
 * Doce, y alfanuméricos, por el oráculo de canje sin proveedor de GER-58: hay
 * una ruta donde el límite de intentos no se aplica, y no se puede cerrar desde
 * nuestro código, así que **la entropía del código es la única barrera real**.
 * Con el alfabeto de 32 símbolos de convex/ResendOTP.ts son 32¹² = 2⁶⁰ ≈ 10¹⁸
 * candidatos: a mil intentos por segundo, la probabilidad de acertar uno
 * durante sus 15 minutos de vigencia es de ~8×10⁻¹³.
 *
 * Antes eran ocho dígitos (10⁸), que a ese mismo ritmo caían en unas 28 horas.
 *
 * Doce es margen deliberado, no cálculo justo: con ocho caracteres del mismo
 * alfabeto ya bastaría (2⁴⁰), pero cuatro más no le cuestan nada al usuario y
 * quitan la discusión sobre el margen.
 */
export const CODE_LENGTH = 12;

/**
 * Tamaño de los grupos con los que se MUESTRA el código: `K7M4-9XQP-3JRT`.
 *
 * Es presentación y nada más. El token que se guarda y se compara no lleva
 * separadores nunca — los quita `normalizeResetCode` (convex/ResendOTP.ts).
 */
export const CODE_GROUP_SIZE = 4;

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
