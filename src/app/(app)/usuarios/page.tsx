import { PageHeader } from "@/components/nav/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

/**
 * Pantalla 7 — Gestión de usuarios (solo rol dueña). GER-48.
 * TODO: además de la UI, restringir el acceso a esta ruta a role === "duena"
 * (hoy el middleware solo exige sesión iniciada, no rol).
 */
export default function UsuariosPage() {
  return (
    <>
      <PageHeader title="Gestión de usuarios" />
      <ScreenPlaceholder
        description="Lista de usuarios, invitar por correo (nombre, correo, rol), editar rol, activar/desactivar. Solo visible para Martha."
        designFile="Design/GestionUsuarios.dc.html"
        linearIssue="GER-48"
      />
    </>
  );
}
