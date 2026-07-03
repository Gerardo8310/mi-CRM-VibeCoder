import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Pantalla 6 — Inicio / Resumen del negocio (Martha). GER-18. */
export default function InicioPage() {
  return (
    <>
      <PageHeader title="Inicio" />
      <ScreenPlaceholder
        description="Panel de Martha: clientes nuevos, ventas del mes, pendientes, pipeline abierto y actividad reciente (5 bloques confirmados)."
        designFile="Design/Inicio.dc.html"
        linearIssue="GER-18"
      />
    </>
  );
}
