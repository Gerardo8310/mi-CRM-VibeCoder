import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Las tres tarjetas de números de "Inicio" (GER-18). Ver Design/Inicio.dc.html,
 * `.metric-card`.
 *
 * ES UN ENLACE DE VERDAD, no un `div` con `onClick`. El issue pide que tocar el
 * número lleve a su detalle, y con un `<div>` eso se pierde para quien navega
 * con teclado, usa lector de pantalla o quiere abrir en otra pestaña. La maqueta
 * solo dibujó `hover`, que no le sirve a ninguno de los tres: de ahí el estilo
 * de foco visible, que no está en el diseño y sí en el código.
 *
 * EL "—" NO ES UN CERO. Un valor a cero se pinta con el estilo apagado de la
 * maqueta (`metric-empty`: gris claro y trazo fino) en vez de un "0" negro y
 * enorme. Un cero a 52 px pesa lo mismo visualmente que un buen mes, y en un
 * panel que se lee de un vistazo eso confunde.
 */

const TONOS = {
  info: "bg-info-100 text-info-700",
  success: "bg-success-100 text-success-700",
  brand: "bg-brand-50 text-brand-500",
} as const;

export type Tendencia =
  | { tipo: "sube" | "baja" | "igual"; texto: string }
  /** El periodo de comparación no tiene nada con lo que comparar. */
  | { tipo: "sin-datos" };

const TENDENCIAS = {
  sube: { icon: TrendingUp, clase: "text-success-700" },
  baja: { icon: TrendingDown, clase: "text-error-500" },
  igual: { icon: Minus, clase: "text-neutral-400" },
} as const;

function TendenciaChip({ tendencia }: { tendencia: Tendencia }) {
  if (tendencia.tipo === "sin-datos") {
    return (
      <span className="text-right text-xs leading-tight text-neutral-300">
        Sin datos anteriores
      </span>
    );
  }
  const { icon: Icon, clase } = TENDENCIAS[tendencia.tipo];
  return (
    <span className={cn("flex items-center gap-1 text-right text-xs leading-tight", clase)}>
      <Icon className="size-3 shrink-0" />
      {tendencia.texto}
    </span>
  );
}

export function MetricCard({
  href,
  icon: Icon,
  tono,
  valor,
  etiqueta,
  tendencia,
  /**
   * Seguimientos atrasados. Con uno o más, la tarjeta entera cambia de aspecto:
   * borde rojo, número rojo e insignia en lugar de la tendencia. Es el estado
   * "alerta" de la maqueta, y se decide con el dato, no con una bandera aparte —
   * así no puede quedarse una tarjeta roja sin atrasados.
   */
  atrasados = 0,
}: {
  href: string;
  icon: LucideIcon;
  tono: keyof typeof TONOS;
  /** `null` pinta "—": no hay nada que contar en el periodo. */
  valor: string | null;
  etiqueta: string;
  tendencia: Tendencia;
  atrasados?: number;
}) {
  const enAlerta = atrasados > 0;

  return (
    <Link
      href={href}
      className={cn(
        "block border bg-white p-5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(30,20,5,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:flex-1 lg:p-6",
        enAlerta
          ? "border-error-500/30 border-l-[3px] border-l-error-500"
          : "border-neutral-200"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-8.5 shrink-0 items-center justify-center rounded-full",
            enAlerta ? "bg-error-100 text-error-500" : TONOS[tono]
          )}
        >
          {enAlerta ? (
            <AlertCircle className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </span>

        {enAlerta ? (
          <span className="whitespace-nowrap rounded-[2px] border border-error-500/25 bg-error-100 px-2 py-0.5 font-mono text-[11px] font-bold text-error-500">
            ⚠ {atrasados} atrasado{atrasados !== 1 ? "s" : ""}
          </span>
        ) : (
          <TendenciaChip tendencia={tendencia} />
        )}
      </div>

      <div
        className={cn(
          "mb-1.5 mt-3 font-mono tracking-[-0.04em] leading-none text-[44px] lg:text-[52px]",
          valor === null
            ? "font-light text-neutral-300"
            : enAlerta
              ? "font-bold text-error-500"
              : "font-bold text-neutral-950"
        )}
      >
        {valor ?? "—"}
      </div>
      <div className="text-sm leading-snug text-neutral-500">{etiqueta}</div>
    </Link>
  );
}
