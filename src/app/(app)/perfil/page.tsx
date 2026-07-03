import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Pantalla 8 — Perfil de usuario / cerrar sesión. GER-49. */
export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <ScreenPlaceholder
        description="Editar nombre, cambiar contraseña (con verificación de la actual) y cerrar sesión. Correo y rol de solo lectura."
        designFile="Design/PerfilUsuario.dc.html"
        linearIssue="GER-49"
      />
    </>
  );
}
