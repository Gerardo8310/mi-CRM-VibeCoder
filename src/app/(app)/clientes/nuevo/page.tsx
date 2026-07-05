"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { AlertCircle, ArrowLeft, Loader2, Mail, Phone, UserCheck, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/hoy/quick-parts";

/** Pantalla 2 — Nuevo cliente (GER-9). Overlay: full-screen móvil / panel 400px escritorio. */
export default function NuevoClientePage() {
  const router = useRouter();
  const create = useMutation(api.clients.create);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validación al enviar (los botones nunca se deshabilitan por campos vacíos).
  const nameError = submitted && name.trim().length === 0;
  const phoneError = submitted && phone.trim().length === 0;

  function close() {
    if (saving) return; // no salir a media escritura
    router.push("/clientes");
  }

  async function handleSave() {
    if (saving) return;
    setSubmitted(true);
    setErrorMsg(null);
    if (name.trim().length === 0 || phone.trim().length === 0) return;
    setSaving(true);
    try {
      const id = await create({
        name,
        phone,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
      });
      router.push(`/clientes/${id}`);
    } catch {
      setErrorMsg("No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSave();
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Overlay (solo escritorio) */}
      <div
        onClick={close}
        className="absolute inset-0 hidden bg-[rgba(17,16,14,0.45)] lg:block"
      />
      {/* Panel */}
      <form
        onSubmit={onSubmit}
        className="absolute inset-0 flex flex-col bg-white lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[400px] lg:shadow-[-8px_0_32px_rgba(17,16,14,0.14)]"
      >
        {/* Header */}
        <header className="flex h-13 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 lg:h-[58px] lg:px-5">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Cerrar"
            className="flex shrink-0 items-center text-neutral-500 transition-colors hover:text-neutral-950 disabled:opacity-45"
          >
            <ArrowLeft className="size-5 lg:hidden" />
            <X className="hidden size-[18px] lg:block" />
          </button>
          <h1 className="flex-1 font-mono text-base font-semibold tracking-[-0.01em] text-neutral-950">
            Nuevo cliente
          </h1>
          {/* Guardar en header (solo móvil) — habilitado salvo saving */}
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 font-mono text-[13px] font-semibold text-brand-500 transition-colors disabled:cursor-not-allowed disabled:text-neutral-400 lg:hidden"
          >
            Guardar
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pt-7 lg:px-5">
          {errorMsg && (
            <p className="mb-4 text-[13px] leading-snug text-error-700">{errorMsg}</p>
          )}
          <div className="flex flex-col gap-5">
            <Field label="Nombre" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                autoFocus
                autoComplete="name"
                placeholder="Ej. Sofía Ramírez"
                className={fieldClass(nameError)}
              />
              {nameError && <RequiredError />}
            </Field>

            <Field label="Teléfono" required>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-neutral-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={saving}
                  placeholder="+52 55 0000 0000"
                  className={cn(fieldClass(phoneError), "pl-9")}
                />
              </div>
              {phoneError && <RequiredError />}
            </Field>

            <Field label="Correo" optional>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-neutral-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  disabled={saving}
                  placeholder="correo@empresa.mx"
                  className={cn(fieldClass(false), "pl-9")}
                />
              </div>
            </Field>

            <Field label="Nota" optional>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
                rows={3}
                placeholder="Algo que quieras recordar..."
              />
              <p className="mt-1.5 text-[11px] text-neutral-400">Solo tú puedes verla</p>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-neutral-200 px-4 pt-3 pb-7 lg:flex lg:gap-2.5 lg:px-5 lg:pt-4 lg:pb-6">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="hidden h-12 flex-1 border border-neutral-300 font-mono text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:opacity-45 lg:block"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-1.5 border border-brand-500 bg-brand-500 font-mono text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45 lg:flex-1"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserCheck className="size-3.5" />
            )}
            {saving ? "Guardando..." : "Guardar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}

function fieldClass(error: boolean) {
  return cn(
    "h-12 w-full rounded-none border bg-white px-3 text-[15px] text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
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
