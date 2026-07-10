"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ArrowRight, CalendarCheck, CalendarClock } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { timestampFromDateInput } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { ClientCombobox } from "@/components/hoy/client-combobox";
import { OpportunitySelect } from "@/components/seguimientos/opportunity-select";
import {
  Field,
  QuickBlockLabel,
  QuickTrigger,
  RepeatButton,
} from "@/components/hoy/quick-parts";

type Saved = { clientId: Id<"clients">; name: string; note: string };

/**
 * Acceso rápido "nueva tarea" desde "Hoy" (GER-16) — programa un seguimiento.
 * A diferencia de la ficha, aquí hay que **elegir el cliente** (ClientCombobox).
 * Reutiliza followUps.create.
 */
export function QuickAddFollowUp() {
  const create = useMutation(api.followUps.create);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<Id<"clients"> | null>(null);
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const dueDate = date ? timestampFromDateInput(date) : undefined;
  const canSave =
    clientId !== null && note.trim().length > 0 && dueDate !== undefined;

  function resetForm() {
    setClientId(null);
    setClientName("");
    setNote("");
    setDate("");
    setOpportunityId("");
    setError(null);
  }

  // Al cambiar de cliente se limpia la oportunidad: era del cliente anterior y
  // el backend rechazaría un vínculo que no le pertenece.
  function handleSelectClient(id: Id<"clients"> | null, name: string) {
    setClientId(id);
    setClientName(name);
    setOpportunityId("");
  }

  function close() {
    if (saving) return; // no cerrar a media escritura
    setOpen(false);
  }

  async function handleSave() {
    if (!canSave || !clientId || saving || dueDate === undefined) return;
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
      setSaved({ clientId, name: clientName, note: note.trim() });
      setOpen(false);
      resetForm();
    } catch {
      setError("No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <QuickBlockLabel
        icon={<CalendarClock className="size-[11px]" />}
        iconWrapClass="bg-brand-50 text-brand-700"
        label="Seguimiento"
      />

      {saved ? (
        <div>
          <div className="flex items-start gap-2.5 border border-brand-500/20 bg-white px-3.5 py-3">
            <Avatar name={saved.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[13px] font-medium text-neutral-950">
                {saved.name}
              </div>
              <div className="truncate text-xs text-neutral-500">{saved.note}</div>
            </div>
            <Link
              href={`/clientes/${saved.clientId}`}
              className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold text-brand-500 hover:text-brand-600"
            >
              Ver ficha <ArrowRight className="size-[11px]" />
            </Link>
          </div>
          <RepeatButton
            onClick={() => {
              setSaved(null);
              setOpen(true);
            }}
            label="Agendar otro seguimiento"
          />
        </div>
      ) : (
        <QuickTrigger
          onClick={() => setOpen(true)}
          icon={<CalendarClock className="size-3.5" />}
          iconWrapClass="bg-brand-50 text-brand-700"
          title="¿Algo pendiente por hacer?"
          subtitle="Agenda un recordatorio y no lo pierdas"
          borderClass="border-brand-500/20"
        />
      )}

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
            Ponle fecha a lo que sigue — te lo recordamos en &quot;Hoy&quot;
            cuando toque.
          </p>
          {error && (
            <p className="mb-3 text-[13px] leading-snug text-error-700">{error}</p>
          )}
          <div className="flex flex-col gap-3.5">
            <Field label="Cliente" required>
              <ClientCombobox
                selectedId={clientId}
                onSelect={handleSelectClient}
              />
            </Field>

            <Field label="¿Qué hacer?" required>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
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
    </div>
  );
}
