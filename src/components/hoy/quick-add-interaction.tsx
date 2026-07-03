"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { timestampFromDateInput } from "@/lib/dates";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { QuickSheet, SheetFooter } from "@/components/hoy/quick-sheet";
import { ClientCombobox } from "@/components/hoy/client-combobox";
import {
  Field,
  QuickBlockLabel,
  QuickTrigger,
  RepeatButton,
} from "@/components/hoy/quick-parts";

type IntType = "llamada" | "mensaje" | "visita";

const TYPES: {
  key: IntType;
  label: string;
  icon: LucideIcon;
  onClass: string;
  badge: string;
  desc: string;
}[] = [
  {
    key: "llamada",
    label: "Llamada",
    icon: Phone,
    onClass: "bg-info-100 border-info-700/35 text-info-700 font-bold",
    badge: "bg-info-100 text-info-700",
    desc: "Conversación telefónica o videollamada",
  },
  {
    key: "mensaje",
    label: "Mensaje",
    icon: MessageCircle,
    onClass: "bg-brand-50 border-brand-500/45 text-brand-700 font-bold",
    badge: "bg-brand-50 text-brand-700",
    desc: "WhatsApp, SMS o correo electrónico",
  },
  {
    key: "visita",
    label: "Visita",
    icon: MapPin,
    onClass: "bg-success-100 border-success-500/35 text-success-700 font-bold",
    badge: "bg-success-100 text-success-700",
    desc: "Reunión presencial o en sus oficinas",
  },
];

type Saved = {
  clientId: Id<"clients">;
  name: string;
  type: IntType;
  text: string;
};

/** Interacción rápida desde "Hoy" (GER-50) — reutiliza interactions.create. */
export function QuickAddInteraction() {
  const create = useMutation(api.interactions.create);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IntType>("llamada");
  const [clientId, setClientId] = useState<Id<"clients"> | null>(null);
  const [clientName, setClientName] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const canSave = clientId !== null && text.trim().length > 0;
  const typeConfig = TYPES.find((t) => t.key === type)!;

  function resetForm() {
    setType("llamada");
    setClientId(null);
    setClientName("");
    setText("");
    setDate("");
    setError(null);
  }

  async function handleSave() {
    if (!canSave || !clientId || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Medianoche local del día elegido (o ahora, si no se indicó fecha).
      await create({
        clientId,
        type,
        text,
        date: date ? timestampFromDateInput(date) : undefined,
      });
      setSaved({ clientId, name: clientName, type, text: text.trim() });
      setOpen(false);
      resetForm();
    } catch {
      setError("No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const savedType = saved ? TYPES.find((t) => t.key === saved.type)! : null;

  return (
    <div>
      <QuickBlockLabel
        icon={<MessageCircle className="size-[11px]" />}
        iconWrapClass="bg-info-100 text-info-700"
        label="Interacción"
      />

      {saved && savedType ? (
        <div>
          <div className="flex items-start gap-2.5 border border-info-700/20 bg-white px-3.5 py-3">
            <Avatar name={saved.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-medium text-neutral-950">
                  {saved.name}
                </span>
                <span
                  className={cn(
                    "rounded-badge px-1.5 py-px text-[11px] font-medium",
                    savedType.badge
                  )}
                >
                  {savedType.label}
                </span>
              </div>
              <div className="truncate text-xs text-neutral-500">
                {saved.text}
              </div>
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
            label="Anotar otra interacción"
          />
        </div>
      ) : (
        <QuickTrigger
          onClick={() => setOpen(true)}
          icon={<MessageCircle className="size-3.5" />}
          iconWrapClass="bg-info-100 text-info-700"
          title="¿Hablaste con alguien?"
          subtitle="Anota qué pasó para no perder el hilo"
          borderClass="border-info-700/20"
        />
      )}

      <QuickSheet
        open={open}
        onClose={() => setOpen(false)}
        icon={<MessageCircle className="size-3 text-info-700" />}
        iconWrapClass="bg-info-100"
        title="Anotar interacción"
        footer={
          <SheetFooter
            onCancel={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            canSave={canSave}
            saveLabel="Guardar interacción"
            saveIcon={<Check className="size-3.5" />}
            saveClass="border-info-700 bg-info-700 hover:bg-info-700/90"
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
            <Field label="Tipo" required>
              <div className="flex">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={cn(
                        "-ml-px flex h-[38px] flex-1 items-center justify-center gap-1 border border-neutral-300 font-mono text-[11px] font-medium text-neutral-500 transition-colors first:ml-0 hover:bg-neutral-950/4",
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

            <Field label="Cliente" required>
              <ClientCombobox
                selectedId={clientId}
                onSelect={(id, name) => {
                  setClientId(id);
                  setClientName(name);
                }}
              />
            </Field>

            <Field label="¿Qué pasó?" required>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Pidió demo por WhatsApp para el viernes. Tiene presupuesto aprobado."
              />
            </Field>

            <Field label="Fecha" optional>
              <Input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                className="text-neutral-500"
              />
            </Field>
          </div>
        </div>
      </QuickSheet>
    </div>
  );
}
