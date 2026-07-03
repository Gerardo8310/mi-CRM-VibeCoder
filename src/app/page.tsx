"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * Landing raíz. No tiene UI propia: solo decide a dónde mandar a cada rol.
 * Vendedor -> /hoy · Dueña -> /inicio (ver PRD, sección Navegación).
 * El middleware ya garantiza que solo llega aquí un usuario autenticado.
 */
export default function RootRedirect() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);

  useEffect(() => {
    if (viewer === undefined) return; // cargando
    if (viewer === null) {
      router.replace("/login");
      return;
    }
    router.replace(viewer.role === "duena" ? "/inicio" : "/hoy");
  }, [viewer, router]);

  return null;
}
