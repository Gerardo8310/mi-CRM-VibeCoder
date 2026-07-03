"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, CheckCircle2, Clock, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FollowUpRow } from "@convex/followUps";
import { PageHeader } from "@/components/nav/page-header";
import { Avatar } from "@/components/ui/avatar";
import { QuickAddPanel } from "@/components/hoy/quick-add-panel";
import { cn } from "@/lib/utils";
import { useEndOfToday } from "@/lib/use-end-of-today";
import {
  calendarLabel,
  dayOffset,
  formatDayHeading,
  relativeDueLabel,
} from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pantalla 5 — "Hoy": los pendientes del día de Carlos (GER-17).
 * Landing del vendedor tras iniciar sesión. Los accesos rápidos de alta
 * (cliente, venta, interacción) son otra tarea (GER-50) y aún no están aquí.
 * Ver Design/Hoy.dc.html.
 */
export default function HoyPage() {
  // Frontera del día; se recalcula sola al cruzar la medianoche (ver el hook),
  // así que "Hoy" no queda anclado al día anterior si la app queda abierta.
  const endOfTodayTs = useEndOfToday();

  const viewer = useQuery(api.users.viewer);
  const data = useQuery(api.followUps.listForViewer, { endOfToday: endOfTodayTs });
  const markDone = useMutation(api.followUps.markDone);

  // Filas que se están desvaneciendo tras pulsar "Hecho". Guardamos una copia de
  // la fila (no solo el id) para poder seguir dibujándola durante la animación,
  // aunque la consulta ya la haya quitado de `pending`.
  const [fadingRows, setFadingRows] = useState<Map<Id<"followUps">, FollowUpRow>>(
    new Map()
  );
  const [failed, setFailed] = useState(false);

  const { atrasados, hoy, activeCount, hasRows } = useMemo(() => {
    // Medianoche de hoy, derivada del mismo límite que filtró la consulta: así
    // la separación "Atrasados / Para hoy" usa exactamente la frontera vigente
    // y se reclasifica sola cuando el día cambia (endOfTodayTs se actualiza).
    const startOfTodayTs = endOfTodayTs - DAY_MS + 1;
    const pending = data?.pending ?? [];
    const pendingIds = new Set(pending.map((r) => r._id));
    // Filas en desvanecido que la consulta ya quitó: las "puenteamos" para que
    // terminen su animación de salida en vez de desaparecer de golpe.
    const bridged = [...fadingRows.values()].filter((r) => !pendingIds.has(r._id));
    const all = [...pending, ...bridged];
    return {
      atrasados: all.filter((r) => r.dueDate < startOfTodayTs),
      hoy: all.filter((r) => r.dueDate >= startOfTodayTs),
      activeCount: all.filter((r) => !fadingRows.has(r._id)).length,
      hasRows: all.length > 0,
    };
  }, [data, fadingRows, endOfTodayTs]);

  const loading = data === undefined;

  function handleDone(row: FollowUpRow) {
    if (fadingRows.has(row._id)) return;
    setFadingRows((prev) => new Map(prev).set(row._id, row));
    // Persistimos de inmediato: la confirmación no depende del temporizador ni
    // de que la pantalla siga montada si el usuario navega enseguida.
    void markDone({ id: row._id }).catch(() => {
      setFailed(true);
      setFadingRows((prev) => {
        const next = new Map(prev);
        next.delete(row._id);
        return next;
      });
    });
    // Retira la fila del DOM una vez terminada la animación de salida (430ms).
    window.setTimeout(() => {
      setFadingRows((prev) => {
        const next = new Map(prev);
        next.delete(row._id);
        return next;
      });
    }, 450);
  }

  return (
    <>
      <PageHeader
        title="Hoy"
        meta={
          loading ? undefined : (
            <>
              <span className="hidden font-mono text-xs tracking-[0.02em] text-neutral-400 sm:inline">
                {formatDayHeading()}
              </span>
              {activeCount > 0 ? (
                <span className="whitespace-nowrap rounded-badge border border-error-500/20 bg-error-100 px-2.5 py-0.5 font-mono text-xs font-medium tracking-[0.02em] text-error-500">
                  {activeCount} pendiente{activeCount !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-badge border border-success-500/20 bg-success-100 px-2.5 py-0.5 font-mono text-xs font-medium tracking-[0.02em] text-success-700">
                  ¡Al día!
                </span>
              )}
            </>
          )
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Columna de pendientes */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24 lg:max-w-[660px] lg:px-8 lg:pt-6 lg:pb-10">
          {failed && (
            <div className="mb-4 flex items-start justify-between gap-3 border border-error-500/20 bg-error-100 px-3.5 py-2.5 text-[13px] leading-snug text-error-700">
              <span>
                No se pudo marcar como hecho. Revisa tu conexión e inténtalo de
                nuevo.
              </span>
              <button
                type="button"
                onClick={() => setFailed(false)}
                aria-label="Descartar"
                className="shrink-0 text-error-700/70 transition-colors hover:text-error-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {loading ? (
            <ListSkeleton />
          ) : (
            <>
              {hasRows ? (
                <>
                  {atrasados.length > 0 && (
                    <section className="mb-5">
                      <SectionLabel
                        icon={AlertTriangle}
                        tone="error"
                        label="Atrasados"
                        count={
                          atrasados.filter((r) => !fadingRows.has(r._id)).length
                        }
                      />
                      <div className="divide-y divide-error-500/10 border border-error-500/20 bg-white shadow-[0_1px_4px_rgba(209,59,30,0.06)]">
                        {atrasados.map((row) => (
                          <FollowUpItem
                            key={row._id}
                            row={row}
                            overdue
                            fading={fadingRows.has(row._id)}
                            onDone={handleDone}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {hoy.length > 0 && (
                    <section>
                      <SectionLabel
                        icon={Clock}
                        tone="neutral"
                        label="Para hoy"
                        count={hoy.filter((r) => !fadingRows.has(r._id)).length}
                      />
                      <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white shadow-xs">
                        {hoy.map((row) => (
                          <FollowUpItem
                            key={row._id}
                            row={row}
                            fading={fadingRows.has(row._id)}
                            onDone={handleDone}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <EmptyState firstName={firstNameOf(viewer?.name)} />
              )}

              {/* Accesos rápidos: alta de cliente, venta e interacción (GER-50). */}
              <QuickAddPanel />
            </>
          )}
        </div>

        {/* Mini calendario — próximos 7 días (solo escritorio) */}
        {!loading && (
          <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-5 lg:block">
            <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-neutral-600">
              Próximos 7 días
            </h3>
            {data.upcoming.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-neutral-400">
                No hay seguimientos programados para los próximos días.
              </p>
            ) : (
              data.upcoming.map((row) => (
                <div
                  key={row._id}
                  className="border-b border-neutral-100 py-2.5 last:border-b-0"
                >
                  <div
                    className={cn(
                      "mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]",
                      dayOffset(row.dueDate) === 1
                        ? "text-brand-500"
                        : "text-neutral-500"
                    )}
                  >
                    {calendarLabel(row.dueDate)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={row.clientName} size="sm" className="size-7 text-[8px]" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-950">
                        {row.clientName}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500">
                        {row.note}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </aside>
        )}
      </div>
    </>
  );
}

function firstNameOf(name: string | undefined): string | undefined {
  return name?.trim().split(/\s+/)[0];
}

function SectionLabel({
  icon: Icon,
  tone,
  label,
  count,
}: {
  icon: LucideIcon;
  tone: "error" | "neutral";
  label: string;
  count: number;
}) {
  const isError = tone === "error";
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full",
          isError ? "bg-error-100 text-error-500" : "bg-neutral-100 text-neutral-500"
        )}
      >
        <Icon className="size-[11px]" />
      </span>
      <span
        className={cn(
          "font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
          isError ? "text-error-500" : "text-neutral-600"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "rounded-badge px-1.5 py-px font-mono text-[10px] font-bold",
          isError ? "bg-error-100 text-error-500" : "bg-neutral-100 text-neutral-600"
        )}
      >
        {count}
      </span>
    </div>
  );
}

function FollowUpItem({
  row,
  overdue = false,
  fading,
  onDone,
}: {
  row: FollowUpRow;
  overdue?: boolean;
  fading: boolean;
  onDone: (row: FollowUpRow) => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-[430ms] ease-out",
        fading ? "max-h-0 opacity-0" : "max-h-32 opacity-100"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 px-3.5 py-[13px] transition-colors hover:bg-neutral-50",
          overdue && "border-l-[3px] border-l-error-500"
        )}
      >
        {/* Tocar la fila abre la ficha del cliente (GER-17). El botón "Hecho"
            queda fuera del enlace para no dispararla. */}
        <Link
          href={`/clientes/${row.clientId}`}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <Avatar name={row.clientName} />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-neutral-950">
                {row.clientName}
              </span>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap font-mono text-[11px] font-medium",
                  overdue ? "text-error-500" : "text-brand-500"
                )}
              >
                {relativeDueLabel(row.dueDate)}
              </span>
            </div>
            <p className="truncate text-[13px] leading-snug text-neutral-500">
              {row.note}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => onDone(row)}
          className="flex h-[30px] shrink-0 items-center gap-1 border border-neutral-300 px-2.5 font-mono text-[11px] font-medium text-neutral-600 transition-colors hover:border-success-500 hover:bg-success-100 hover:text-success-700"
        >
          <Check className="size-[11px]" />
          Hecho
        </button>
      </div>
    </div>
  );
}

function EmptyState({ firstName }: { firstName?: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-success-100 shadow-[0_0_0_8px_rgba(37,145,58,0.08)]">
        <CheckCircle2 className="size-8 text-success-500" />
      </div>
      <h2 className="mb-2 font-mono text-lg font-semibold tracking-[-0.02em] text-neutral-950">
        ¡Todo al día!
      </h2>
      <p className="max-w-[260px] text-sm leading-relaxed text-neutral-500">
        No tienes pendientes para hoy. Buen trabajo{firstName ? `, ${firstName}` : ""}.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-2.5 h-4 w-24 bg-neutral-200" />
      <div className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-[13px]">
            <div className="size-9 shrink-0 rounded-full bg-neutral-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 bg-neutral-200" />
              <div className="h-3 w-48 bg-neutral-100" />
            </div>
            <div className="h-[30px] w-16 bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
