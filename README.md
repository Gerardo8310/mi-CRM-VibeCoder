# SolarCRM

CRM simple para un negocio pequeño de ventas digitales — que no se pierda una venta por falta de seguimiento. Ver el PRD completo en Notion ("CRM-PRD") y el plan de trabajo en Linear (proyecto "CRM MVP").

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend y servidor.
- **Tailwind CSS v4** — estilos, con los tokens del Design System en `src/app/globals.css` (`@theme`).
- **Convex** — base de datos y funciones backend en tiempo real (`convex/`).
- **Convex Auth** (`@convex-dev/auth`) — login por correo/contraseña, roles `vendedor` / `duena`.
- **Railway** — despliegue del frontend.

## Estructura

```
convex/                  Backend: schema, auth y funciones por entidad
  schema.ts               Las 5 entidades del MVP (Usuario, Cliente, Interacción, Oportunidad, Seguimiento)
  auth.ts / auth.config.ts / http.ts   Configuración de Convex Auth (Password)
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
   Abre http://localhost:3000. Como todavía no hay usuarios creados, necesitas dar de alta el primer usuario (Martha, rol `duena`) directamente desde el dashboard de Convex (tabla `users`) o con una mutación temporal — la pantalla de invitación (GER-48) todavía no está construida.

4. **Lint / build**:
   ```
   npm run lint
   npm run build
   ```

## Despliegue

- **Convex (backend):** `npx convex deploy` publica las funciones a producción y te da la URL de producción.
- **Railway (frontend):** conecta este repo de GitHub a un proyecto de Railway. Railway detecta Next.js automáticamente (Nixpacks) usando `railway.json`. Variables de entorno a configurar en Railway: `NEXT_PUBLIC_CONVEX_URL` (la de producción, no la de `convex dev`) y `SITE_URL` (el dominio público que te dé Railway).

## Decisiones de alcance confirmadas (ver PRD en Notion)

- **Invitación de usuarios por correo** (no contraseña temporal) — requiere un proveedor de correo transaccional, todavía sin elegir (ver `.env.example`).
- **"Inicio" con 5 bloques** (no solo 3 números): clientes nuevos, ventas del mes, pendientes, pipeline abierto y actividad reciente.

## Fuente de verdad

- **Diseño pixel a pixel:** carpeta `Design/` (`.dc.html` por pantalla + `design.md` con tokens).
- **Alcance y datos:** página "CRM-PRD" en Notion.
- **Plan de trabajo y criterios de aceptación:** proyecto "CRM MVP" en Linear (cada tarea enlaza su archivo de diseño exacto).
