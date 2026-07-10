"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ArrowRight, Check, CircleDollarSign, TrendingUp } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  STAGES,
  STAGE_LIST,
  type Stage,
} from "@/lib/opportunity-stages";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { ClientCombobox } from "@/components/hoy/client-combobox";
import {
  Field,
  QuickBlockLabel,
  QuickTrigger,
  RepeatButton,
} from "@/components/hoy/quick-parts";

type Saved = { name: string; amount: number; stage: Stage };

/** Venta rápida desde "Hoy" (GER-50) — reutiliza opportunities.create. */
export function QuickAddSale() {
  const create = useMutation(api.opportunities.create);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("cotizado");
  const [clientId, setClientId] = useState<Id<"clients"> | null>(null);
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const amountValue = Number(amount.replace(/[^\d.]/g, ""));
  const canSave =
    clientId !== null && amountValue > 0 && product.trim().length > 0;
  const stageConfig = STAGES[stage];

  function resetForm() {
    setStage("cotizado");
    setClientId(null);
    setClientName("");
    setAmount("");
    setProduct("");
    setError(null);
  }

  async function handleSave() {
    if (!canSave || !clientId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        clientId,
        stage,
        amount: amountValue,
        product: product.trim(),
      });
      setSaved({ name: clientName, amount: amountValue, stage });
      setOpen(false);
      resetForm();
    } catch {
      setError("No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const savedStage = saved ? STAGES[saved.stage] : null;
  const isCerrado = stage === "cerrado";

  return (
    <div>
      <QuickBlockLabel
        icon={<TrendingUp className="size-[11px]" />}
        iconWrapClass="bg-warning-100 text-brand-500"
        label="Venta rápida"
      />

      {saved && savedStage ? (
        <div>
          <div className="flex items-center gap-2.5 border border-brand-500/25 bg-white px-3.5 py-3">
            <Avatar name={saved.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-neutral-950">
                {saved.name} ·{" "}
                <span className="font-mono font-bold text-brand-500">
                  ${saved.amount.toLocaleString("es-MX")}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <span
                  className={cn(
                    "rounded-badge px-1.5 py-px text-[11px] font-medium",
                    savedStage.badge
                  )}
                >
                  {savedStage.label}
                </span>
                <span className="text-[11px] text-neutral-400"> · Ahora</span>
              </div>
            </div>
            <Link
              href="/ventas"
              className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold text-brand-500 hover:text-brand-600"
            >
              Ver tablero <ArrowRight className="size-[11px]" />
            </Link>
          </div>
          <RepeatButton
            onClick={() => {
              setSaved(null);
              setOpen(true);
            }}
            label="Anotar otra venta"
          />
        </div>
      ) : (
        <QuickTrigger
          onClick={() => setOpen(true)}
          icon={<CircleDollarSign className="size-3.5" />}
          iconWrapClass="bg-warning-100 text-brand-500"
          title="¿Cerraste o cotizaste algo?"
          subtitle="Registra cliente, monto y etapa al instante"
          borderClass="border-[#F0E8D0]"
        />
      )}

      <QuickSheet
        open={open}
        onClose={() => setOpen(false)}
        icon={<TrendingUp className="size-3 text-brand-500" />}
        iconWrapClass="bg-warning-100"
        title="Venta rápida"
        footer={
          <SheetFooter
            onCancel={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            canSave={canSave}
            saveLabel={isCerrado ? "Registrar venta cerrada" : "Guardar oportunidad"}
            saveIcon={<Check className="size-3.5" />}
            saveClass={
              isCerrado
                ? "border-success-500 bg-success-500 hover:bg-success-700"
                : undefined
            }
          />
        }
      >
        <div className="px-4 py-4">
          <p className="mb-4 text-[13px] leading-normal text-neutral-500">
            Anota el trato ahora — aparecerá en el tablero de ventas.
          </p>
          {error && (
            <p className="mb-3 text-[13px] leading-snug text-error-700">{error}</p>
          )}
          <div className="flex flex-col gap-3.5">
            <Field label="Etapa" required>
              <div className="flex">
                {STAGE_LIST.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStage(s.key)}
                    className={cn(
                      "-ml-px h-[38px] flex-1 border border-neutral-300 font-mono text-[11px] font-medium text-neutral-500 transition-colors first:ml-0 hover:bg-neutral-950/4",
                      stage === s.key && s.segOn
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-neutral-400">
                {stageConfig.desc}
              </div>
            </Field>

            <Field label="Cliente" required>
              <ClientCombobox
                selectedId={clientId}
                onSelect={(id, name) => {
                  setClientId(id);
                  setClientName(name);
                }}
              />
            </Field>

            <Field label="Monto" required>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] font-medium text-neutral-400">
                  $
                </span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  placeholder="32,000"
                  className="pl-6 font-mono font-semibold"
                />
              </div>
            </Field>

            <Field label="Producto" required>
              <Input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Plan Pro Anual, consultoría…"
              />
            </Field>
          </div>
        </div>
      </QuickSheet>
    </div>
  );
}
