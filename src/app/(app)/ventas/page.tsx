"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CheckCircle2,
  Inbox,
  Plus,
  Trophy,
  X,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { STAGE_ORDER, STAGES, type Stage } from "@/lib/opportunity-stages";
import { PageHeader } from "@/components/nav/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  OpportunityCard,
  type BoardOpportunity,
} from "@/components/ventas/opportunity-card";
import { MoverEtapaSheet } from "@/components/ventas/mover-etapa-sheet";
import { RegistrarOportunidadSheet } from "@/components/ventas/registrar-oportunidad-sheet";

const MONEY_FMT = new Intl.NumberFormat("es-MX");

type StageStat = { count: number; total: number };

/** Pantalla 4 — Tablero de ventas por etapas (Kanban). GER-15. */
export default function VentasPage() {
  const board = useQuery(api.opportunities.board);
  const updateStage = useMutation(api.opportunities.updateStage);
  const router = useRouter();

  const [moveOpp, setMoveOpp] = useState<BoardOpportunity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<Stage | undefined>(undefined);
  const [draggingId, setDraggingId] = useState<Id<"opportunities"> | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [moveError, setMoveError] = useState(false);

  const { byStage, stats, pipeline } = useMemo(() => {
    const byStage: Record<Stage, BoardOpportunity[]> = {
      interesado: [],
      cotizado: [],
      cerrado: [],
    };
    const stats: Record<Stage, StageStat> = {
      interesado: { count: 0, total: 0 },
      cotizado: { count: 0, total: 0 },
      cerrado: { count: 0, total: 0 },
    };
    for (const o of board ?? []) {
      byStage[o.stage].push(o);
      stats[o.stage].count += 1;
      stats[o.stage].total += o.amount;
    }
    return {
      byStage,
      stats,
      pipeline: stats.interesado.total + stats.cotizado.total,
    };
  }, [board]);

  function openCreate(stage?: Stage) {
    setCreateStage(stage);
    setCreateOpen(true);
  }

  function persistStage(id: Id<"opportunities">, stage: Stage) {
    setMoveError(false);
    void updateStage({ id, stage }).catch(() => setMoveError(true));
  }

  function handleDrop(stage: Stage) {
    setDragOverStage(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const opp = (board ?? []).find((o) => o._id === id);
    if (!opp || opp.stage === stage) return;
    persistStage(id, stage);
  }

  function handleMove(stage: Stage) {
    if (moveOpp) persistStage(moveOpp._id, stage);
    setMoveOpp(null);
  }

  const loading = board === undefined;
  const isEmpty = !loading && board.length === 0;

  return (
    <>
      <PageHeader
        title="Ventas"
        meta={
          !loading &&
          !isEmpty && (
            <span className="whitespace-nowrap font-mono text-xs tracking-[0.02em] text-neutral-400">
              Pipeline · ${MONEY_FMT.format(pipeline)} MXN
            </span>
          )
        }
        action={
          !loading &&
          !isEmpty && (
            <button
              type="button"
              onClick={() => openCreate()}
              className={buttonVariants("primary", "sm", "hidden lg:inline-flex")}
            >
              <Plus className="size-3.5" />
              Nueva oportunidad
            </button>
          )
        }
      />

      {loading ? (
        <BoardSkeleton />
      ) : isEmpty ? (
        <EmptyBoard onCreate={() => openCreate()} />
      ) : (
        <>
          {moveError && (
            <div className="mx-4 mt-4 flex items-start justify-between gap-3 border border-error-500/20 bg-error-100 px-3.5 py-2.5 text-[13px] leading-snug text-error-700 lg:mx-6">
              <span>
                No se pudo mover la oportunidad. Revisa tu conexión e inténtalo
                de nuevo.
              </span>
              <button
                type="button"
                onClick={() => setMoveError(false)}
                aria-label="Descartar"
                className="shrink-0 text-error-700/70 transition-colors hover:text-error-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 py-4 lg:gap-4 lg:px-6 lg:py-5">
            {STAGE_ORDER.map((stage) => {
              const cfg = STAGES[stage];
              const cards = byStage[stage];
              const stat = stats[stage];
              return (
                <div
                  key={stage}
                  className={cn(
                    "flex w-[276px] shrink-0 flex-col border lg:w-auto lg:min-w-0 lg:flex-1",
                    cfg.colBorder
                  )}
                >
                  {/* Header de columna */}
                  <div
                    className={cn(
                      "shrink-0 border-b px-3.5 pb-2.5 pt-3",
                      cfg.colHeader,
                      cfg.colBorder
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {stage === "cerrado" && (
                          <CheckCircle2 className="size-3 shrink-0 text-success-500" />
                        )}
                        <span className="font-mono text-xs font-bold uppercase tracking-[0.01em]">
                          {cfg.label}
                        </span>
                        <span
                          className={cn(
                            "rounded-[2px] px-1.5 py-px font-mono text-[10px] font-bold",
                            cfg.colCount
                          )}
                        >
                          {stat.count}
                        </span>
                      </div>
                      {stage !== "cerrado" && (
                        <button
                          type="button"
                          onClick={() => openCreate(stage)}
                          aria-label={`Nueva oportunidad en ${cfg.label}`}
                          className="p-0.5 text-neutral-500 transition-colors hover:text-neutral-950"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <div
                      className={cn(
                        "font-mono text-sm font-bold",
                        stage === "cerrado"
                          ? "text-success-700"
                          : "text-neutral-950"
                      )}
                    >
                      ${MONEY_FMT.format(stat.total)}
                    </div>
                  </div>

                  {/* Cuerpo / zona de drop */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverStage !== stage) setDragOverStage(stage);
                    }}
                    onDrop={() => handleDrop(stage)}
                    className={cn(
                      "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5",
                      cfg.colBody,
                      dragOverStage === stage &&
                        "outline outline-2 -outline-offset-4 outline-dashed outline-brand-500"
                    )}
                  >
                    {cards.length > 0 ? (
                      cards.map((opp) => (
                        <OpportunityCard
                          key={opp._id}
                          opp={opp}
                          dragging={draggingId === opp._id}
                          onOpen={(clientId) => router.push(`/clientes/${clientId}`)}
                          onMenu={setMoveOpp}
                          onDragStart={setDraggingId}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverStage(null);
                          }}
                        />
                      ))
                    ) : (
                      <EmptyColumn stage={stage} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FAB (móvil) */}
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Nueva oportunidad"
            className="fixed bottom-20 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_4px_16px_rgba(201,138,10,0.4)] transition-[background-color,transform] hover:bg-brand-600 hover:scale-105 lg:hidden"
          >
            <Plus className="size-6" />
          </button>
        </>
      )}

      <MoverEtapaSheet
        open={moveOpp !== null}
        currentStage={moveOpp?.stage ?? null}
        stats={stats}
        onClose={() => setMoveOpp(null)}
        onMove={handleMove}
      />

      <RegistrarOportunidadSheet
        open={createOpen}
        initialStage={createStage}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}

const EMPTY_COL: Record<Stage, { icon?: LucideIcon; title: string; hint?: string }> = {
  interesado: { title: "Sin oportunidades aquí", hint: "Arrastra un trato aquí" },
  cotizado: {
    icon: Inbox,
    title: "Sin cotizaciones activas",
    hint: "Arrastra un trato aquí",
  },
  cerrado: { icon: Trophy, title: "Aún sin tratos cerrados" },
};

function EmptyColumn({ stage }: { stage: Stage }) {
  const cfg = STAGES[stage];
  const empty = EMPTY_COL[stage];
  const Icon = empty.icon;
  return (
    <div
      className={cn(
        "m-0.5 flex flex-col items-center gap-2 border-[1.5px] border-dashed px-4 py-7 text-center",
        cfg.colBorder
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-full",
            cfg.colHeader
          )}
        >
          <Icon className="size-4" />
        </div>
      )}
      <div className="text-xs text-neutral-400">{empty.title}</div>
      {empty.hint && <div className="text-[11px] text-neutral-300">{empty.hint}</div>}
    </div>
  );
}

function EmptyBoard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex size-[60px] items-center justify-center rounded-full bg-neutral-100">
        <Briefcase className="size-7 text-neutral-400" />
      </div>
      <h2 className="mb-2 font-mono text-lg font-semibold tracking-[-0.02em] text-neutral-950">
        Registra tu primera venta
      </h2>
      <p className="mb-6 max-w-[280px] text-sm leading-relaxed text-neutral-500">
        Agrega oportunidades para visualizar tu pipeline y mover tratos entre
        etapas.
      </p>
      <button type="button" onClick={onCreate} className={buttonVariants("primary", "lg")}>
        <Plus className="size-4" />
        Nueva oportunidad
      </button>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 py-4 lg:gap-4 lg:px-6 lg:py-5">
      {STAGE_ORDER.map((stage) => (
        <div
          key={stage}
          className="flex w-[276px] shrink-0 flex-col border border-neutral-200 lg:w-auto lg:flex-1"
        >
          <div className="h-[62px] shrink-0 animate-pulse border-b border-neutral-200 bg-neutral-100" />
          <div className="flex flex-col gap-2 p-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-[92px] animate-pulse bg-neutral-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
