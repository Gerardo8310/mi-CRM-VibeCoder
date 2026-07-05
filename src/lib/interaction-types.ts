import type { LucideIcon } from "lucide-react";
import { MapPin, MessageCircle, Phone } from "lucide-react";

/**
 * Config de los tres tipos de interacción (llamada / mensaje / visita) — icono,
 * etiqueta y estilos del selector segmentado y de la insignia. Fuente única que
 * comparten el alta rápida de "Hoy" (GER-50) y el panel "Anotar" de la ficha
 * (GER-12). **Solo frontend** (exporta iconos de lucide-react): no importar
 * desde Convex/backend.
 */
export type IntType = "llamada" | "mensaje" | "visita";

export type InteractionTypeConfig = {
  key: IntType;
  label: string;
  icon: LucideIcon;
  /** Estilo del botón segmentado cuando está activo. */
  onClass: string;
  /** Estilo de la insignia (chip) del tipo. */
  badge: string;
  /** Descripción de ayuda bajo el selector. */
  desc: string;
};

export const INTERACTION_TYPES: InteractionTypeConfig[] = [
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
