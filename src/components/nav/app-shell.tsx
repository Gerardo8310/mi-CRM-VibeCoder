import { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { TabBar } from "@/components/nav/tab-bar";
import { Fab } from "@/components/nav/fab";

/**
 * Envoltura de navegación compartida por las 7 pantallas autenticadas
 * (Inicio, Hoy, Clientes, Ventas, Usuarios, Perfil y la Ficha de cliente).
 * Ver GER-8 / Design/Navegacion.dc.html.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex min-h-screen flex-col pb-14 lg:ml-60 lg:pb-0">
        {children}
      </div>
      <TabBar />
      <Fab />
    </div>
  );
}
