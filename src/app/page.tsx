"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";

/**
 * Landing raíz. No tiene UI propia: solo decide a dónde mandar a cada rol.
 * Vendedor -> /hoy · Dueña -> /inicio (ver PRD, sección Navegación).
 * El middleware ya garantiza que solo llega aquí un usuario autenticado.
 */
export default function RootRedirect() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  const { signOut } = useAuthActions();
  const leaving = useRef(false);

  useEffect(() => {
    if (viewer === undefined) return; // cargando
    if (viewer === null) {
      // Token válido pero sin usuario utilizable: sesión huérfana o cuenta
      // desactivada (GER-56). Hay que cerrar sesión ANTES de redirigir; si no,
      // el middleware ve el token vivo, trata /login como ruta pública para un
      // autenticado y devuelve aquí — bucle infinito.
      if (leaving.current) return;
      leaving.current = true;
      void signOut().finally(() => router.replace("/login"));
      return;
    }
    router.replace(viewer.role === "duena" ? "/inicio" : "/hoy");
  }, [viewer, router, signOut]);

  return null;
}
