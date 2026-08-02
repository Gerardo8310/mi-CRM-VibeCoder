import { ReactNode } from "react";
import { ProfileAvatarButton } from "@/components/nav/profile-avatar-button";

export function PageHeader({
  title,
  meta,
  action,
}: {
  title: string;
  /** Contenido junto al título (p. ej. fecha + conteo en "Hoy"). */
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 lg:h-14 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate font-mono text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          {title}
        </h1>
        {meta}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {action}
        {/*
          El acceso a "Mi cuenta" en móvil (GER-49). Va aquí, en la cabecera
          compartida, y no en cada pantalla, porque hasta ahora no había NINGUNA
          puerta al perfil por debajo de 1024 px — ver la cabecera de
          `profile-avatar-button.tsx`. Se coloca después de `action` para que el
          botón principal de cada pantalla ("Nuevo cliente", "Invitar usuario")
          siga siendo lo primero que se encuentra desde el título.
        */}
        <ProfileAvatarButton />
      </div>
    </header>
  );
}
