# SolarCRM

CRM simple para un negocio pequeño de ventas digitales — que no se pierda una venta por falta de seguimiento. Ver el PRD completo en Notion ("CRM-PRD") y el plan de trabajo en Linear (proyecto "CRM MVP").

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend y servidor.
- **Tailwind CSS v4** — estilos, con los tokens del Design System en `src/app/globals.css` (`@theme`).
- **Convex** — base de datos y funciones backend en tiempo real (`convex/`).
- **Convex Auth** (`@convex-dev/auth`) — login por correo/contraseña y "Continuar con Google", recuperación por código al correo, roles `vendedor` / `duena`. Ver [Seguridad del login](#seguridad-del-login).
- **Railway** — despliegue del frontend.

## Estructura

```
convex/                  Backend: schema, auth y funciones por entidad
  schema.ts               Las 5 entidades del MVP (Usuario, Cliente, Interacción, Oportunidad, Seguimiento)
  auth.ts / auth.config.ts / http.ts   Configuración de Convex Auth (Password + Google)
  authz.ts                Autoridad de acceso y política de contraseña — ver "Seguridad del login"
  authConstants.ts        Constantes que comparten servidor e interfaz
  email.ts                normalizeEmail: la forma canónica de un correo
  passwordLogin.ts        Entrar y darse de alta (dos proveedores propios)
  passwordReset.ts / ResendOTP.ts      Recuperación por código (dos proveedores propios)
  authCleanup.ts / crons.ts            Barrido periódico de restos de autenticación
  migrations.ts           Migración de un solo uso de correos a forma canónica
  users.ts / clients.ts / interactions.ts / opportunities.ts / followUps.ts

src/
  proxy.ts               El middleware de Next (así se llama desde Next 16). Protege rutas y expone /api/auth
  app/
    layout.tsx             Layout raíz (fuentes IBM Plex, providers)
    page.tsx                Redirección según rol (vendedor -> /hoy, dueña -> /inicio)
    (auth)/login/           Pantalla 0 — Login
    (app)/                  Grupo de rutas autenticadas, envueltas en AppShell
      inicio/                Pantalla 6 — Resumen del negocio (Martha)
      hoy/                   Pantalla 5 — Pendientes del día (Carlos)
      clientes/              Pantalla 1 — Lista con buscador
      clientes/nuevo/        Pantalla 2 — Nuevo cliente
      clientes/[clientId]/   Pantalla 3 — Ficha de cliente (la pantalla central)
      ventas/                Pantalla 4 — Tablero por etapas
      usuarios/              Pantalla 7 — Gestión de usuarios (solo dueña)
      perfil/                Pantalla 8 — Perfil / cerrar sesión
  components/
    ui/                     Componentes base del design system (Button, Input, Badge, Card, Avatar, SidePanel)
    nav/                    Sidebar, TabBar, FAB y AppShell (ver Design/Navegacion.dc.html)
    providers/               ConvexClientProvider

Design/                    Diseño de referencia (.dc.html por pantalla) — fuente de verdad visual
```

Cada pantalla placeholder indica en pantalla qué archivo de `Design/` replicar y qué tarea de Linear la cubre — son el punto de partida para construir cada una a detalle.

## Primeros pasos

1. **Instalar dependencias** (ya hecho si acabas de clonar):
   ```
   npm install
   ```

2. **Conectar Convex** (una sola vez por máquina/entorno):
   ```
   npx convex dev
   ```
   Te pedirá iniciar sesión en convex.dev y crear (o elegir) un proyecto. Esto genera `convex/_generated/` y escribe `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_DEPLOYMENT` en `.env.local` automáticamente. **Déjalo corriendo** en una terminal aparte mientras desarrollas — sincroniza el schema y las funciones en vivo.

3. **Correr la app** (en otra terminal):
   ```
   npm run dev
   ```
   Abre http://localhost:3000. Si la tabla `users` está vacía, la pantalla de login ofrece "¿Primera vez? Crear cuenta": esa primera alta crea a la dueña (Martha) y a partir de ahí el registro queda cerrado — el resto entra por invitación (GER-48). Ver la nota sobre el bootstrap en [Seguridad del login](#seguridad-del-login).

4. **Lint / build**:
   ```
   npm run lint
   npm run build
   ```

## Despliegue

- **Convex (backend):** `npx convex deploy` publica las funciones a producción y te da la URL de producción.
- **Railway (frontend):** conecta este repo de GitHub a un proyecto de Railway. Railway detecta Next.js automáticamente (Nixpacks) usando `railway.json`. Variables de entorno a configurar en Railway: `NEXT_PUBLIC_CONVEX_URL` (la de producción, no la de `convex dev`) y `SITE_URL` (el dominio público que te dé Railway).

## Seguridad del login

Resultado de la auditoría de seguridad del login (GER-56, GER-57, GER-59 y GER-54). Esta sección documenta las reglas que hay que respetar al tocar `convex/auth*`, y los riesgos que se decidieron **aceptar** — están aquí para que nadie los redescubra como si fueran hallazgos nuevos.

### Reglas al escribir código

- **El proxy de Next vive en `src/proxy.ts` y no se mueve ni se renombra.** Es donde `@convex-dev/auth` intercepta `/api/auth`, la ruta por la que pasa toda la autenticación del navegador, y donde se protegen las rutas. Next busca esta convención en la carpeta que contiene `app/` —aquí `src/`—, así que fuera de ahí **`next dev` no lo carga**: `/api/auth` responde 404 y las páginas protegidas devuelven 200 sin sesión. No falla de forma visible; simplemente el login deja de funcionar en local. El gate es la sonda de dos líneas de GER-55: con `npm run dev` levantado, `POST /api/auth` debe dar **400 "Invalid action"** y `GET /clientes` sin sesión debe dar **307 a `/login`**.
- **No llames a `getAuthUserId` fuera de `convex/authz.ts`.** Ese archivo es la única autoridad de acceso del backend: `requireActiveUserId` (lanza) y `getActiveUserId` (devuelve `null`) comprueban además que la ficha siga en `activo`. `getAuthUserId` a secas solo mira el token y deja pasar a un usuario desactivado. El gate es `rg getAuthUserId convex`: no debe haber coincidencias fuera de `authz.ts`.
- **El control de acceso vive en la frontera de datos, no en el login.** `callbacks.beforeSessionCreation` es defensa en profundidad: no cubre las sesiones ya abiertas, porque `refreshSessionImpl` emite tokens nuevos sin volver a llamarlo.
- **La política de contraseña se aplica al crear y al cambiar, nunca al entrar.** Si alguna vez corre en `signIn`, endurecerla deja fuera a quien ya tiene cuenta.
- **Los correos se guardan y se buscan en forma canónica** — `normalizeEmail` (`convex/email.ts`): recorte de espacios y minúsculas, nada más. Sin quitar puntos ni cortar el `+etiqueta` de Gmail: no son universales entre proveedores y convertirían correos distintos en el mismo identificador de acceso.
- **Constantes compartidas con la interfaz** en `convex/authConstants.ts`. No las dupliques en `src/`.
- **Nunca escribas por consola dentro de una acción de auth**, y menos en una rama que solo se ejecuta cuando la cuenta existe. La respuesta de `POST /api/action` incluye un campo `logLines` con lo que la ejecución haya escrito, así que un `console.error` en línea vuelve a distinguir cuenta existente de inexistente por el cuerpo. Si hace falta dejar constancia, prográmalo en otra ejecución — el patrón es `logResetSendFailure` en `convex/passwordReset.ts`.
- **La redacción de errores de producción NO es una garantía del código.** En el deployment de producción Convex redacta el mensaje de cualquier `throw new Error(...)` —el cuerpo sale como `{"errorMessage":"Server Error"}`, sin texto— y **no devuelve `logLines`**; en dev manda las dos cosas. Medido en GER-54 lanzando la misma llamada contra los dos deployments. Eso enmascara en producción los canales de fuga basados en el **contenido** del mensaje, pero no los basados en la **forma** de la respuesta —error frente a `{"tokens": null}`—, que son los que de verdad había que cerrar. Al medir un canal, hazlo **contra los dos deployments** y di de cuál hablas: un hallazgo de dev no es automáticamente explotable en producción, y una respuesta redactada no es automáticamente segura.
- **Nunca pongas `AUTH_LOG_LEVEL=DEBUG` en producción.** Con ese nivel, `createVerificationCodeImpl` escribe en los logs del deployment el **código de recuperación en claro** junto al correo. Comprobado en dev: no llega a `logLines` de la respuesta —esas líneas las emite la mutación `auth:store`, otra ejecución— así que no es un canal remoto, pero sí deja secretos vivos en el registro. La variable no está definida en ningún deployment; el valor por defecto de la librería es `INFO`, que calla las líneas DEBUG.
- **Nunca llames a `signIn("password", …)` desde la interfaz.** El proveedor `Password` de la librería no atiende ningún flujo: su `profile()` rechaza todo. Sigue registrado solo porque es el titular del identificador de cuenta `"password"` y de su `crypto` (Scrypt), que resuelven `retrieveAccount`, `createAccount` y `modifyAccountCredentials` por nombre de proveedor. El gate es enumerar las llamadas a `signIn(` en `src/`: deben ser exactamente cinco, y ninguna a `"password"` seco.

### Entrar y darse de alta

Dos proveedores propios en `convex/passwordLogin.ts`:

- `password-signin` — entrar. Hace **dos** lecturas de la cuenta y el orden importa: la primera sin `secret`, que solo comprueba que la cuenta existe y su ficha sigue en `activo`; la segunda con `secret`, que verifica y consume el límite de intentos. Comprobar el estado *después* de verificar dejaría un oráculo por el estado del contador, porque acertar el secreto **borra** la fila de `authRateLimits` y eso se puede observar.
- `password-signup` — el alta. Comprueba el registro cerrado **antes** de mirar `authAccounts`, así que en producción tiene una sola respuesta posible. No es la autoridad de unicidad: esa sigue siendo el guard de `callbacks.createOrUpdateUser`, que corre dentro de la transacción.

Los cuatro flujos de contraseña —entrar, alta, pedir código, canjearlo— viven en proveedores propios por el mismo motivo: la librería relanza sus strings internos (`"InvalidAccountId"`, `"InvalidSecret"`, `"TooManyFailedAttempts"`, `"Account … already exists"`) al cuerpo de la respuesta HTTP, y desde ahí se enumera quién tiene cuenta.

### Política de contraseña (`convex/authz.ts`)

- Mínimo **10 caracteres**.
- No puede estar en la lista corta de contraseñas obvias.
- No puede contener la parte local del correo… **salvo si esa parte local tiene menos de 4 caracteres** (`MIN_LOCAL_PART_FOR_PASSWORD_CHECK`). Es una excepción deliberada, no un descuido: con `ana@` o `jl@` la coincidencia ocurre por azar y la regla rechazaría contraseñas perfectamente buenas.

### Recuperación de contraseña

Dos proveedores propios en `convex/passwordReset.ts`, ninguno de la librería:

- `password-reset-request` — pide el código. Comprueba que la cuenta existe y está `activo` **antes** de consumir el límite, y ese límite (5/hora, 60 s de espera entre peticiones) es la primera sentencia con efecto: sin él, pedir un código destruye el anterior y cualquiera podría dejar a un usuario sin poder recuperar su cuenta. Si el envío falla, la excepción **se captura**: propagarla distinguía cuenta existente de inexistente cada vez que Resend tuviera una avería.
- `password-reset-verify` — canjea el código. Existe porque la librería indexa el límite de intentos por el correo **tal cual lo manda el cliente**: sin canonizarlo antes, cada variante de caja estrenaría su propio cupo de 10 intentos. Comprueba el estado de la ficha **antes** de canjear, y ese orden es deliberado: así el código de un usuario desactivado no se gasta, y la respuesta no distingue el código correcto del incorrecto.

El código es de **12 caracteres** de un alfabeto de **32 símbolos** —los dígitos y las letras menos `I`, `L`, `O` y `U`— y caduca a los 15 minutos. Viaja agrupado en el correo (`K7M4-9XQP-3JRT`), pero los guiones son presentación: `normalizeResetCode` los quita, pasa a mayúsculas y traduce `O→0` e `I`/`L`→`1` antes de que el código llegue a la librería.

Tres cosas de ese diseño **no** son negociables (GER-58):

- **La longitud y el alfabeto son el control de seguridad**, no un detalle de formato. Ver la sección de riesgos aceptados: existe una ruta sin límite de intentos, y lo único que la hace impracticable son los 2⁶⁰ candidatos.
- **32 símbolos exactos, no 31 ni 33.** 256 es múltiplo de 32, así que `byte % 32` no tiene sesgo de módulo y el generador no necesita descartar bytes. Cambiar el tamaño del alfabeto obliga a reintroducir un bucle de rechazo; si no, el código pierde entropía en silencio.
- **La normalización es autoridad del servidor.** La interfaz formatea al escribir por comodidad, pero `password-reset-verify` vuelve a canonizar lo que le llegue. No mover esa regla al cliente.

### Duraciones

| Qué | Valor | Dónde |
|---|---|---|
| Sesión, duración total | 30 días | `session.totalDurationMs` |
| Sesión, inactividad | 7 días | `session.inactiveDurationMs` |
| JWT | 15 minutos | `jwt.durationMs` |

Los 15 minutos del JWT acotan la ventana en que un token ya emitido sigue siendo válido después de revocar su sesión: `ctx.auth.getUserIdentity()` solo verifica la firma. No es el control de acceso — lo es `requireActiveUserId`, que deniega en la siguiente llamada.

### Riesgos aceptados

Decisiones tomadas a conciencia. No son tareas pendientes.

- **Registro de arranque abierto.** Si la tabla `users` queda vacía, la primera persona que use "Crear cuenta" se convierte en dueña. Se deja así porque es la única forma de arrancar el sistema desde cero.
- **Bloqueo remoto de una cuenta.** Los límites son por correo y no hay límite por IP: quien conozca un correo puede agotarlos a propósito (10 fallos de login/hora, 10 códigos fallidos/hora, 5 solicitudes/hora) y dejar a esa persona sin entrar durante un rato. Cerrarlo exige un captcha, que se descartó para el MVP.
- **`authVerifiers` puede crecer bajo ataque.** Cualquiera puede iniciar un consentimiento de Google y abandonarlo. El cron de `convex/authCleanup.ts` barre por índice en lotes acotados, lo que mejora la capacidad de drenaje pero no la garantiza. Vigilar sus contadores.
- **Enumeración por temporización.** Es lo que **queda abierto** después de GER-54, que cerró el canal por el **cuerpo** de la respuesta. La invariante que hoy se cumple es esta, y conviene enunciarla con precisión porque es más estrecha de lo que parece: **ante un fallo**, la respuesta no revela la existencia de la cuenta, ni si el secreto era correcto en una cuenta desactivada, ni el estado de Resend. No dice que todas las respuestas sean iguales — un secreto correcto de un usuario activo devuelve tokens, obviamente, y unos parámetros inválidos pueden devolver un error de política. Lo que el **tiempo** sigue delatando: al entrar se responde antes de calcular Scrypt si la cuenta no existe, y en recuperación solo la rama con cuenta llama a Resend. **Recomendación explícita de la auditoría: no arreglarlo.** Exigiría un hash señuelo, y sacar el envío del correo fuera de la petición no es viable porque `signInViaProvider` depende de `ctx.auth.config`, que no existe en una acción programada.
- **Enumeración por Google.** Un correo sin usuario provisionado recibe "Esta cuenta de Google no está autorizada", que es distinguible. No sirve para sondear correos ajenos: hay que completar el consentimiento de Google con ese buzón, es decir, controlarlo.
- **El oráculo de canje sin proveedor sigue existiendo.** `auth:signIn` acepta que la llamen sin `provider` y solo con `params.code`; ahí la librería no aplica ningún límite de intentos —el identificador es `params.email ?? params.phone`, que en esa forma de llamada es `undefined`— y el código correcto se distingue del incorrecto por la forma de la respuesta. **No se puede cerrar desde nuestro código** (`auth:signIn` es la acción pública de la librería; envolverla dejaría la original expuesta, y registrar `resend-otp` como proveedor principal permitiría pedir códigos saltándose el límite de solicitudes). Lo que hizo GER-58 fue quitarle utilidad: con 2⁶⁰ candidatos, mil intentos por segundo tienen ~8×10⁻¹³ de acertar durante los 15 minutos de vigencia. **Si alguna versión futura de `@convex-dev/auth` cambia `signInImpl` o `verifyCodeAndSignInImpl`, hay que revisar esta mitigación** — y si algún día la librería acepta cerrar la rama, el arreglo de verdad está ahí, no aquí.

### Gestión de usuarios (GER-48)

- **La autoridad es `requireOwnerId`** (`convex/authz.ts`), no la pantalla. `users:list`, `users:updateRole` y `users:setStatus` lanzan para quien no sea dueña activa. Que la navegación esconda "Usuarios" y que la pantalla redirija son comodidades de interfaz.
- **Nadie se edita a sí misma.** Es lo que garantiza, sin contar nada, que **nunca quede el CRM sin ninguna dueña activa**: quien ejecuta esas mutaciones ya es una dueña activa, y si no puede tocar su propia ficha lo sigue siendo al terminar. Por eso no hay ninguna comprobación de "queda al menos una dueña": sería código inalcanzable.
- **Desactivar revoca sesiones, refresh tokens y códigos emitidos.** `users:setStatus` a `inactivo` borra las `authSessions` del usuario con todos sus `authRefreshTokens` —replicando `deleteSession` de la librería— y los `authVerificationCodes` de sus cuentas. Sin refresh token no hay renovación, así que el JWT ya emitido caduca solo en 15 minutos. **No promete revocar operaciones en vuelo**: una solicitud de código que ya hubiera pasado su comprobación de estado puede crear el código después del borrado, porque son transacciones distintas. Es inofensivo —`password-reset-verify` comprueba el estado antes de consumirlo— y caduca en 15 minutos.

## Decisiones de alcance confirmadas (ver PRD en Notion)

- **Invitación de usuarios por correo** (no contraseña temporal) — requiere un proveedor de correo transaccional, todavía sin elegir (ver `.env.example`).
- **"Inicio" con 5 bloques** (no solo 3 números): clientes nuevos, ventas del mes, pendientes, pipeline abierto y actividad reciente.

## Fuente de verdad

- **Diseño pixel a pixel:** carpeta `Design/` (`.dc.html` por pantalla + `design.md` con tokens).
- **Alcance y datos:** página "CRM-PRD" en Notion.
- **Plan de trabajo y criterios de aceptación:** proyecto "CRM MVP" en Linear (cada tarea enlaza su archivo de diseño exacto).
