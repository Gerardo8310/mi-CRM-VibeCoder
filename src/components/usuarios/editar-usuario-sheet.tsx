"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, Loader2, Mail, UserCheck, UserX } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { Field } from "@/components/hoy/quick-parts";
import { RoleCards, type Role } from "@/components/usuarios/role-cards";
import { ConfirmarDesactivar } from "@/components/usuarios/confirmar-desactivar";

export interface UsuarioEditable {
  _id: Id<"users">;
  name: string;
  email: string;
  role: Role;
  status: "activo" | "inactivo";
}

/**
 * Panel "Editar usuario" (GER-48). Ver Design/GestionUsuarios.dc.html.
 *
 * Nombre y correo son de solo lectura: el correo **es** el identificador de la
 * cuenta en `authAccounts`, así que cambiarlo aquí dejaría la ficha y la cuenta
 * apuntando a correos distintos. El nombre lo cambia cada quien desde su perfil
 * (GER-49).
 *
 * Lo editable es el rol, y aparte —en su zona de riesgo— el acceso. Son dos
 * cosas distintas a propósito: el rol se guarda con el botón del pie, y activar
 * o desactivar surte efecto en el momento, porque cortarle el acceso a alguien
 * no es un cambio que se deje "sin guardar" por accidente.
 *
 * Quien lo usa lo monta con `key={usuario._id}` y solo cuando hay alguien
 * seleccionado: así el estado del formulario nace del usuario correcto en cada
 * apertura, sin un efecto que lo sincronice.
 */
export function EditarUsuarioSheet({
  usuario,
  onClose,
}: {
  usuario: UsuarioEditable;
  onClose: () => void;
}) {
  const updateRole = useMutation(api.users.updateRole);
  const setStatus = useMutation(api.users.setStatus);

  const [role, setRole] = useState<Role>(usuario.role);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activo = usuario.status === "activo";
  const roleChanged = role !== usuario.role;

  function close() {
    if (saving) return;
    setError(null);
    setConfirming(false);
    onClose();
  }

  async function handleSave() {
    if (saving) return;
    if (!roleChanged) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRole({ userId: usuario._id, role });
      onClose();
    } catch {
      setError("No se pudo guardar el cambio de rol. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(nuevo: "activo" | "inactivo") {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setStatus({ userId: usuario._id, status: nuevo });
      setConfirming(false);
      onClose();
    } catch {
      setError(
        nuevo === "inactivo"
          ? "No se pudo desactivar a esta persona. Inténtalo de nuevo."
          : "No se pudo reactivar a esta persona. Inténtalo de nuevo."
      );
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SidePanel
        open
        onClose={close}
        title="Editar usuario"
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="h-11 flex-1 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-11 flex-[2] items-center justify-center gap-1.75 border border-brand-500 bg-brand-500 font-mono text-[13px] font-medium text-white transition-colors hover:border-brand-600 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Guardar cambios
            </button>
          </>
        }
      >
        {/* Cabecera con quién es */}
        <div className="mb-5 flex items-center gap-3 border-b border-neutral-100 pb-4.5">
          <Avatar name={usuario.name} className="size-11 text-[13px]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-950">
              {usuario.name}
            </div>
            <div className="truncate text-xs text-neutral-500">
              {usuario.email} · {activo ? "Activo" : "Inactivo"}
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-[13px] leading-snug text-error-700">{error}</p>
        )}

        <div className="mb-4">
          <Field label="Nombre completo">
            <Input value={usuario.name} readOnly disabled />
          </Field>
        </div>

        <div className="mb-5">
          <Field label="Correo electrónico">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                value={usuario.email}
                readOnly
                disabled
                className="cursor-not-allowed pl-8.5"
              />
            </div>
          </Field>
          <p className="mt-1.25 text-[11px] text-neutral-400">
            El correo no se puede modificar
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2.5 block font-sans text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-600">
            Rol
          </label>
          <RoleCards value={role} onChange={setRole} disabled={saving} />
        </div>

        {/* Zona de riesgo */}
        <div className="mb-1 border-t border-neutral-100 pt-5">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-400">
            Zona de riesgo
          </p>
          <p className="mb-3 text-[13px] leading-normal text-neutral-500">
            {activo
              ? `${usuario.name} dejará de tener acceso al CRM inmediatamente.`
              : `${usuario.name} volverá a tener acceso al CRM y conserva todo su historial.`}
          </p>
          {activo ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={saving}
              className="flex h-9.5 items-center gap-1.75 border border-error-500/30 bg-transparent px-3.5 font-mono text-xs font-medium tracking-[-0.01em] text-error-500 transition-colors hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <UserX className="size-3.25" />
              Desactivar usuario
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void cambiarEstado("activo")}
              disabled={saving}
              className="flex h-9.5 items-center gap-1.75 border border-neutral-300 bg-transparent px-3.5 font-mono text-xs font-medium tracking-[-0.01em] text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <UserCheck className="size-3.25" />
              Reactivar usuario
            </button>
          )}
        </div>
      </SidePanel>

      <ConfirmarDesactivar
        open={confirming}
        nombre={usuario.name}
        saving={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void cambiarEstado("inactivo")}
      />
    </>
  );
}
