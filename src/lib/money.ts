/**
 * Formato de importes del CRM: `es-MX` con el `$` delante.
 *
 * **Conserva los decimales que traiga el importe**: `1000.5` da `"$1,000.5"`. No
 * se fija `maximumFractionDigits: 0` a propósito — redondear lo que se enseña
 * como una venta es una decisión de negocio, no de formato, y aquí se heredaría
 * a las cinco pantallas que ya usan este mismo formateador sin él. Los montos
 * del MVP se capturan enteros, así que hoy no se nota.
 *
 * Nace con "Inicio" (GER-18) para no añadir una sexta copia de
 * `new Intl.NumberFormat("es-MX")` al proyecto. Las cinco que ya existían
 * —`ventas/page.tsx`, `opportunity-card`, `mover-etapa-sheet`,
 * `client-history` y `opportunity-select`— **no se tocan aquí**: unificarlas es
 * un refactor transversal que no pertenece a una tarea de pantalla y ensancharía
 * su diff sin necesidad. Queda declarado como deuda en el expediente de GER-18.
 */
const MONEY_FMT = new Intl.NumberFormat("es-MX");

/** `138500` → `"$138,500"`. Sin sufijo de moneda: quien lo necesite añade "MXN". */
export function formatMoney(amount: number): string {
  return `$${MONEY_FMT.format(amount)}`;
}
