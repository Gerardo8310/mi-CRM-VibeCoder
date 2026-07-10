"use client";

import { useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const MONEY_FMT = new Intl.NumberFormat("es-MX");

/**
 * Selector desplegable de la oportunidad a la que ligar un seguimiento (GER-16).
 * Lista las oportunidades del cliente elegido; por defecto "Sin oportunidad".
 * Compartido por el panel "Agendar" de la ficha y el acceso rápido de "Hoy".
 * Se deshabilita si aún no hay cliente o el cliente no tiene oportunidades
 * (mostrando "Sin oportunidad"). El valor es el id de la oportunidad, o `""`.
 */
export function OpportunitySelect({
  clientId,
  value,
  onChange,
  disabled,
}: {
  clientId: Id<"clients"> | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const opportunities = useQuery(
    api.opportunities.listForClient,
    clientId ? { id: clientId } : "skip"
  );
  const loading = clientId !== null && opportunities === undefined;
  const isDisabled =
    disabled || !clientId || loading || (opportunities?.length ?? 0) === 0;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        className="h-11 w-full appearance-none rounded-none border border-neutral-200 bg-white pl-3 pr-9 text-sm text-neutral-950 outline-none transition-[border-color,box-shadow] focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        <option value="">Sin oportunidad</option>
        {opportunities?.map((o) => (
          <option key={o._id} value={o._id}>
            {(o.product || "Oportunidad") + " — $" + MONEY_FMT.format(o.amount)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
    </div>
  );
}
