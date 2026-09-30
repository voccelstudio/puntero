/**
 * Íconos Material Symbols Outlined.
 *
 * Se usa la misma familia tipográfica que el diseño original de Stitch, cargada
 * desde selfhost en `layout.tsx` para no depender de una request a Google en
 * tiempo de ejecución. Un `<span>` con la clase `material-symbols-outlined`
 * renderiza el glifo por nombre.
 */

import type { IconoMaterial } from "@/lib/types";

const TAMANOS = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
} as const;

export function Icono({
  name,
  className = "",
  tamano = "base",
  filled = false,
}: {
  name: IconoMaterial | (string & {});
  className?: string;
  tamano?: keyof typeof TAMANOS;
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none leading-none ${
        TAMANOS[tamano]
      } ${filled ? "fill" : ""} ${className}`}
      style={{ fontVariationSettings: filled ? "'FILL' 1" : undefined }}
    >
      {name}
    </span>
  );
}
