"use client";

import { cn } from "@/lib/utils";

export type Role = "vendedor" | "duena";

/**
 * Las dos tarjetas de rol, con su descripción. Ver Design/GestionUsuarios.dc.html
 * (`.role-card` / `.role-card-on`).
 *
 * Vive aparte porque la usan los dos paneles de la pantalla: el de editar
 * (GER-48, rama 1) y el de invitar (rama 2). El texto de cada rol es el de la
 * maqueta y no debe divergir entre paneles — de ahí que sea una sola fuente.
 *
 * Detalle de maquetación deliberado: la tarjeta seleccionada tiene un borde de
 * 2 px y la otra de 1 px, como en la maqueta, así que el relleno se compensa
 * (13 px frente a 14 px) para que la caja exterior no cambie de tamaño al
 * seleccionar. Sin eso, elegir un rol mueve un píxel toda la columna.
 */
const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "vendedor",
    label: "Vendedor",
    description: "Gestiona clientes, ventas y seguimientos.",
  },
  {
    value: "duena",
    label: "Dueña / Dueño",
    description: "Acceso completo: usuarios, reportes y ajustes.",
  },
];

export function RoleCards({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {ROLES.map((role) => {
        const selected = role.value === value;
        return (
          <button
            key={role.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(role.value)}
            className={cn(
              "text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-2 border-brand-500 bg-brand-50 p-[13px]"
                : "border border-neutral-200 p-3.5 hover:border-brand-500"
            )}
          >
            <span className="mb-1.75 flex items-center gap-2">
              <span
                className={cn(
                  "flex size-[15px] shrink-0 items-center justify-center rounded-full border-2",
                  selected
                    ? "border-brand-500 bg-brand-500"
                    : "border-neutral-300"
                )}
              >
                {selected && <span className="size-[5px] rounded-full bg-white" />}
              </span>
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  selected ? "text-brand-700" : "text-neutral-950"
                )}
              >
                {role.label}
              </span>
            </span>
            <span className="block text-xs leading-normal text-neutral-500">
              {role.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
