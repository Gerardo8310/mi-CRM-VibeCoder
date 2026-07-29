"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";

/**
 * Expulsa de la aplicación a quien ya no debería estar dentro (GER-56).
 *
 * ESTO ES INTERFAZ, NO CONTROL DE ACCESO. El control está en el servidor
 * (`requireActiveUserId`, convex/authz.ts), que hace fallar cada lectura y
 * escritura protegida. Este componente solo evita que un usuario desactivado se
 * quede mirando una pantalla vacía o llena de errores.
 *
 * Va montado en `AppShell`, así que cubre las 7 pantallas autenticadas — no
 * solo la raíz, que era el agujero de la primera versión del plan: un usuario
 * desactivado mientras estaba en /clientes no pasaba por src/app/page.tsx y no
 * se enteraba de nada.
 *
 * `signOut()` antes de redirigir es imprescindible: sin eso el middleware ve el
 * token todavía válido, considera /login una ruta pública para un autenticado y
 * devuelve a "/" — bucle infinito.
 */
export function SessionGuard() {
  const viewer = useQuery(api.users.viewer);
  const { signOut } = useAuthActions();
  const router = useRouter();
  // `viewer` puede volver a null en varios renders seguidos mientras se cierra
  // la sesión; sin esto lanzaríamos varios signOut() en paralelo.
  const leaving = useRef(false);

  useEffect(() => {
    if (viewer === undefined) return; // cargando
    if (viewer !== null) return; // sesión válida y activa
    if (leaving.current) return;

    leaving.current = true;
    void signOut().finally(() => router.replace("/login"));
  }, [viewer, signOut, router]);

  return null;
}
