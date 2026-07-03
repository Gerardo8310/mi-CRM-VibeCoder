import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { buttonVariants } from "@/components/ui/button";

/** Pantalla 1 — Lista de clientes con buscador. GER-10. */
export default function ClientesPage() {
  return (
    <>
      <PageHeader
        title="Clientes"
        action={
          <Link
            href="/clientes/nuevo"
            className={buttonVariants("primary", "md", "hidden lg:inline-flex")}
          >
            <Plus className="size-3.5" />
            Nuevo cliente
          </Link>
        }
      />
      <ScreenPlaceholder
        description="Lista con búsqueda en tiempo real por nombre o teléfono, avatares con iniciales, y estados vacío/sin resultados/cargando."
        designFile="Design/Clientes.dc.html"
        linearIssue="GER-10"
      />
    </>
  );
}
