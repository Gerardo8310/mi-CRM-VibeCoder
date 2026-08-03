"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { formatDayHeading, greeting } from "@/lib/dates";
import { ProfileAvatarButton } from "@/components/nav/profile-avatar-button";

/**
 * La cabecera de "Inicio" (GER-18): saludo según la hora, fecha y avatar. Ver
 * `.page-hdr` en Design/Inicio.dc.html.
 *
 * NO USA `PageHeader` y no lo modifica. Esa cabecera es de una línea y con el
 * título truncado, la comparten las otras seis pantallas y en ella vive el
 * acceso al perfil en móvil (GER-49); meterle un saludo de dos líneas movería
 * las seis. Aquí el saludo es buena parte del carácter de la pantalla, así que
 * Inicio se paga la suya y reutiliza el mismo botón de avatar.
 *
 * EL SALUDO Y LA FECHA SE CALCULAN YA MONTADO. El servidor de Railway corre en
 * UTC y el navegador en hora de México: renderizarlos en los dos lados daría
 * "Buenos días" arriba y "Buenas tardes" abajo varias horas al día, que es un
 * desajuste de hidratación. Hasta que hay valor se reserva el hueco con un
 * espacio duro, para que el texto no empuje al aparecer.
 *
 * Y SE RECALCULAN AL VOLVER A LA PESTAÑA, con el mismo `visibilitychange` que
 * usa `use-end-of-today.ts`. Sin eso, una pestaña abierta desde la mañana
 * seguiría dando los buenos días a las siete de la tarde. No se pone un
 * temporizador a la hora exacta del umbral: el caso real es irse y volver, y un
 * temporizador que solo cambia dos palabras no se paga. Con la pestaña delante y
 * sin tocarla el saludo puede quedarse atrás — es cosmético y no toca ni un
 * número.
 */
export function InicioHeader() {
  const viewer = useQuery(api.users.viewer);
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    const refrescar = () => setAhora(Date.now());
    refrescar();

    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  // Solo el nombre de pila: "Buenos días, Martha Vargas" suena a carta del banco.
  const nombre = viewer?.name.trim().split(/\s+/)[0];

  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 bg-white px-4 pb-4 pt-5 lg:px-8 lg:pb-6 lg:pt-7">
      <div className="min-w-0">
        <h1 className="truncate font-mono text-[22px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          {/* Mientras `viewer` carga se saluda sin nombre, y el nombre se suma
              al llegar: es preferible a un hueco o a unas iniciales inventadas. */}
          {ahora === null ? " " : `${greeting(ahora)}${nombre ? `, ${nombre}` : ""}`}
        </h1>
        <p className="mt-0.5 truncate text-sm text-neutral-400">
          {ahora === null ? " " : formatDayHeading(ahora)}
        </p>
      </div>
      <ProfileAvatarButton />
    </header>
  );
}
