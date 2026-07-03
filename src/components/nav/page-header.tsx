import { ReactNode } from "react";

export function PageHeader({
  title,
  meta,
  action,
}: {
  title: string;
  /** Contenido junto al título (p. ej. fecha + conteo en "Hoy"). */
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 lg:h-14 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate font-mono text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          {title}
        </h1>
        {meta}
      </div>
      {action}
    </header>
  );
}
