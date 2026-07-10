"use client";

import { MoreHorizontal } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { daysOpenLabel, type Stage } from "@/lib/opportunity-stages";

const MONEY_FMT = new Intl.NumberFormat("es-MX");

export type BoardOpportunity = {
  _id: Id<"opportunities">;
  clientId: Id<"clients">;
  clientName: string;
  product: string;
  amount: number;
  stage: Stage;
  createdAt: number;
  closedAt?: number;
};

/**
 * Tarjeta de oportunidad en el tablero Kanban (GER-15). Click → ficha del
 * cliente; "⋯" → menú "Mover a etapa" (paridad móvil/escritorio); arrastrable en
 * escritorio. En cerrado muestra borde verde + "Ganado"; en el resto, "N días".
 */
export function OpportunityCard({
  opp,
  dragging,
  onOpen,
  onMenu,
  onDragStart,
  onDragEnd,
}: {
  opp: BoardOpportunity;
  dragging: boolean;
  onOpen: (clientId: Id<"clients">) => void;
  onMenu: (opp: BoardOpportunity) => void;
  onDragStart: (id: Id<"opportunities">) => void;
  onDragEnd: () => void;
}) {
  const isCerrado = opp.stage === "cerrado";
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", opp._id);
        onDragStart(opp._id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(opp.clientId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(opp.clientId);
        }
      }}
      className={cn(
        "cursor-pointer border border-neutral-200 bg-white p-3 shadow-xs transition-[box-shadow,transform,opacity] hover:-translate-y-px hover:shadow-md",
        isCerrado && "border-success-500/25 border-l-[3px] border-l-success-500",
        dragging && "rotate-[1.5deg] scale-[0.97] opacity-40"
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-semibold leading-tight text-neutral-950">
          {opp.clientName}
        </span>
        <button
          type="button"
          aria-label="Mover a etapa"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenu(opp);
          }}
          className="-mr-1 shrink-0 p-0.5 text-neutral-300 transition-colors hover:text-neutral-600"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </div>
      <div className="mb-2.5 truncate text-xs text-neutral-500">
        {opp.product || "Oportunidad"}
      </div>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-[17px] font-bold",
            isCerrado ? "text-success-700" : "text-neutral-950"
          )}
        >
          ${MONEY_FMT.format(opp.amount)}
        </span>
        {isCerrado ? (
          <span className="rounded-badge border border-success-500/25 bg-success-100 px-1.75 py-px text-[10px] font-medium text-success-700">
            Ganado
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">
            {daysOpenLabel(opp.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
