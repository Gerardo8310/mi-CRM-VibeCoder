"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ArrowRight, Plus, UserCheck, UserPlus } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import {
  Field,
  QuickBlockLabel,
  QuickTrigger,
  RepeatButton,
} from "@/components/hoy/quick-parts";

type Saved = { id: Id<"clients">; name: string; phone: string };

/** Alta rápida de cliente desde "Hoy" (GER-50) — reutiliza clients.create. */
export function QuickAddClient() {
  const create = useMutation(api.clients.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const canSave = name.trim().length > 0 && phone.trim().length > 0;

  function resetForm() {
    setName("");
    setPhone("");
    setNote("");
    setError(null);
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await create({
        name,
        phone,
        note: note.trim() || undefined,
      });
      setSaved({ id, name: name.trim(), phone: phone.trim() });
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
        icon={<UserPlus className="size-[11px]" />}
        iconWrapClass="bg-neutral-100 text-neutral-500"
        label="Alta rápida"
      />

      {saved ? (
        <div>
          <div className="flex items-center gap-2.5 border border-success-500/25 bg-white px-3.5 py-3">
            <Avatar name={saved.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-neutral-950">
                {saved.name} guardado
              </div>
              <div className="text-xs text-neutral-500">
                {saved.phone} · Ahora
              </div>
            </div>
            <Link
              href={`/clientes/${saved.id}`}
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
            label="Anotar otro cliente"
          />
        </div>
      ) : (
        <QuickTrigger
          onClick={() => setOpen(true)}
          icon={<Plus className="size-3.5" />}
          iconWrapClass="bg-neutral-100 text-neutral-500 group-hover:bg-warning-100 group-hover:text-brand-500"
          title="¿Conociste a alguien hoy?"
          subtitle="Anota nombre y teléfono en segundos"
        />
      )}

      <QuickSheet
        open={open}
        onClose={() => setOpen(false)}
        icon={<UserPlus className="size-3 text-brand-700" />}
        iconWrapClass="bg-brand-50"
        title="Alta rápida"
        footer={
          <SheetFooter
            onCancel={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            canSave={canSave}
            saveLabel="Guardar cliente"
            saveIcon={<UserCheck className="size-3.5" />}
          />
        }
      >
        <div className="px-4 py-4">
          <p className="mb-4 text-[13px] leading-normal text-neutral-500">
            Guarda los datos mientras hablas — completa la ficha después.
          </p>
          {error && (
            <p className="mb-3 text-[13px] leading-snug text-error-700">{error}</p>
          )}
          <div className="flex flex-col gap-3.5">
            <Field label="Nombre" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sofía Ramírez"
                autoFocus
              />
            </Field>
            <Field label="Teléfono" required>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="+52 55 0000 0000"
              />
            </Field>
            <Field label="Nota" optional>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Interesada en el plan Pro, trabaja en retail…"
              />
            </Field>
          </div>
        </div>
      </QuickSheet>
    </div>
  );
}
