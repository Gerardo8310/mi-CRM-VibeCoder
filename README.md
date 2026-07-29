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
  passwordReset.ts / ResendOTP.ts      Recuperación por código (dos proveedores propios)
  authCleanup.ts / crons.ts            Barrido periódico de restos de autenticación
  migrations.ts           Migración de un solo uso de correos a forma canónica
  users.ts / clients.ts / interactions.ts / opportunities.ts / followUps.ts

src/
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
    ui/                     Componentes base del design system (Button, Input, Badge, Card, Avatar)
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

Resultado de la auditoría de seguridad del login (GER-56, GER-57 y GER-59). Esta sección documenta las reglas que hay que respetar al tocar `convex/auth*`, y los riesgos que se decidieron **aceptar** — están aquí para que nadie los redescubra como si fueran hallazgos nuevos.

### Reglas al escribir código

- **No llames a `getAuthUserId` fuera de `convex/authz.ts`.** Ese archivo es la única autoridad de acceso del backend: `requireActiveUserId` (lanza) y `getActiveUserId` (devuelve `null`) comprueban además que la ficha siga en `activo`. `getAuthUserId` a secas solo mira el token y deja pasar a un usuario desactivado. El gate es `rg getAuthUserId convex`: no debe haber coincidencias fuera de `authz.ts`.
- **El control de acceso vive en la frontera de datos, no en el login.** `callbacks.beforeSessionCreation` es defensa en profundidad: no cubre las sesiones ya abiertas, porque `refreshSessionImpl` emite tokens nuevos sin volver a llamarlo.
- **La política de contraseña se aplica al crear y al cambiar, nunca al entrar.** Si alguna vez corre en `signIn`, endurecerla deja fuera a quien ya tiene cuenta.
- **Los correos se guardan y se buscan en forma canónica** — `normalizeEmail` (`convex/email.ts`): recorte de espacios y minúsculas, nada más. Sin quitar puntos ni cortar el `+etiqueta` de Gmail: no son universales entre proveedores y convertirían correos distintos en el mismo identificador de acceso.
- **Constantes compartidas con la interfaz** en `convex/authConstants.ts`. No las dupliques en `src/`.

### Política de contraseña (`convex/authz.ts`)

- Mínimo **10 caracteres**.
- No puede estar en la lista corta de contraseñas obvias.
- No puede contener la parte local del correo… **salvo si esa parte local tiene menos de 4 caracteres** (`MIN_LOCAL_PART_FOR_PASSWORD_CHECK`). Es una excepción deliberada, no un descuido: con `ana@` o `jl@` la coincidencia ocurre por azar y la regla rechazaría contraseñas perfectamente buenas.

### Recuperación de contraseña

Dos proveedores propios en `convex/passwordReset.ts`, ninguno de la librería:

- `password-reset-request` — pide el código. Comprueba que la cuenta existe **antes** de consumir el límite, y ese límite (5/hora, 60 s de espera entre peticiones) es la primera sentencia con efecto: sin él, pedir un código destruye el anterior y cualquiera podría dejar a un usuario sin poder recuperar su cuenta.
- `password-reset-verify` — canjea el código. Existe porque la librería indexa el límite de intentos por el correo **tal cual lo manda el cliente**: sin canonizarlo antes, cada variante de caja estrenaría su propio cupo de 10 intentos.

El código es de **8 dígitos** y caduca a los 15 minutos.

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
- **Enumeración por temporización.** Al entrar se responde antes de calcular Scrypt si la cuenta no existe, y en recuperación solo la rama con cuenta llama a Resend. **Recomendación explícita: no arreglarlo.** Exigiría reimplementar `Password` sobre `ConvexCredentials` con un hash señuelo, y sacar el envío del correo fuera de la petición no es viable porque `signInViaProvider` depende de `ctx.auth.config`, que no existe en una acción programada.

### Deuda con issue asignada

- **GER-58 · crítico** — `auth:signIn` acepta que la llamen sin `provider` y solo con `params.code`; en esa ruta la librería no aplica ningún límite de intentos, y las respuestas de código correcto e incorrecto se distinguen. Los 8 dígitos lo encarecen cien veces pero **no lo cierran**.
- **GER-48** — al desactivar a alguien, sus sesiones y refresh tokens no se borran físicamente. No da acceso (`requireActiveUserId` deniega), pero conviene revocarlos.

## Decisiones de alcance confirmadas (ver PRD en Notion)

- **Invitación de usuarios por correo** (no contraseña temporal) — requiere un proveedor de correo transaccional, todavía sin elegir (ver `.env.example`).
- **"Inicio" con 5 bloques** (no solo 3 números): clientes nuevos, ventas del mes, pendientes, pipeline abierto y actividad reciente.

## Fuente de verdad

- **Diseño pixel a pixel:** carpeta `Design/` (`.dc.html` por pantalla + `design.md` con tokens).
- **Alcance y datos:** página "CRM-PRD" en Notion.
- **Plan de trabajo y criterios de aceptación:** proyecto "CRM MVP" en Linear (cada tarea enlaza su archivo de diseño exacto).
