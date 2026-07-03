"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Settings, Shield } from "lucide-react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { useEndOfToday } from "@/lib/use-end-of-today";
import { Avatar } from "@/components/ui/avatar";
import { MAIN_NAV_ITEMS } from "@/components/nav/nav-items";

/** Sidebar de escritorio, 240px expandida (ver Design/Navegacion.dc.html, frame 2). */
export function Sidebar() {
  const pathname = usePathname();
  const viewer = useQuery(api.users.viewer);
  const endOfDay = useEndOfToday();
  const pendingCount = useQuery(api.followUps.pendingCountForViewer, { endOfDay });
  const { signOut } = useAuthActions();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-dark-border bg-dark-surface lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-dark-border px-5 py-5">
        <div className="size-2 shrink-0 bg-brand-500" />
        <span className="font-mono text-[13px] font-bold tracking-[0.01em] text-brand-500">
          SolarCRM
        </span>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 py-3">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2.5 border-l-2 border-transparent px-4.5 font-sans text-[13px] text-dark-text-secondary transition-colors hover:bg-white/4 hover:text-brand-200",
                isActive &&
                  "border-brand-500 bg-brand-500/10 font-medium text-brand-500"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
              {item.href === "/hoy" && !!pendingCount && (
                <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-error-500 px-1 font-mono text-[9px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Usuario + accesos secundarios */}
      <div className="border-t border-dark-border">
        {viewer?.role === "duena" && (
          <Link
            href="/usuarios"
            className={cn(
              "flex h-10.5 items-center gap-2.5 border-l-2 border-transparent px-4.5 font-sans text-[13px] text-dark-text-secondary transition-colors hover:text-brand-200",
              pathname.startsWith("/usuarios") &&
                "border-brand-500 bg-brand-500/10 font-medium text-brand-500"
            )}
          >
            <Shield className="size-3.75 shrink-0" />
            Usuarios
          </Link>
        )}

        {viewer && (
          <div className="flex items-center gap-2.5 border-t border-dark-border px-4.5 py-3.5">
            <Avatar name={viewer.name} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-brand-200">
                {viewer.name}
              </div>
              <div className="text-[11px] text-dark-text-secondary">
                {viewer.role === "duena" ? "Dueña" : "Vendedor"}
              </div>
            </div>
          </div>
        )}

        <Link
          href="/perfil"
          className="flex h-9 items-center gap-2.5 px-4.5 font-sans text-xs text-dark-text-secondary hover:text-brand-200"
        >
          <Settings className="size-3.5 shrink-0" />
          Perfil
        </Link>
        <button
          onClick={() => void signOut()}
          className="flex h-9 w-full items-center gap-2.5 px-4.5 font-sans text-xs text-dark-text-secondary hover:text-brand-200"
        >
          <LogOut className="size-3.5 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
