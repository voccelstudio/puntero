import type { DatosBitacora } from "@/dominio/tipos";

/** Bitácora inicial de una obra nueva: sin partes diarios. */
export function semillaBitacora(): DatosBitacora {
  return { entradas: [] };
}
