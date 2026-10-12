import type { DatosCronograma } from "@/dominio/tipos";

/** Cronograma inicial de una obra nueva: sin tareas. */
export function semillaCronograma(): DatosCronograma {
  return { tareas: [] };
}
