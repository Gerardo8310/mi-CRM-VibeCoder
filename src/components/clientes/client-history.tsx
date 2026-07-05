"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { TimelineEntry } from "@convex/history";
import { cn } from "@/lib/utils";
import { historyTimestamp } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";

/** Ícono + color del círculo por tipo de interacción (ver Design/FichaCliente). */
const INT_VISUAL: Record<
  "llamada" | "mensaje" | "visita",
  { icon: LucideIcon; circle: string; badge: string; label: string }
> = {
  llamada: {
    icon: Phone,
    circle: "bg-info-100 text-info-700",
    badge: "bg-info-100 text-info-700 border-info-700/20",
    label: "Llamada",
  },
  mensaje: {
    icon: MessageCircle,
    circle: "bg-info-100 text-info-700",
    badge: "bg-info-100 text-info-700 border-info-700/20",
    label: "Mensaje",
  },
  visita: {
    icon: MapPin,
    circle: "bg-success-100 text-success-700",
    badge: "bg-success-100 text-success-700 border-success-500/20",
    label: "Visita",
  },
};

/** Insignia de etapa de la oportunidad. */
const STAGE_VISUAL: Record<
  "interesado" | "cotizado" | "cerrado",
  { badge: string; label: string }
> = {
  interesado: {
    badge: "bg-info-100 text-info-700 border-info-700/25",
    label: "Interesado",
  },
  cotizado: {
    badge: "bg-warning-100 text-warning-700 border-warning-500/25",
    label: "Cotizado",
  },
  cerrado: {
    badge: "bg-success-100 text-success-700 border-success-500/25",
    label: "Cerrado",
  },
};

const MONEY_FMT = new Intl.NumberFormat("es-MX");

/**
 * Historial del cliente en la ficha (GER-13): línea de tiempo cronológica que
 * combina interacciones, oportunidades y seguimientos completados. Los datos
 * vienen ya unidos y ordenados de `history.forClient`; se auto-actualiza al
 * anotar (reactividad de Convex).
 */
export function ClientHistory({
  clientId,
  onAnotar,
}: {
  clientId: Id<"clients">;
  onAnotar: () => void;
}) {
  const entries = useQuery(api.history.forClient, { id: clientId });

  if (entries === undefined) return <HistorySkeleton />;
  if (entries.length === 0) return <EmptyHistory onAnotar={onAnotar} />;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold tracking-[-0.01em] text-neutral-950">
          Historial
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-neutral-400">
          {entries.length} registro{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div>
        {entries.map((entry, i) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            last={i === entries.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ entry, last }: { entry: TimelineEntry; last: boolean }) {
  const { icon: Icon, circle } = rowIcon(entry);

  return (
    <div className="group -mx-3 flex gap-3 px-3">
      {/* Riel: círculo con ícono + línea conectora */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            circle
          )}
        >
          <Icon className="size-3.5" />
        </div>
        {!last && <div className="mt-1 w-px flex-1 bg-neutral-200" />}
      </div>

      {/* Contenido */}
      <div className={cn("min-w-0 flex-1 pt-1", last ? "pb-1" : "pb-4")}>
        <RowContent entry={entry} />
      </div>
    </div>
  );
}

function RowContent({ entry }: { entry: TimelineEntry }) {
  const when = historyTimestamp(entry.date);

  if (entry.kind === "interaction") {
    const v = INT_VISUAL[entry.intType];
    return (
      <>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Badge className={v.badge}>{v.label}</Badge>
          <TimeStamp>{when}</TimeStamp>
        </div>
        <p className="text-sm leading-relaxed text-neutral-950">{entry.text}</p>
      </>
    );
  }

  if (entry.kind === "opportunity") {
    const v = STAGE_VISUAL[entry.stage];
    return (
      <>
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-neutral-950">
              {entry.product || "Oportunidad"}
            </span>
            <Badge className={v.badge}>{v.label}</Badge>
          </div>
          <TimeStamp>{when}</TimeStamp>
        </div>
        <div className="font-mono text-lg font-bold text-neutral-950">
          ${MONEY_FMT.format(entry.amount)} MXN
        </div>
        <div className="text-xs text-neutral-500">Oportunidad creada</div>
      </>
    );
  }

  // followup "hecho"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-neutral-500">{entry.note}</span>
        <Badge className="border-neutral-300 bg-neutral-100 text-neutral-600">
          Completado
        </Badge>
      </div>
      <TimeStamp>{when}</TimeStamp>
    </div>
  );
}

function rowIcon(entry: TimelineEntry): { icon: LucideIcon; circle: string } {
  if (entry.kind === "interaction") {
    const v = INT_VISUAL[entry.intType];
    return { icon: v.icon, circle: v.circle };
  }
  if (entry.kind === "opportunity") {
    return { icon: TrendingUp, circle: "bg-warning-100 text-brand-500" };
  }
  return { icon: Check, circle: "bg-neutral-100 text-neutral-500" };
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-badge border px-1.75 py-px text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function TimeStamp({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-neutral-400">
      {children}
    </span>
  );
}

function EmptyHistory({ onAnotar }: { onAnotar: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-4 flex size-[52px] items-center justify-center rounded-full bg-neutral-100">
        <Clock className="size-6 text-neutral-400" />
      </div>
      <h3 className="mb-2 font-mono text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
        Aún no hay historial
      </h3>
      <p className="mb-6 max-w-[260px] text-sm leading-relaxed text-neutral-500">
        Anota tu primera interacción para empezar el seguimiento.
      </p>
      <button
        type="button"
        onClick={onAnotar}
        className={buttonVariants("primary", "md")}
      >
        <MessageCircle className="size-3.5" />
        Anotar interacción
      </button>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-4 w-24 bg-neutral-200" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="size-8 shrink-0 rounded-full bg-neutral-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-28 bg-neutral-200" />
              <div className={cn("h-3 bg-neutral-100", i % 2 ? "w-3/4" : "w-1/2")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
