"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Pencil, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/nav/page-header";
import { Avatar } from "@/components/ui/avatar";
import {
  EditarUsuarioSheet,
  type UsuarioEditable,
} from "@/components/usuarios/editar-usuario-sheet";
import { cn } from "@/lib/utils";

/**
 * Pantalla 7 — Gestión de usuarios, solo para la dueña (GER-48).
 * Ver Design/GestionUsuarios.dc.html.
 *
 * EL GATE DE ROL DE AQUÍ ES INTERFAZ, NO CONTROL DE ACCESO. El control está en
 * `requireOwnerId` (convex/authz.ts), que hace fallar `users:list`, `updateRole`
 * y `setStatus` para cualquiera que no sea dueña. Esto solo evita que alguien
 * que llegue a la URL se quede mirando una pantalla de error: si no es dueña, se
 * le devuelve a su sitio, y la consulta ni siquiera se lanza (`"skip"`).
 *
 * Ese `"skip"` no es una optimización: `users:list` **lanza** para un vendedor,
 * y sin él la pantalla intentaría la consulta durante el instante previo a la
 * redirección.
 */
export default function UsuariosPage() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  const esDuena = viewer?.role === "duena";
  const usuarios = useQuery(api.users.list, esDuena ? {} : "skip");
  const [editando, setEditando] = useState<UsuarioEditable | null>(null);

  useEffect(() => {
    if (viewer === undefined) return; // cargando
    // `viewer === null` lo resuelve SessionGuard (cierra sesión y va a /login).
    if (viewer !== null && viewer.role !== "duena") router.replace("/");
  }, [viewer, router]);

  if (viewer === undefined) {
    return (
      <>
        <PageHeader title="Gestión de usuarios" />
        <TablaSkeleton />
      </>
    );
  }

  // Sin rol de dueña no hay nada que enseñar: el efecto de arriba ya está
  // redirigiendo. Va ANTES de mirar `usuarios`, que con `"skip"` no llega nunca
  // y dejaría el esqueleto girando para siempre.
  if (!esDuena) return <PageHeader title="Gestión de usuarios" />;

  if (usuarios === undefined) {
    return (
      <>
        <PageHeader title="Gestión de usuarios" />
        <TablaSkeleton />
      </>
    );
  }

  // Solo está la dueña: no hay a quién gestionar todavía.
  const soloYo = usuarios.length === 1;

  return (
    <>
      <PageHeader title="Gestión de usuarios" />

      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4.5 lg:px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-neutral-400">
            {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="border-y border-neutral-200 bg-white shadow-xs">
          <div className="hidden h-9 items-center border-y border-neutral-200 bg-neutral-50 px-4 lg:flex lg:px-6">
            <ColumnaCabecera className="flex-[2]">Usuario</ColumnaCabecera>
            <ColumnaCabecera className="flex-[2]">
              Correo electrónico
            </ColumnaCabecera>
            <ColumnaCabecera className="flex-1">Rol</ColumnaCabecera>
            <ColumnaCabecera className="flex-1">Estado</ColumnaCabecera>
            <div className="w-22.5 shrink-0" />
          </div>

          {usuarios.map((u) => {
            const esYo = u._id === viewer?._id;
            const activo = u.status === "activo";
            return (
              <div
                key={u._id}
                onClick={esYo ? undefined : () => setEditando(u)}
                className={cn(
                  "flex h-15 items-center border-b border-neutral-200 px-4 transition-colors last:border-b-0 lg:px-6",
                  esYo ? "cursor-default" : "cursor-pointer hover:bg-neutral-50",
                  !activo && "bg-neutral-50/60"
                )}
              >
                <div
                  className={cn(
                    "flex min-w-0 flex-[2] items-center gap-2.5",
                    !activo && "opacity-55"
                  )}
                >
                  <Avatar name={u.name} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-950">
                      {u.name}
                      {esYo && (
                        <span className="ml-1 text-[11px] font-normal text-neutral-400">
                          (tú)
                        </span>
                      )}
                    </div>
                    <div className="mt-px truncate text-xs text-neutral-500 lg:hidden">
                      {u.email}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "hidden min-w-0 flex-[2] truncate text-[13px] text-neutral-500 lg:block",
                    !activo && "opacity-55"
                  )}
                >
                  {u.email}
                </div>

                <div className={cn("flex flex-1", !activo && "opacity-55")}>
                  <InsigniaRol role={u.role} activo={activo} />
                </div>

                <div className="flex flex-1 items-center gap-1.25">
                  <span
                    className={cn(
                      "size-1.75 shrink-0 rounded-full",
                      activo ? "bg-success-500" : "bg-neutral-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      activo
                        ? "font-medium text-success-700"
                        : "text-neutral-500"
                    )}
                  >
                    {activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="flex w-22.5 shrink-0 justify-end">
                  {esYo ? (
                    <span className="font-mono text-[11px] text-neutral-300">
                      —
                    </span>
                  ) : (
                    <span className="flex h-7.5 items-center gap-1 border border-neutral-300 px-2.5 font-mono text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-950/4">
                      <Pencil className="size-2.75" />
                      Editar
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/*
          Estado vacío. La maqueta pone aquí "Invita a tu equipo para empezar" y
          un botón "Invitar primer usuario"; **ese texto y ese botón llegan con
          la rama 2**, que es la que trae `invitations.invite`. Hasta entonces
          el texto no promete una acción que la pantalla no puede hacer: es
          preferible a dejar un botón muerto o una llamada a la acción sin
          destino. Al terminar la rama 2 esto vuelve a ser literalmente la
          maqueta.
        */}
        {soloYo && (
          <div className="flex flex-col items-center px-4 py-9 text-center">
            <div className="mb-4 flex size-13 items-center justify-center rounded-full bg-neutral-100">
              <Users className="size-6 text-neutral-400" />
            </div>
            <h3 className="mb-2 font-mono text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
              Todavía eres la única persona en el CRM
            </h3>
            <p className="max-w-70 text-[13px] leading-relaxed text-neutral-500">
              Cuando haya más gente aparecerá aquí, con su rol y su estado.
            </p>
          </div>
        )}
      </div>

      {editando !== null && (
        <EditarUsuarioSheet
          key={editando._id}
          usuario={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

function ColumnaCabecera({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] font-bold uppercase tracking-[0.07em] text-neutral-400",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * La insignia de rol pierde el color cuando la persona está inactiva — igual
 * que en la maqueta, donde la fila apagada muestra el rol en gris.
 */
function InsigniaRol({
  role,
  activo,
}: {
  role: "vendedor" | "duena";
  activo: boolean;
}) {
  const duena = role === "duena";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-badge border px-2 py-0.5 text-[11px] font-medium",
        !activo
          ? "border-neutral-300 bg-neutral-100 text-neutral-600"
          : duena
            ? "border-success-500/25 bg-success-100 text-success-700"
            : "border-info-500/25 bg-info-100 text-info-700"
      )}
    >
      {duena ? "Dueña" : "Vendedor"}
    </span>
  );
}

function TablaSkeleton() {
  return (
    <div className="flex-1 animate-pulse pt-4.5">
      <div className="mb-3 h-3 w-20 bg-neutral-200 mx-4 lg:mx-6" />
      <div className="border-y border-neutral-200 bg-white">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-15 items-center gap-2.5 border-b border-neutral-200 px-4 last:border-b-0 lg:px-6"
          >
            <div className="size-9 shrink-0 rounded-full bg-neutral-200" />
            <div className="flex-1 space-y-2">
              <div className={cn("h-3 bg-neutral-200", i % 2 ? "w-40" : "w-28")} />
              <div className="h-2.5 w-24 bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
