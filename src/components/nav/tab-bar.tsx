"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { useEndOfToday } from "@/lib/use-end-of-today";
import { MAIN_NAV_ITEMS } from "@/components/nav/nav-items";

/** Barra de tabs inferior, móvil (ver Design/Navegacion.dc.html, frame 1). */
export function TabBar() {
  const pathname = usePathname();
  const endOfDay = useEndOfToday();
  const pendingCount = useQuery(api.followUps.pendingCountForViewer, { endOfDay });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center border-t border-neutral-200 bg-white lg:hidden">
      {MAIN_NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
          >
            {isActive && (
              <span className="absolute top-0 h-0.75 w-7 rounded-b bg-brand-500" />
            )}
            <span className="relative inline-flex">
              <Icon
                className={cn(
                  "size-5",
                  isActive ? "text-brand-500" : "text-neutral-400"
                )}
              />
              {item.href === "/hoy" && !!pendingCount && (
                <span className="absolute -right-2 -top-1.5 flex h-3.75 min-w-3.75 items-center justify-center rounded-pill border-[1.5px] border-white bg-error-500 px-0.5 font-mono text-[8px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </span>
            <span
              className={cn(
                "font-sans text-[10px]",
                isActive ? "font-medium text-brand-500" : "text-neutral-400"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
