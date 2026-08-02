"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Check } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/nav/page-header";
import { MiPerfilCard } from "@/components/perfil/mi-perfil-card";
import { ContrasenaCard } from "@/components/perfil/contrasena-card";
import { SesionCard } from "@/components/perfil/sesion-card";

/**
 * Pantalla 8 — "Mi cuenta" (GER-49). Ver Design/PerfilUsuario.dc.html.
 *
 * Es la única pantalla del CRM que no distingue roles: la ve igual un vendedor
 * que la dueña, porque todo lo que hay dentro es de quien la mira. El control de
 * acceso lo lleva cada función de `convex/`, que trabaja siempre sobre el
 * usuario de la sesión y nunca sobre un identificador que llegue del navegador.
 *
 * El aviso de éxito vive aquí y no dentro de la tarjeta de contraseña porque la
 * maqueta lo pone arriba del todo, por encima de las tres tarjetas.
 */
export default function PerfilPage() {
  const viewer = useQuery(api.users.viewer);
  const [exito, setExito] = useState(false);

  if (viewer === undefined) {
    return (
      <>
        <PageHeader title="Mi cuenta" />
        <Skeleton />
      </>
    );
  }

  // `viewer === null` lo resuelve SessionGuard, que cierra sesión y va a /login.
  if (viewer === null) return <PageHeader title="Mi cuenta" />;

  return (
    <>
      <PageHeader title="Mi cuenta" />
      <div className="mx-auto w-full max-w-150 px-4 pb-24 pt-6 lg:px-6 lg:pb-15 lg:pt-8">
        {exito && (
          <div className="mb-4 flex animate-[fadein_250ms_ease] items-center gap-2.5 border border-success-500/25 bg-success-100 px-4 py-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-500">
              <Check className="size-3.25 text-white" />
            </span>
            <span className="text-[13px] font-medium text-success-700">
              Contraseña actualizada correctamente.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <MiPerfilCard
            nombre={viewer.name}
            correo={viewer.email}
            rol={viewer.role}
          />
          <ContrasenaCard onExito={setExito} />
          <SesionCard nombre={viewer.name} correo={viewer.email} />
        </div>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-150 px-4 pb-24 pt-6 lg:px-6 lg:pt-8">
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-52 animate-pulse border border-neutral-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
