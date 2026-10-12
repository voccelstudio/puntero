import type { DatosGente } from "@/dominio/tipos";

/** Gente inicial de una obra nueva: sin contratistas ni clientes. */
export function semillaGente(): DatosGente {
  return { contratistas: [], clientes: [] };
}
