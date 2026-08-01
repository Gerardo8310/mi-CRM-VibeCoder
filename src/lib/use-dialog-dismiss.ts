"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Lo mínimo que un diálogo tiene que hacer con el teclado y el foco (GER-48,
 * rama 2 — sugerencia N7 de la auditoría de la rama 1).
 *
 * Tres cosas, y ninguna es opcional para poder usar la pantalla sin ratón:
 *
 * 1. **Escape cierra.** Un diálogo del que solo se sale con el ratón deja
 *    atrapado a quien navega con teclado.
 * 2. **El foco entra al abrir.** Sin esto el foco se queda en el botón que abrió
 *    el diálogo, que ahora está detrás de una capa: tabular seguiría recorriendo
 *    la página de debajo.
 * 3. **El foco vuelve al cerrar.** Devolverlo a donde estaba es lo que hace que
 *    cerrar y seguir trabajando no obligue a recorrer la pantalla entera otra
 *    vez.
 *
 * POR QUÉ EL PARÁMETRO `capture`, QUE ES LO ÚNICO SUTIL DE AQUÍ
 *
 * En esta pantalla hay un modal ENCIMA de un panel, y los dos escuchan en
 * `document`. Con dos escuchas en el mismo nodo el orden lo decide la fase, no
 * quién se registró antes: la de captura corre antes de que el evento llegue al
 * elemento con foco, y la de burbujeo, después. Así que el de encima —el modal—
 * se registra con `capture: true` y detiene la propagación, y el de debajo
 * nunca llega a enterarse. Una sola pulsación de Escape cierra una sola capa,
 * que es lo que espera cualquiera.
 *
 * LO QUE ESTO NO HACE, Y ESTÁ DECLARADO: no es una trampa de foco. Tabulando
 * lo suficiente se sale del diálogo hacia el resto de la página. Cerrarlo exige
 * bastante más código —recolectar los elementos enfocables, ciclarlos, tratar
 * los casos degenerados— y no es lo que hoy impide usar la pantalla.
 */
export function useDialogDismiss({
  ref,
  onClose,
  capture = false,
}: {
  /** El contenedor del diálogo. Debe tener `tabIndex={-1}` para poder recibir el foco. */
  ref: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** `true` para la capa superior cuando hay diálogos apilados. */
  capture?: boolean;
}) {
  /**
   * A dónde devolver el foco al cerrar.
   *
   * **Se captura durante el RENDER y no dentro del efecto**, y no es un capricho:
   * un campo con `autoFocus` dentro del diálogo ya se ha llevado el foco cuando
   * los efectos corren, así que ahí `document.activeElement` sería ese campo —
   * que además desaparece al cerrar, con lo que no había nada a lo que volver y
   * el foco caía al `body`. Medido en el panel de invitar, cuyo primer campo se
   * enfoca solo.
   *
   * Va en el inicializador perezoso de `useState` y no escribiendo una `ref`
   * durante el render: son equivalentes en efecto, pero lo segundo lo prohíbe
   * `react-hooks/refs` y el gate del lint lo caza. El inicializador corre una
   * sola vez, en el primer render, que es exactamente cuando hace falta.
   */
  const [previouslyFocused] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

  /**
   * `onClose` NO puede ser una dependencia del efecto de abajo, y esto es lo que
   * arregla el fallo que paró la auditoría (M5).
   *
   * Quien usa este enganche define su `onClose` en el cuerpo del componente, así
   * que es una función NUEVA en cada render. Y el panel de invitar se renderiza
   * con cada tecla, porque el texto de los campos es estado. Con `onClose` en las
   * dependencias, la secuencia era:
   *
   *   tecla → render → `onClose` nuevo → React limpia el efecto (que DEVUELVE EL
   *   FOCO al disparador) y monta otro (que enfoca el contenedor) → el campo se
   *   queda sin foco después de una sola letra.
   *
   * Es decir: el panel no se podía rellenar a mano. No lo detecté porque lo probé
   * con el `fill()` de Playwright, que escribe la cadena entera en un solo evento
   * y salta por encima del problema; hay que teclear carácter a carácter.
   *
   * Guardando la función en una ref que se actualiza aparte, el efecto solo
   * depende de cosas estables —el objeto `ref`, el booleano `capture` y el valor
   * de `useState`—, así que **se monta y se limpia una sola vez, con el diálogo**,
   * y el foco vuelve al disparador solo al cerrar de verdad.
   *
   * Escribir una ref DENTRO de un efecto es legítimo; lo que prohíbe
   * `react-hooks/refs` es hacerlo durante el render.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    // Si el foco ya está dentro —un campo con `autoFocus`— no se le quita: ese
    // campo es mejor destino que el contenedor.
    if (node !== null && !node.contains(document.activeElement)) {
      node.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Solo la capa de arriba debe reaccionar; ver la cabecera.
      event.stopPropagation();
      // Por la ref, nunca la del cierre: ver el bloque de arriba (M5).
      onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown, capture);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, capture);
      // El disparador pudo desaparecer del documento mientras el diálogo estaba
      // abierto (la fila que se editó, por ejemplo). Enfocar algo que ya no está
      // no rompe nada, pero tampoco sirve: se comprueba.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // `onClose` NO va aquí: entraría por la ref. Añadirlo reabre el M5.
  }, [ref, capture, previouslyFocused]);
}
