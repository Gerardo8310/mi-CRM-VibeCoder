"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, Mail, Pencil } from "lucide-react";
import { api } from "@convex/_generated/api";
import { MAX_NAME_LENGTH } from "@convex/userConstants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PerfilCard } from "@/components/perfil/perfil-card";

/**
 * "Mi perfil" (GER-49). Ver Design/PerfilUsuario.dc.html, sección 1.
 *
 * De los cuatro datos que enseña, **solo uno es editable**: el nombre. El correo
 * es el identificador de la cuenta en `authAccounts`, así que cambiarlo aquí
 * dejaría la ficha y la credencial apuntando a correos distintos; y el rol lo
 * decide la dueña desde Gestión de usuarios. Los dos llevan su nota explicando
 * a quién acudir, que es lo que evita que alguien piense que está roto.
 *
 * EL ÍCONO DE CÁMARA DE LA MAQUETA NO SE CONSTRUYE. Está declarado fuera de
 * alcance en el issue: el avatar se queda en iniciales en todo el MVP. Dibujarlo
 * sin que haga nada sería prometer una función que no existe.
 */
export function MiPerfilCard({
  nombre,
  correo,
  rol,
}: {
  nombre: string;
  correo: string;
  rol: "vendedor" | "duena";
}) {
  const updateName = useMutation(api.users.updateName);

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limpio = borrador.trim();
  // El servidor rechaza el nombre vacío, pero el botón no debe llegar a
  // ofrecerlo: un error redactado por Convex en producción no explicaría nada.
  const puedeGuardar = limpio.length > 0 && limpio !== nombre;

  function empezar() {
    setBorrador(nombre);
    setError(null);
    setEditando(true);
  }

  function cancelar() {
    if (guardando) return;
    // Se descarta el borrador y se vuelve al valor real. Sin esto, reabrir la
    // edición mostraría lo que se había tecleado y descartado.
    setBorrador(nombre);
    setError(null);
    setEditando(false);
  }

  async function guardar() {
    if (guardando || !puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await updateName({ name: limpio });
      // No se toca `borrador`: la query `viewer` se actualiza sola y el modo
      // lectura ya muestra el valor nuevo.
      setEditando(false);
    } catch {
      setError("No se pudo guardar el nombre. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <PerfilCard titulo="Mi perfil" subtitulo="Información de tu cuenta">
      {/* Avatar + rol */}
      <div className="mb-6 flex items-center gap-4 border-b border-neutral-100 pb-5">
        <Avatar name={nombre} size="lg" className="border-2 border-white" />
        <div className="min-w-0">
          <div className="truncate font-mono text-base font-semibold tracking-[-0.01em] text-neutral-950">
            {nombre}
          </div>
          <Badge variant={rol === "duena" ? "brand" : "info"} className="mt-1">
            {rol === "duena" ? "Dueña" : "Vendedor"}
          </Badge>
          <p className="mt-1 text-xs text-neutral-400">
            Solo Martha puede cambiar tu rol
          </p>
        </div>
      </div>

      {/* Nombre */}
      <div className="mb-4">
        <Label htmlFor="perfil-nombre">Nombre completo</Label>
        {editando ? (
          <>
            <Input
              id="perfil-nombre"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              disabled={guardando}
              error={!!error}
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={cancelar}
                disabled={guardando}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => void guardar()}
                disabled={!puedeGuardar}
                loading={guardando}
                className="flex-[2]"
              >
                {!guardando && <Check className="size-3.25" />}
                Guardar nombre
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-[42px] flex-1 items-center truncate border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950">
              {nombre}
            </div>
            <button
              type="button"
              onClick={empezar}
              aria-label="Editar mi nombre"
              className="flex size-[42px] shrink-0 items-center justify-center border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-950/4 hover:text-neutral-950"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
        {error && (
          <p className="mt-1.5 text-xs leading-snug text-error-700">{error}</p>
        )}
      </div>

      {/* Correo */}
      <div>
        <Label htmlFor="perfil-correo">
          Correo electrónico{" "}
          <span className="font-normal normal-case tracking-normal text-neutral-400">
            — solo lectura
          </span>
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            id="perfil-correo"
            type="email"
            value={correo}
            readOnly
            disabled
            className="cursor-not-allowed pl-8.5"
          />
        </div>
        <p className="mt-1.25 text-[11px] text-neutral-400">
          Para cambiar el correo contacta al administrador.
        </p>
      </div>
    </PerfilCard>
  );
}
