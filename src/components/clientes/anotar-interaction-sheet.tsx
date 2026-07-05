"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, MessageCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { timestampFromDateInput } from "@/lib/dates";
import { INTERACTION_TYPES, type IntType } from "@/lib/interaction-types";
import { Input, Textarea } from "@/components/ui/input";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { Field } from "@/components/hoy/quick-parts";

/**
 * Panel "Anotar interacción" desde la ficha del cliente (GER-12). Reutiliza el
 * mismo panel rápido de "Hoy" (QuickSheet), pero con el cliente ya fijado — sin
 * selector de cliente. Al guardar, la interacción aparece al instante en el
 * historial (GER-13) por la reactividad de Convex.
 */
export function AnotarInteractionSheet({
  clientId,
  open,
  onClose,
}: {
  clientId: Id<"clients">;
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.interactions.create);
  const [type, setType] = useState<IntType>("llamada");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = text.trim().length > 0;
  const typeConfig = INTERACTION_TYPES.find((t) => t.key === type)!;

  function resetForm() {
    setType("llamada");
    setText("");
    setDate("");
    setError(null);
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        clientId,
        type,
        text,
        // Medianoche local del día elegido (o ahora, si no se indicó fecha).
        date: date ? timestampFromDateInput(date) : undefined,
      });
      // Solo limpiar tras éxito — en error se conserva lo escrito.
      resetForm();
      onClose();
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
      icon={<MessageCircle className="size-3 text-brand-700" />}
      iconWrapClass="bg-brand-50"
      title="Anotar interacción"
      footer={
        <SheetFooter
          onCancel={close}
          onSave={handleSave}
          saving={saving}
          canSave={canSave}
          saveLabel="Guardar nota"
          saveIcon={<Check className="size-3.5" />}
        />
      }
    >
      <div className="px-4 py-4">
        <p className="mb-4 text-[13px] leading-normal text-neutral-500">
          Registra la conversación en segundos — queda en el historial del
          cliente.
        </p>
        {error && (
          <p className="mb-3 text-[13px] leading-snug text-error-700">{error}</p>
        )}
        <div className="flex flex-col gap-3.5">
          <Field label="¿Qué pasó?" required>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              rows={3}
              autoFocus
              placeholder="Habló del presupuesto. Pidió cotización formal para el jueves..."
            />
          </Field>

          <Field label="Tipo" required>
            <div className="flex">
              {INTERACTION_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    disabled={saving}
                    className={cn(
                      "-ml-px flex h-[38px] flex-1 items-center justify-center gap-1 border border-neutral-300 font-mono text-[11px] font-medium text-neutral-500 transition-colors first:ml-0 hover:bg-neutral-950/4 disabled:cursor-not-allowed",
                      type === t.key && t.onClass
                    )}
                  >
                    <Icon className="size-[11px]" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 text-[11px] text-neutral-400">
              {typeConfig.desc}
            </div>
          </Field>

          <Field label="Fecha" optional>
            <Input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              type="date"
              className="text-neutral-500"
            />
          </Field>
        </div>
      </div>
    </QuickSheet>
  );
}
