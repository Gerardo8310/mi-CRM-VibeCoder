import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Pantalla 4 — Tablero de ventas por etapas (Kanban). GER-15. */
export default function VentasPage() {
  return (
    <>
      <PageHeader title="Ventas" />
      <ScreenPlaceholder
        description="Columnas Interesado / Cotizado / Cerrado, drag & drop en escritorio, 'Mover a etapa' en móvil, y días abiertos por tarjeta."
        designFile="Design/Tablero.dc.html"
        linearIssue="GER-15"
      />
    </>
  );
}
