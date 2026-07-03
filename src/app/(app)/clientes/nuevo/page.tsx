import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Pantalla 2 — Nuevo cliente. GER-9. */
export default function NuevoClientePage() {
  return (
    <>
      <PageHeader title="Nuevo cliente" />
      <ScreenPlaceholder
        description="Formulario: nombre* y teléfono* obligatorios, correo y nota opcionales. Panel lateral en escritorio, pantalla completa en móvil."
        designFile="Design/NuevoCliente.dc.html"
        linearIssue="GER-9"
      />
    </>
  );
}
