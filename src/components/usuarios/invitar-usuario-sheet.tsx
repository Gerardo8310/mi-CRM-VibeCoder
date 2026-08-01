"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { api } from "@convex/_generated/api";
// La MISMA función que usa el servidor, no una copia. `convex/email.ts` no
// importa nada, así que el cliente puede traérsela por el alias `@convex/*` sin
// arrastrar `@convex-dev/auth` al bundle — el mismo truco que `authConstants.ts`.
import { looksLikeEmail, normalizeEmail } from "@convex/email";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { Field } from "@/components/hoy/quick-parts";
import { RoleCards, type Role } from "@/components/usuarios/role-cards";

/**
 * Panel "Invitar usuario" (GER-48). Ver Design/GestionUsuarios.dc.html.
 *
 * EL AVISO NO DICE LO QUE DICE LA MAQUETA, Y ES A PROPÓSITO
 *
 * Allí pone "El usuario creará su contraseña desde el enlace recibido". No hay
 * enlace: los filtros de correo corporativos abren los enlaces antes que el
 * destinatario y queman los tokens de un solo uso, así que la invitación manda
 * a la persona a escribir su correo en el login y el código llega después. Dejar
 * la frase de la maqueta sería prometer algo que no ocurre — ver la cabecera de
 * convex/invitations.ts.
 *
 * QUÉ PASA CUANDO EL CORREO NO SALE
 *
 * `invite` no lanza si la ficha ya se creó: devuelve `correoEnviado: false`. El
 * panel entonces **no se cierra** y lo dice, porque cerrarlo dejaría a la dueña
 * creyendo que la persona ya recibió su invitación. Desde la lista puede
 * reenviarla.
 */
export function InvitarUsuarioSheet({ onClose }: { onClose: () => void }) {
  const invite = useAction(api.invitations.invite);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("vendedor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correoFallido, setCorreoFallido] = useState(false);

  const completo = name.trim().length > 0 && email.trim().length > 0;

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleInvite() {
    if (saving || !completo) return;
    // Se comprueba aquí ADEMÁS de en el servidor, y no es redundancia inútil:
    // en producción Convex redacta el texto de cualquier error, así que el
    // mensaje exacto del servidor no llega al navegador y esta pantalla solo
    // podría decir algo genérico. La autoridad sigue siendo `createInvitedUser`;
    // esto es para poder decir QUÉ está mal.
    if (!looksLikeEmail(normalizeEmail(email))) {
      setError("Ese correo no tiene forma de correo. Revísalo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { correoEnviado } = await invite({ name, email, role });
      if (correoEnviado) {
        onClose();
        return;
      }
      // La ficha existe; lo que falló fue el envío. Se queda a la vista.
      setCorreoFallido(true);
    } catch {
      // Aquí sí no se creó nada: los rechazos de `createInvitedUser` —correo
      // repetido, nombre vacío, quien llama no es dueña— llegan por esta vía.
      //
      // El texto es genérico porque **no se sabe cuál de ellos fue**: en
      // producción Convex redacta el mensaje del error y el cuerpo llega como
      // "Server Error", sin detalle. Se nombra la causa de lejos más probable.
      setError(
        "No se pudo crear la invitación. Puede que ese correo ya esté en la lista."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open
      onClose={close}
      title="Invitar usuario"
      footer={
        correoFallido ? (
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4"
          >
            Entendido
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="h-11 flex-1 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={saving || !completo}
              className="flex h-11 flex-[2] items-center justify-center gap-1.75 border border-brand-500 bg-brand-500 font-mono text-[13px] font-medium text-white transition-colors hover:border-brand-600 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Enviar invitación
            </button>
          </>
        )
      }
    >
      {correoFallido ? (
        <div className="flex items-start gap-2.5 border border-error-500/30 bg-error-100 p-3.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-error-500" />
          <p className="text-[13px] leading-relaxed text-error-700">
            La cuenta de <strong className="font-semibold">{name.trim()}</strong>{" "}
            se creó, pero el correo de invitación no pudo enviarse. Aparecerá en
            la lista como “Sin contraseña”: entra en su ficha y usa{" "}
            <strong className="font-semibold">Reenviar invitación</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5.5 flex items-start gap-2.25 border border-brand-500/25 bg-brand-50 p-3.5">
            <Mail className="mt-px size-3.5 shrink-0 text-brand-500" />
            <p className="text-[13px] leading-relaxed text-brand-700">
              Se enviará un correo de invitación. La persona entrará al CRM con
              su correo y le mandaremos un código para que elija su contraseña.
            </p>
          </div>

          {error && (
            <p className="mb-4 text-[13px] leading-snug text-error-700">
              {error}
            </p>
          )}

          {/*
            Sin `autoFocus`, y no es un olvido: al abrir, el foco va al propio
            panel (`useDialogDismiss`), que es lo que hace que un lector de
            pantalla anuncie el diálogo y que Escape funcione desde el primer
            momento. Se probó con `autoFocus` aquí y el contenedor se lo lleva
            igual, así que el atributo solo documentaba una intención que no se
            cumplía. Desde el panel, un Tab llega a este campo.
          */}
          <div className="mb-4">
            <Field label="Nombre completo" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sofía Ramírez"
                disabled={saving}
              />
            </Field>
          </div>

          <div className="mb-5">
            <Field label="Correo electrónico" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sofia@empresa.mx"
                  disabled={saving}
                  className="pl-8.5"
                />
              </div>
            </Field>
          </div>

          <div className="mb-6">
            <label className="mb-2.5 block font-sans text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-600">
              Rol
            </label>
            <RoleCards value={role} onChange={setRole} disabled={saving} />
          </div>
        </>
      )}
    </SidePanel>
  );
}
