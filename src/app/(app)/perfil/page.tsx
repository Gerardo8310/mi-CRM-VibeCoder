"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Check } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/nav/page-header";
import { MiPerfilCard } from "@/components/perfil/mi-perfil-card";
import { ContrasenaCard } from "@/components/perfil/contrasena-card";
import { SesionCard } from "@/components/perfil/sesion-card";
import { GestionUsuariosLink } from "@/components/perfil/gestion-usuarios-link";

/**
 * Pantalla 8 — "Mi cuenta" (GER-49). Ver Design/PerfilUsuario.dc.html.
 *
 * **Las tres tarjetas son iguales para todo el mundo**, y ahí no hay roles que
 * valgan: todo lo que contienen es de quien las mira. El control de acceso lo
 * lleva cada función de `convex/`, que trabaja siempre sobre el usuario de la
 * sesión y nunca sobre un identificador que llegue del navegador.
 *
 * Desde GER-60 hay **una cuarta pieza que sí depende del rol**: el acceso a
 * "Gestión de usuarios", que solo se ofrece a la dueña y solo en móvil. Es
 * **navegación, no autorización** — la diferencia importa, porque quitar esa
 * condición no abriría nada: `/usuarios` rebota a quien no es dueña y
 * `requireOwnerId` autoriza sus funciones en el servidor. Antes esta cabecera
 * decía que la pantalla "no distingue roles"; dejó de ser cierto y por eso se
 * reescribió.
 *
 * El aviso de éxito vive aquí y no dentro de la tarjeta de contraseña porque la
 * maqueta lo pone arriba del todo, por encima de las tres tarjetas.
 */
export default function PerfilPage() {
  const viewer = useQuery(api.users.viewer);
  /**
   * `null` = no hay nada que celebrar. Con objeto = la contraseña cambió, y
   * `sesionesCerradas` dice si además se cerraron las demás sesiones. Se
   * distinguen porque **cambiar la contraseña y cerrar las otras sesiones son
   * dos transacciones**: la primera puede salir bien y la segunda no, y en ese
   * caso decir solo "actualizada correctamente" ocultaría lo único que a esas
   * alturas importa.
   */
  const [exito, setExito] = useState<{ sesionesCerradas: boolean } | null>(null);

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
          // `role="status"` y no `alert`: es una confirmación, no una alarma, y
          // se anuncia sin interrumpir lo que la persona esté haciendo.
          <div
            role="status"
            className="mb-4 flex animate-[fadein_250ms_ease] items-start gap-2.5 border border-success-500/25 bg-success-100 px-4 py-3"
          >
            <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-success-500">
              <Check className="size-3.25 text-white" />
            </span>
            <span className="text-[13px] font-medium text-success-700">
              Contraseña actualizada correctamente.
              {!exito.sesionesCerradas && (
                <>
                  {" "}
                  <span className="font-normal text-neutral-600">
                    Eso sí: no pudimos cerrar tu sesión en los demás
                    dispositivos. Si sospechas que alguien más tenía acceso,
                    vuelve a cambiarla en un momento.
                  </span>
                </>
              )}
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
          {/*
            La condición vive aquí y no dentro del componente, siguiendo el
            patrón de `nav/sidebar.tsx`: así se lee de un vistazo en el sitio
            donde se compone la pantalla, en vez de esconderla tras un
            componente que se auto-oculta devolviendo `null`.

            Es seguro leer `viewer.role` sin defensa: arriba ya se cortó con
            `undefined` (esqueleto) y con `null` (solo cabecera), así que aquí
            `viewer` es un objeto real y la fila no puede parpadear.
          */}
          {viewer.role === "duena" && <GestionUsuariosLink />}
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
