import { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { TabBar } from "@/components/nav/tab-bar";
import { Fab } from "@/components/nav/fab";
import { SessionGuard } from "@/components/nav/session-guard";

/**
 * Envoltura de navegación compartida por las 7 pantallas autenticadas
 * (Inicio, Hoy, Clientes, Ventas, Usuarios, Perfil y la Ficha de cliente).
 * Ver GER-8 / Design/Navegacion.dc.html.
 *
 * Es también donde se monta `SessionGuard` (GER-56): al envolver las 7
 * pantallas, cubre a un usuario desactivado esté donde esté, no solo en la raíz.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <SessionGuard />
      <Sidebar />
      <div className="flex min-h-screen flex-col pb-14 lg:ml-60 lg:pb-0">
        {children}
      </div>
      <TabBar />
      <Fab />
    </div>
  );
}
