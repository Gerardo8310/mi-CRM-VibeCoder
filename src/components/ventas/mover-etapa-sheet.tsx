"use client";

import { Check, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_LIST, type Stage } from "@/lib/opportunity-stages";
import { QuickSheet } from "@/components/hoy/quick-sheet";

const MONEY_FMT = new Intl.NumberFormat("es-MX");

/**
 * Bottom sheet "Mover a etapa" (GER-15): lista las 3 etapas con su conteo y
 * monto; la etapa actual queda deshabilitada ("Actual"). Disponible en todas
 * las tarjetas (incluida cerrado, para reabrir) — paridad móvil/escritorio.
 */
export function MoverEtapaSheet({
  open,
  currentStage,
  stats,
  onClose,
  onMove,
}: {
  open: boolean;
  currentStage: Stage | null;
  stats: Record<Stage, { count: number; total: number }>;
  onClose: () => void;
  onMove: (stage: Stage) => void;
}) {
  return (
    <QuickSheet
      open={open}
      onClose={onClose}
      icon={<MoveRight className="size-3 text-neutral-600" />}
      iconWrapClass="bg-neutral-100"
      title="Mover a etapa"
      footer={<div className="pb-4" />}
    >
      <div>
        {STAGE_LIST.map((s) => {
          const isCurrent = s.key === currentStage;
          const stat = stats[s.key];
          const noun = s.key === "cerrado" ? "ganados" : "activos";

          if (isCurrent) {
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3.5 opacity-55"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500">
                  <Check className="size-2.5 text-white" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-950">
                    {s.label}
                  </div>
                  <div className="text-xs text-neutral-500">Etapa actual</div>
                </div>
                <span className="whitespace-nowrap text-[11px] text-neutral-400">
                  Actual
                </span>
              </div>
            );
          }

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onMove(s.key)}
              className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-neutral-50"
            >
              <span className="size-5 shrink-0 rounded-full border-2 border-neutral-300" />
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-950">
                  {s.label}
                </div>
                <div className="text-xs text-neutral-500">
                  {stat.count} trato{stat.count !== 1 ? "s" : ""} {noun}
                </div>
              </div>
              <span
                className={cn(
                  "whitespace-nowrap rounded-badge px-2 py-0.5 text-[11px] font-medium",
                  s.badge
                )}
              >
                ${MONEY_FMT.format(stat.total)}
              </span>
            </button>
          );
        })}
      </div>
    </QuickSheet>
  );
}
