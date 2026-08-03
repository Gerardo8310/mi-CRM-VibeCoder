import Link from "next/link";
import { ChevronRight, Shield } from "lucide-react";

/**
 * La puerta a "Gestión de usuarios" desde el móvil (GER-60).
 *
 * POR QUÉ EXISTE: hasta este issue, `/usuarios` **no se podía alcanzar desde un
 * teléfono**. La barra inferior (`nav/tab-bar.tsx`) solo lleva los cuatro
 * accesos principales, y el enlace a Usuarios vive en la barra lateral, que está
 * oculta por debajo de 1024 px. Es decir: la dueña con un móvil solo llegaba
 * escribiendo la URL. Es el mismo hueco que GER-49 cerró para "Mi perfil".
 *
 * `lg:hidden` porque en escritorio la barra lateral ya lo ofrece; duplicarlo
 * ahí sería un segundo camino al mismo sitio, que es justo lo que rechaza
 * `nav/profile-avatar-button.tsx`.
 *
 * **ESTO NO ES UN CONTROL DE ACCESO.** Quien decide si se pinta es la pantalla
 * (`app/(app)/perfil/page.tsx`), y es una condición de interfaz, no un permiso.
 * A `/usuarios` la protegen otras tres cosas, que no cambian: la propia pantalla
 * rebota a `/` a quien no es dueña, y en el servidor **`requireOwnerId`**
 * (convex/authz.ts) autoriza `users.list`, `users.updateRole`, `users.setStatus`
 * y —a través de sus funciones internas— `invitations.invite` e
 * `invitations.resendInvitation`. Si alguien borrara la condición de esta fila,
 * se vería un enlace de más y nada más: el sistema seguiría igual de cerrado.
 *
 * No lo dibujó ninguna maqueta: `Design/Navegacion.dc.html` nunca diseñó cómo
 * llegar aquí desde el móvil, aunque `Design/GestionUsuarios.dc.html` sí trae el
 * layout móvil de la pantalla de destino. Es una decisión de construcción,
 * tomada con Gerardo, y no una desviación de un diseño existente.
 */
export function GestionUsuariosLink() {
  return (
    <Link
      href="/usuarios"
      className="flex items-center gap-3 border border-neutral-200 bg-white px-5 py-4 shadow-xs transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:hidden"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Shield className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-xs font-bold tracking-[-0.01em] text-neutral-950">
          Gestión de usuarios
        </span>
        <span className="block text-xs text-neutral-400">
          Invita y administra a tu equipo
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-neutral-400" />
    </Link>
  );
}
