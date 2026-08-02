"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PerfilCard } from "@/components/perfil/perfil-card";

/**
 * "Sesión" (GER-49). Ver Design/PerfilUsuario.dc.html, sección 3.
 *
 * Enseña solo lo que la maqueta pide —quién eres y que la sesión está activa—,
 * y para eso basta el `viewer` que la pantalla ya consulta: **no se lee la tabla
 * `authSessions`**. Listar dispositivos con su fecha y su navegador sería otra
 * función, otra pantalla y otro issue; aquí sobra.
 *
 * El botón es secundario y solo se tiñe de rojo al pasar por encima, como en la
 * maqueta: cerrar tu propia sesión no es destructivo —vuelves a entrar— y
 * pintarlo de rojo desde el principio lo confundiría con desactivar una cuenta.
 *
 * `signOut()` y luego `/login`, en ese orden y con `replace`: es el mismo
 * tratamiento que `session-guard.tsx`, donde está explicado por qué redirigir
 * antes de cerrar sesión provoca un bucle con el middleware.
 */
export function SesionCard({
  nombre,
  correo,
}: {
  nombre: string;
  correo: string;
}) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await signOut();
    } catch {
      // Se traga a propósito, y hace falta: con solo `try`/`finally`, el
      // rechazo se relanza DESPUÉS del `finally`, y como quien llama lo hace con
      // `void salir()` acabaría en una promesa rechazada sin manejar. El destino
      // ya está cubierto por el `finally`: se va al login pase lo que pase.
    } finally {
      // Se navega pase lo que pase: si `signOut` falla, dejar a la persona en
      // una pantalla que cree cerrada es peor que mandarla al login, donde el
      // middleware decidirá con la verdad.
      router.replace("/login");
    }
  }

  return (
    <PerfilCard titulo="Sesión" subtitulo="Gestiona tu acceso activo">
      <div className="mb-4 flex items-center gap-3 border border-neutral-200 bg-neutral-50 p-3">
        <Avatar name={nombre} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-neutral-950">
            {nombre}
          </div>
          <div className="truncate text-[11px] text-neutral-500">
            Sesión activa · {correo}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="size-1.75 rounded-full bg-success-500" />
          <span className="text-[11px] font-medium text-success-700">
            Activo
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void salir()}
        disabled={saliendo}
        className="flex h-11 w-full items-center justify-center gap-2 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium tracking-[-0.01em] text-neutral-600 transition-colors hover:border-error-500/30 hover:bg-error-100 hover:text-error-500 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {saliendo ? (
          <Loader2 className="size-3.75 animate-spin" />
        ) : (
          <LogOut className="size-3.75" />
        )}
        Cerrar sesión
      </button>
    </PerfilCard>
  );
}
