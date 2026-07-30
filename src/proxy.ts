/**
 * El "proxy" de Next.js — lo que hasta Next 15 se llamaba middleware.
 *
 * Dos cosas del nombre y de la ubicación NO son decorativas (GER-55):
 *
 * 1. **Tiene que estar dentro de `src/`.** Next busca esta convención en la
 *    carpeta que contiene `app/`, así que en este proyecto es `src/`, no la
 *    raíz. Estuvo en la raíz hasta GER-55 y `next dev` sencillamente no lo
 *    cargaba: `/api/auth` daba 404 y las rutas protegidas respondían 200 sin
 *    sesión. El build sí lo recogía, y por eso producción nunca se enteró.
 *
 * 2. **Se llama `proxy.ts`, no `middleware.ts`.** Next 16 renombró la
 *    convención; con el nombre viejo avisa de que está obsoleta. Tener los dos
 *    archivos a la vez es un error de compilación, así que la migración es un
 *    renombrado, nunca una copia.
 *
 * Aquí es además donde `@convex-dev/auth` intercepta `/api/auth`: es la ruta
 * por la que pasa TODA la autenticación del navegador. Si este archivo no se
 * carga, no falla de forma visible — el login se limita a no funcionar.
 */
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Únicas rutas públicas del MVP: login y la creación de contraseña
// desde un enlace de invitación (ver GER-48).
const isPublicRoute = createRouteMatcher(["/login", "/invitacion/(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  if (!isPublicRoute(request) && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isPublicRoute(request) && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  // Corre en todas las rutas salvo assets estáticos internos de Next.js.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
