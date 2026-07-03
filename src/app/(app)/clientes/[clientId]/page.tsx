import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/**
 * Pantalla 3 — Ficha de cliente (la pantalla central del CRM).
 * GER-11 (datos y edición), GER-12 (anotar), GER-13 (historial),
 * GER-14 (registrar oportunidad), GER-16 (agendar seguimiento).
 */
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  return (
    <>
      <PageHeader title="Ficha de cliente" />
      <ScreenPlaceholder
        description={`Datos + historial (interacciones, oportunidades y seguimientos hechos) + pendientes del cliente ${clientId}, con los paneles "Anotar", "Registrar" y "Agendar".`}
        designFile="Design/FichaCliente.dc.html"
        linearIssue="GER-11, GER-12, GER-13, GER-14, GER-16"
      />
    </>
  );
}
