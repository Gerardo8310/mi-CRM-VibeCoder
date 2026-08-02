/**
 * Constantes de la ficha de usuario que el servidor y la interfaz comparten
 * (GER-49).
 *
 * Mismo mecanismo y mismo motivo que `convex/authConstants.ts`: **este módulo no
 * importa nada**, así que el cliente puede traérselo por el alias `@convex/*` de
 * `tsconfig.json` sin arrastrar `@convex-dev/auth` al bundle del navegador.
 *
 * Va aparte de `authConstants.ts` porque no es una regla de autenticación: no
 * decide quién entra ni qué contraseña se acepta. Mezclarlas haría que el
 * archivo dejara de significar lo que su nombre promete.
 */

/**
 * Tope de caracteres del nombre de una persona.
 *
 * Es una guarda defensiva, no una regla de negocio: el modelo no exige unicidad
 * ni formato, y aquí no se inventa ninguno. Lo único que evita es que una pegada
 * accidental deje un nombre que rompa la maqueta en todas las pantallas donde
 * aparece — la barra lateral, los avatares, las listas de seguimientos.
 *
 * Lo comparten `users.updateName` (convex/users.ts), que es la autoridad, y el
 * `maxLength` del campo en "Mi cuenta". Sin compartirlo, la interfaz permitiría
 * escribir algo que el servidor rechazaría con un error que en producción llega
 * redactado como "Server Error".
 */
export const MAX_NAME_LENGTH = 80;
