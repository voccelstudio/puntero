import type { DatosGente } from "@/dominio/tipos";

/** Gente inicial de una obra nueva: sin contratistas cargados. */
export function semillaGente(): DatosGente {
  return { contratistas: [] };
}
