"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

/**
 * Buscador/autocompletado de clientes existentes para el alta rápida de venta e
 * interacción (GER-50). No permite texto libre: la oportunidad/interacción debe
 * quedar ligada a un cliente real elegido de la lista.
 */
export function ClientCombobox({
  selectedId,
  onSelect,
  error,
}: {
  selectedId: Id<"clients"> | null;
  onSelect: (id: Id<"clients"> | null, name: string) => void;
  error?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);

  // "skip" mientras el campo no tiene foco: no consultamos de fondo.
  const results = useQuery(api.clients.search, focused ? { term } : "skip");
  const open = focused && results !== undefined;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          value={term}
          error={error}
          placeholder="Buscar cliente por nombre o teléfono…"
          className="pl-9"
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setTerm(e.target.value);
            if (selectedId) onSelect(null, ""); // al editar, se deshace la selección
          }}
        />
      </div>

      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto border border-neutral-200 bg-white shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-2.5 text-[13px] text-neutral-400">
              {term.trim()
                ? "Sin clientes que coincidan."
                : "No hay clientes todavía. Usa “Alta rápida” primero."}
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c._id}
                type="button"
                // Evita el blur del input antes de registrar el click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(c._id, c.name);
                  setTerm(c.name);
                  setFocused(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
              >
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-neutral-950">
                    {c.name}
                  </span>
                  <span className="block text-[11px] text-neutral-500">
                    {c.phone}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
