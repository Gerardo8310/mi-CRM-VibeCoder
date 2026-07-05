"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/hoy/quick-parts";
import { AnotarInteractionSheet } from "@/components/clientes/anotar-interaction-sheet";
import { ClientHistory } from "@/components/clientes/client-history";
import { cn } from "@/lib/utils";

/** Pantalla 3 — Ficha de cliente (datos y edición). GER-11. */
export default function FichaClientePage() {
  const params = useParams<{ clientId: string }>();
  const clientId = Array.isArray(params.clientId)
    ? params.clientId[0]
    : params.clientId;

  const client = useQuery(
    api.clients.get,
    clientId ? { id: clientId } : "skip"
  );

  if (client === undefined) return <FichaSkeleton />;
  if (client === null) return <NotFound />;
  return <FichaContent client={client} />;
}

function FichaContent({ client }: { client: Doc<"clients"> }) {
  const update = useMutation(api.clients.update);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email ?? "");
  const [note, setNote] = useState(client.note ?? "");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [showAnotar, setShowAnotar] = useState(false);

  const nameError = submitted && name.trim().length === 0;
  const phoneError = submitted && phone.trim().length === 0;
  const telHref = `tel:${client.phone.replace(/[^\d+]/g, "")}`;
  const longNote = (client.note ?? "").length > 140;

  function startEdit() {
    setName(client.name);
    setPhone(client.phone);
    setEmail(client.email ?? "");
    setNote(client.note ?? "");
    setSubmitted(false);
    setErrorMsg(null);
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (name.trim().length === 0 || phone.trim().length === 0) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await update({
        id: client._id,
        name,
        phone,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
      });
      setEditing(false);
    } catch {
      setErrorMsg("No se pudieron guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header / breadcrumb */}
      <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 lg:h-14 lg:px-6">
        <Link
          href="/clientes"
          aria-label="Volver a clientes"
          className="flex shrink-0 items-center text-neutral-500 transition-colors hover:text-neutral-950"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link
            href="/clientes"
            className="shrink-0 font-mono text-[13px] text-neutral-400 transition-colors hover:text-neutral-600"
          >
            Clientes
          </Link>
          <ChevronRight className="size-3 shrink-0 text-neutral-300" />
          <span className="truncate font-mono text-[13px] font-medium text-neutral-950">
            {editing ? "Editar cliente" : client.name}
          </span>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-neutral-500 transition-colors hover:text-neutral-950"
          >
            <Pencil className="size-3.5" />
            <span className="font-mono text-xs font-medium">Editar</span>
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ════ Columna izquierda ════ */}
        <div className="bg-white lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-neutral-200">
          {editing ? (
            /* ── Modo edición ── */
            <div className="px-5 pt-5">
              <div className="mb-5 flex items-center gap-3 border-b border-neutral-100 pb-4">
                <Avatar name={client.name} size="md" className="size-12 text-sm" />
                <div>
                  <div className="font-mono text-sm font-semibold text-neutral-950">
                    {client.name}
                  </div>
                  <div className="text-xs text-neutral-400">Editando ficha</div>
                </div>
              </div>

              {errorMsg && (
                <p className="mb-4 text-[13px] leading-snug text-error-700">
                  {errorMsg}
                </p>
              )}

              <div className="flex flex-col gap-4">
                <Field label="Nombre" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={saving}
                    autoComplete="name"
                    className={editInputClass(nameError)}
                  />
                  {nameError && <RequiredError />}
                </Field>
                <Field label="Teléfono" required>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      disabled={saving}
                      className={cn(editInputClass(phoneError), "pl-9")}
                    />
                  </div>
                  {phoneError && <RequiredError />}
                </Field>
                <Field label="Correo" optional>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      disabled={saving}
                      className={cn(editInputClass(false), "pl-9")}
                    />
                  </div>
                </Field>
                <Field label="Nota" optional>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={saving}
                    rows={3}
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-2.5 border-t border-neutral-200 pt-4 pb-6">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="h-11 flex-1 border border-neutral-300 font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:opacity-45"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="flex h-11 flex-[2] items-center justify-center gap-1.5 border border-brand-500 bg-brand-500 font-mono text-[13px] font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-45"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Guardar cambios
                </button>
              </div>
            </div>
          ) : (
            /* ── Modo display ── */
            <>
              <div className="px-5 pt-6">
                <div className="mb-4 flex items-start gap-4">
                  <Avatar name={client.name} size="lg" />
                  <div className="flex-1 pt-0.5">
                    <h1 className="mb-2.5 font-mono text-xl font-semibold tracking-[-0.02em] text-neutral-950">
                      {client.name}
                    </h1>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-neutral-400" />
                      <span className="text-sm text-neutral-950">{client.phone}</span>
                      <a
                        href={telHref}
                        className="inline-block rounded-badge bg-brand-500 px-1.75 py-0.5 font-mono text-[9px] font-bold tracking-[0.06em] text-white transition-colors hover:bg-brand-600"
                      >
                        LLAMAR
                      </a>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-neutral-400" />
                        <a
                          href={`mailto:${client.email}`}
                          className="truncate text-[13px] text-brand-500 transition-colors hover:text-brand-600"
                        >
                          {client.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {client.note && (
                  <div className="mb-5 border-l-[3px] border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <p
                      className={cn(
                        "text-[13px] leading-relaxed text-neutral-600",
                        longNote && !noteExpanded && "line-clamp-3"
                      )}
                    >
                      {client.note}
                    </p>
                    {longNote && (
                      <button
                        type="button"
                        onClick={() => setNoteExpanded((v) => !v)}
                        className="mt-1 text-xs text-brand-500 transition-colors hover:text-brand-600"
                      >
                        {noteExpanded ? "Ver menos" : "Ver más"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Acciones directas — "Anotar" activo (Fase 3); "Registrar"/"Agendar" llegan en Fases 4/5 */}
              <div className="border-y border-neutral-100 px-5 py-4">
                <div className="flex gap-2">
                  <ActionButton
                    icon={MessageCircle}
                    label="Anotar"
                    amber
                    onClick={() => setShowAnotar(true)}
                  />
                  <ActionButton icon={CircleDollarSign} label="Registrar" disabled />
                  <ActionButton icon={CalendarPlus} label="Agendar" disabled />
                </div>
                <p className="mt-2 text-center text-[11px] text-neutral-400">
                  Registrar y agendar llegan pronto
                </p>
              </div>

              {/* Pendientes del cliente (Fase 5) */}
              <div className="px-5 py-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Clock className="size-3 text-neutral-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                    Pendientes
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-neutral-400">
                  Los seguimientos de este cliente aparecerán aquí (Fase 5).
                </p>
              </div>
            </>
          )}
        </div>

        {/* ════ Columna derecha — Historial (GER-13) ════ */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24 lg:px-8 lg:pt-6 lg:pb-10">
          <ClientHistory
            clientId={client._id}
            onAnotar={() => setShowAnotar(true)}
          />
        </div>
      </div>

      <AnotarInteractionSheet
        clientId={client._id}
        clientName={client.name}
        open={showAnotar}
        onClose={() => setShowAnotar(false)}
      />
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  amber = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  amber?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Disponible en las próximas fases" : undefined}
      className={cn(
        "flex h-[42px] flex-1 items-center justify-center gap-1.5 border font-mono text-xs font-medium",
        amber
          ? "border-brand-500/30 bg-brand-50 text-brand-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-600",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer transition-[filter] hover:brightness-95"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function editInputClass(error: boolean) {
  return cn(
    "h-11 w-full rounded-none border bg-white px-3 text-sm text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
    error ? "border-error-500" : "border-neutral-200"
  );
}

function RequiredError() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error-500">
      <AlertCircle className="size-3 shrink-0" />
      Este campo es requerido
    </p>
  );
}

function NotFound() {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 lg:h-14 lg:px-6">
        <Link
          href="/clientes"
          aria-label="Volver a clientes"
          className="flex items-center text-neutral-500 hover:text-neutral-950"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-mono text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          Cliente
        </h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="mb-2 font-mono text-base font-semibold text-neutral-950">
          Cliente no encontrado
        </h2>
        <p className="mb-6 max-w-[300px] text-sm leading-relaxed text-neutral-500">
          Este cliente no existe o el enlace es incorrecto.
        </p>
        <Link
          href="/clientes"
          className="inline-flex h-11 items-center gap-1.5 border border-neutral-300 px-5 font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4"
        >
          Volver a clientes
        </Link>
      </div>
    </>
  );
}

function FichaSkeleton() {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center border-b border-neutral-200 bg-white px-4 lg:h-14 lg:px-6">
        <div className="h-4 w-40 animate-pulse bg-neutral-200" />
      </header>
      <div className="animate-pulse px-5 pt-6">
        <div className="flex items-start gap-4">
          <div className="size-16 shrink-0 rounded-full bg-neutral-200" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="h-5 w-40 bg-neutral-200" />
            <div className="h-3.5 w-48 bg-neutral-100" />
            <div className="h-3.5 w-36 bg-neutral-100" />
          </div>
        </div>
      </div>
    </>
  );
}
