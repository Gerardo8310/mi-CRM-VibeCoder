import { MIN_PASSWORD_LENGTH } from "@convex/authConstants";
import { cn } from "@/lib/utils";

/**
 * Las tres barras de fortaleza de la maqueta (GER-49).
 *
 * **ESTO ES ORIENTATIVO Y NO DECIDE NADA.** La autoridad de qué contraseña se
 * acepta es `validatePassword` (convex/authz.ts), que corre en el servidor y
 * conoce cosas que aquí no se saben —la lista de contraseñas obvias, el correo
 * de la persona—. Este medidor solo le da a quien escribe una señal mientras
 * teclea; si dice "fuerte", el servidor puede rechazarla igual, y su mensaje es
 * el que manda.
 *
 * Se consideró traer la política al cliente para que las dos coincidieran
 * siempre. Se descartó: obligaría a partir `convex/authz.ts`, que es código
 * auditado y el sitio donde vive el control de acceso, para ganar un adorno.
 *
 * El único número que sí es real es `MIN_PASSWORD_LENGTH`, importado de
 * `convex/authConstants.ts` —el mismo que aplica el servidor—, así que la barra
 * roja aparece exactamente cuando la contraseña sería rechazada por corta.
 */

type Nivel = "corta" | "aceptable" | "fuerte";

/**
 * Cuenta cuántas familias de caracteres distintas hay. Cuatro: minúsculas,
 * mayúsculas, dígitos y todo lo demás. No se usa `\w` ni clases dependientes del
 * idioma: una contraseña con eñes o acentos cuenta sus letras como tales.
 */
function variedad(password: string): number {
  let familias = 0;
  if (/[a-záéíóúüñ]/.test(password)) familias++;
  if (/[A-ZÁÉÍÓÚÜÑ]/.test(password)) familias++;
  if (/[0-9]/.test(password)) familias++;
  if (/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/.test(password)) familias++;
  return familias;
}

export function nivelDe(password: string): Nivel {
  if (password.length < MIN_PASSWORD_LENGTH) return "corta";
  // Una contraseña larga es fuerte aunque sea toda minúsculas: la longitud
  // aporta más entropía que mezclar familias en una corta. Por eso hay dos
  // caminos a "fuerte" y no una única regla de variedad.
  if (password.length >= 16 || variedad(password) >= 3) return "fuerte";
  return "aceptable";
}

const ESTILOS: Record<Nivel, { barras: number; barra: string; texto: string; etiqueta: string }> = {
  corta: {
    barras: 1,
    barra: "bg-error-500",
    texto: "text-error-500",
    etiqueta: `MÍNIMO ${MIN_PASSWORD_LENGTH} CARACTERES`,
  },
  aceptable: {
    barras: 2,
    barra: "bg-warning-500",
    texto: "text-warning-700",
    etiqueta: "CONTRASEÑA ACEPTABLE",
  },
  fuerte: {
    barras: 3,
    barra: "bg-success-500",
    texto: "text-success-500",
    etiqueta: "CONTRASEÑA FUERTE",
  },
};

export function MedidorFortaleza({ password }: { password: string }) {
  // Con el campo vacío no se dice nada: quien todavía no ha escrito no ha hecho
  // nada mal, y un aviso rojo de entrada solo es ruido.
  if (password.length === 0) return null;

  const { barras, barra, texto, etiqueta } = ESTILOS[nivelDe(password)];

  return (
    <div className="mt-2">
      <div className="mb-1 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-0.75 flex-1 rounded-sm",
              i < barras ? barra : "bg-neutral-200"
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-mono text-[10px] font-semibold tracking-[0.04em]",
          texto
        )}
      >
        {etiqueta}
      </span>
    </div>
  );
}
