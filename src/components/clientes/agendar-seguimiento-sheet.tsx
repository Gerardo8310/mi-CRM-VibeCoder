"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { timestampFromDateInput } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { Field } from "@/components/hoy/quick-parts";
import { OpportunitySelect } from "@/components/seguimientos/opportunity-select";

/**
 * Panel "Agendar seguimiento" desde la ficha del cliente (GER-16). Reutiliza el
 * panel rápido (QuickSheet) con el **cliente ya fijado** — sin selector de
 * cliente. Al guardar, el pendiente aparece al instante en la ficha, en "Hoy" y
 * en la insignia de la nav (reactividad de Convex).
 */
export function AgendarSeguimientoSheet({
  clientId,
  open,
  onClose,
}: {
  clientId: Id<"clients">;
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.followUps.create);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueDate = date ? timestampFromDateInput(date) : undefined;
  const canSave = note.trim().length > 0 && dueDate !== undefined;

  function resetForm() {
    setNote("");
    setDate("");
    setOpportunityId("");
    setError(null);
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSave() {
    if (!canSave || saving || dueDate === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        clientId,
        note,
        dueDate,
        opportunityId: opportunityId
          ? (opportunityId as Id<"opportunities">)
          : undefined,
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
      icon={<CalendarClock className="size-3 text-brand-700" />}
      iconWrapClass="bg-brand-50"
      title="Agendar seguimiento"
      footer={
        <SheetFooter
          onCancel={close}
          onSave={handleSave}
          saving={saving}
          canSave={canSave}
          saveLabel="Guardar seguimiento"
          saveIcon={<CalendarCheck className="size-3.5" />}
        />
      }
    >
      <div className="px-4 py-4">
        <p className="mb-4 text-[13px] leading-normal text-neutral-500">
          Ponle fecha a lo que sigue — te lo recordamos en &quot;Hoy&quot; cuando
          toque.
        </p>
        {error && (
          <p className="mb-3 text-[13px] leading-snug text-error-700">{error}</p>
        )}
        <div className="flex flex-col gap-3.5">
          <Field label="¿Qué hacer?" required>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              autoFocus
              placeholder="Llamar para confirmar la demo del jueves..."
            />
          </Field>

          <Field label="Fecha" required>
            <Input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              type="date"
              className="text-neutral-500"
            />
          </Field>

          <Field label="Oportunidad" optional>
            <OpportunitySelect
              clientId={clientId}
              value={opportunityId}
              onChange={setOpportunityId}
              disabled={saving}
            />
          </Field>
        </div>
      </div>
    </QuickSheet>
  );
}
