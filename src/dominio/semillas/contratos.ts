import type { DatosContratos } from "@/dominio/tipos";

/** Registro de contratos inicial de una obra nueva: vacío. */
export function semillaContratos(): DatosContratos {
  return { contratos: [] };
}
