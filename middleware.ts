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
