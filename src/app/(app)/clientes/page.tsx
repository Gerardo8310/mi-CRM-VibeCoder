"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight, Plus, Search, SearchX, Users, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/nav/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Pantalla 1 — Lista de clientes con buscador. GER-10. */
export default function ClientesPage() {
  const clients = useQuery(api.clients.list);
  const [term, setTerm] = useState("");

  const query = term.trim();
  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!query) return clients;
    const needle = query.toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return clients.filter((c) => {
      const byName = c.name.toLowerCase().includes(needle);
      const byPhone =
        digits.length > 0 && c.phone.replace(/\D/g, "").includes(digits);
      return byName || byPhone;
    });
  }, [clients, query]);

  const loading = clients === undefined;
  const searching = query.length > 0;
  const hasClients = !loading && clients.length > 0;

  return (
    <>
      <PageHeader
        title="Clientes"
        action={
          <Link
            href="/clientes/nuevo"
            className={buttonVariants("primary", "md", "hidden lg:inline-flex")}
          >
            <Plus className="size-3.5" />
            Nuevo cliente
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 lg:px-6 lg:pb-10">
        {/* Buscador (oculto solo si aún no hay ningún cliente) */}
        {(loading || hasClients) && (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="h-[42px] w-full rounded-none border border-neutral-200 bg-white pl-11 pr-11 text-sm text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)]"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-950"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <ListSkeleton />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6 text-neutral-400" />}
            title="Aún no tienes clientes"
            body="Toca + para registrar el primero. Cada contacto a un solo toque."
            action={
              <Link href="/clientes/nuevo" className={buttonVariants("primary", "lg")}>
                <Plus className="size-3.5" />
                Agregar primer cliente
              </Link>
            }
          />
        ) : searching && filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6 text-neutral-400" />}
            title="No encontramos a nadie"
            body={
              <>
                No hay resultados para &quot;
                <strong className="text-neutral-950">{query}</strong>&quot;.
                Verifica el nombre o el teléfono.
              </>
            }
            action={
              <button
                type="button"
                onClick={() => setTerm("")}
                className={buttonVariants("secondary", "sm")}
              >
                <X className="size-3" />
                Limpiar búsqueda
              </button>
            }
          />
        ) : (
          <>
            {searching ? (
              <p className="mb-2.5 px-0.5 text-xs text-neutral-600">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para
                &quot;<strong className="text-neutral-950">{query}</strong>&quot;
              </p>
            ) : (
              <p className="mb-2.5 px-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-neutral-400">
                {clients.length} contacto{clients.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className="border border-neutral-200 bg-white shadow-xs">
              {filtered.map((c) => (
                <Link
                  key={c._id}
                  href={`/clientes/${c._id}`}
                  className="flex h-14 items-center gap-3 border-b border-neutral-200 px-4 transition-colors last:border-b-0 hover:bg-neutral-100 lg:px-6"
                >
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-950">
                      {searching ? highlight(c.name, query) : c.name}
                    </div>
                    <div className="text-xs text-neutral-500">{c.phone}</div>
                  </div>
                  <div className="hidden w-[210px] shrink-0 truncate text-[13px] text-neutral-500 lg:block">
                    {c.email ?? ""}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Resalta la primera coincidencia del término dentro del nombre. */
function highlight(text: string, q: string): ReactNode {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-brand-50 font-bold text-brand-700">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-neutral-100">
        {icon}
      </div>
      <h2 className="mb-2 font-mono text-base font-semibold tracking-[-0.01em] text-neutral-950">
        {title}
      </h2>
      <p className="mb-6 max-w-[300px] text-sm leading-relaxed text-neutral-500">
        {body}
      </p>
      {action}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-3 animate-pulse">
      <div className="mb-2.5 h-3 w-20 bg-neutral-200" />
      <div className="border border-neutral-200 bg-white">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-14 items-center gap-3 border-b border-neutral-200 px-4 last:border-b-0 lg:px-6"
          >
            <div className="size-9 shrink-0 rounded-full bg-neutral-200" />
            <div className="flex-1 space-y-2">
              <div className={cn("h-3 bg-neutral-200", i % 2 ? "w-40" : "w-28")} />
              <div className="h-2.5 w-24 bg-neutral-100" />
            </div>
            <div className="size-4 bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
