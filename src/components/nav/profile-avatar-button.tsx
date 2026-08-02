"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/ui/avatar";

/**
 * Acceso a "Mi cuenta" desde la cabecera, **solo en móvil** (GER-49).
 *
 * POR QUÉ EXISTE: hasta este issue, en pantallas estrechas no había forma de
 * llegar al perfil ni de cerrar sesión. La barra inferior
 * (`components/nav/tab-bar.tsx`) solo lleva los cuatro accesos principales, y la
 * barra lateral, que es donde vivían "Perfil" y "Cerrar sesión", está oculta por
 * debajo de 1024 px (`hidden … lg:flex` en `sidebar.tsx`). Es decir: **un
 * vendedor con un móvil no podía cambiar su contraseña ni salir**, que es
 * justamente para quien se hizo esta pantalla.
 *
 * `lg:hidden` porque en escritorio la barra lateral ya lo ofrece; duplicarlo
 * ahí solo añadiría un segundo camino al mismo sitio.
 *
 * No lo dibujó ninguna maqueta —`Design/Navegacion.dc.html` solo diseñó el
 * acceso de escritorio—, así que esto es una decisión de construcción, tomada
 * con Gerardo, y no una desviación de un diseño existente.
 */
export function ProfileAvatarButton() {
  const viewer = useQuery(api.users.viewer);

  // Mientras carga o si no hay sesión utilizable no se pinta nada: un avatar con
  // iniciales inventadas parpadeando en cada carga es peor que un hueco.
  if (!viewer) return null;

  return (
    <Link
      href="/perfil"
      aria-label="Mi cuenta"
      className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
    >
      <Avatar name={viewer.name} size="sm" />
    </Link>
  );
}
