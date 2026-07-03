import { ReactNode } from "react";

interface ScreenPlaceholderProps {
  description: string;
  designFile: string;
  linearIssue: string;
  action?: ReactNode;
}

/**
 * Marcador de posición para pantallas todavía no construidas. Cada una
 * apunta a su archivo de diseño exacto y a su tarea de Linear — quitar
 * este componente cuando la pantalla se implemente de verdad.
 */
export function ScreenPlaceholder({
  description,
  designFile,
  linearIssue,
  action,
}: ScreenPlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="max-w-md text-sm text-neutral-600">{description}</p>
      <p className="font-mono text-xs text-neutral-400">
        Diseño: <code className="text-neutral-500">{designFile}</code> · Linear:{" "}
        {linearIssue}
      </p>
      {action}
    </div>
  );
}
