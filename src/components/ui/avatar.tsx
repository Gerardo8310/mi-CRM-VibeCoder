import { cn } from "@/lib/utils";

// Paleta rotativa de fondos de avatar — igual a la usada en Design/Clientes.dc.html.
const PALETTE = [
  { bg: "bg-brand-50", text: "text-brand-700" },
  { bg: "bg-info-100", text: "text-info-700" },
  { bg: "bg-success-100", text: "text-success-700" },
  { bg: "bg-warning-100", text: "text-warning-700" },
  { bg: "bg-neutral-100", text: "text-neutral-700" },
] as const;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

function paletteIndexFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % PALETTE.length;
}

const sizeClasses = {
  sm: "size-8 text-[10px]",
  md: "size-9 text-[11px]",
  lg: "size-16 text-xl",
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

/** Avatar de iniciales — el MVP no sube foto de perfil (ver PRD, Fuera del MVP). */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  const { bg, text } = PALETTE[paletteIndexFor(name)];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-mono font-bold",
        bg,
        text,
        sizeClasses[size],
        className
      )}
    >
      {initialsOf(name)}
    </div>
  );
}
