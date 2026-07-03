import type { LucideIcon } from "lucide-react";
import { Briefcase, Clock, LayoutDashboard, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Los 4 accesos principales, siempre visibles (ver PRD, sección Navegación,
 * y Design/Navegacion.dc.html). No incluye "Reportes": está fuera del MVP.
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
  { href: "/hoy", label: "Hoy", icon: Clock },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: Briefcase },
];
