"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { TrendingUp } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_LIST, type Stage } from "@/lib/opportunity-stages";
import { Input, Textarea } from "@/components/ui/input";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { ClientCombobox } from "@/components/hoy/client-combobox";
import { Field } from "@/components/hoy/quick-parts";

/**
 * Registrar oportunidad (GER-14). Panel compartido por dos entradas:
 * - Ficha del cliente ("Registrar"): `fixedClientId` → sin selector de cliente.
 * - Tablero de ventas ("Nueva oportunidad" / "+" de columna): elige cliente con
 *   `ClientCombobox`, y `initialStage` fija la etapa inicial (la de esa columna).
 *
 * Etapa por defecto "interesado". El botón de guardar cambia a "Registrar venta
 * cerrada" (verde) cuando la etapa es *cerrado*. El formulario se reinicia cada
 * vez que se abre, para no arrastrar la etapa/valores de una apertura anterior.
 */
export function RegistrarOportunidadSheet({
  fixedClientId = null,
  initialStage,
  open,
  onClose,
}: {
  fixedClientId?: Id<"clients"> | null;
  initialStage?: Stage;
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.opportunities.create);
  const [stage, setStage] = useState<Stage>(initialStage ?? "interesado");
  const [selectedClientId, setSelectedClientId] =
    useState<Id<"clients"> | null>(null);
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reiniciar el formulario en cada apertura (auditoría · Mayor 3). Patrón de
  // "ajustar estado durante el render" en la transición de open — evita un
  // useEffect con setState (react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStage(initialStage ?? "interesado");
      setSelectedClientId(null);
      setProduct("");
      setAmount("");
      setNote("");
      setError(null);
    }
  }

  const clientId = fixedClientId ?? selectedClientId;
  const amountValue = Number(amount.replace(/[^\d.]/g, ""));
  const canSave =
    clientId !== null && product.trim().length > 0 && amountValue > 0;
  const stageConfig = STAGES[stage];
  const isCerrado = stage === "cerrado";

  function close() {
    if (saving) return;
    onClose();
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
        product,
        note: note.trim() || undefined,
      });
      onClose(); // el formulario se reinicia en la próxima apertura
    } catch {
      setError("No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <QuickSheet
      open={open}
      onClose={close}
      icon={<TrendingUp className="size-3 text-brand-500" />}
      iconWrapClass="bg-warning-100"
      title="Registrar oportunidad"
      footer={
        <SheetFooter
          onCancel={close}
          onSave={handleSave}
          saving={saving}
          canSave={canSave}
          saveLabel={isCerrado ? "Registrar venta cerrada" : "Guardar oportunidad"}
          saveIcon={<TrendingUp className="size-3.5" />}
          saveClass={
            isCerrado
              ? "border-success-500 bg-success-500 hover:bg-success-700"
              : undefined
          }
        />
      }
    >
      <div className="px-4 py-4">
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
                  disabled={saving}
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

          {!fixedClientId && (
            <Field label="Cliente" required>
              <ClientCombobox
                selectedId={selectedClientId}
                onSelect={(id) => setSelectedClientId(id)}
              />
            </Field>
          )}

          <Field label="Producto o servicio" required>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              disabled={saving}
              placeholder="Plan Pro Anual, consultoría, soporte…"
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
                disabled={saving}
                inputMode="numeric"
                placeholder="48,000"
                className="pl-6 font-mono font-semibold"
              />
            </div>
          </Field>

          <Field label="Nota" optional>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              rows={2}
              placeholder="Presentó interés en el plan anual. Necesita aprobación de dirección."
            />
          </Field>
        </div>
      </div>
    </QuickSheet>
  );
}
