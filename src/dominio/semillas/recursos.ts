import type { DatosBiblioteca, DatosMateriales, DatosPedidos } from "@/dominio/tipos";

/** Catálogo de insumos inicial de una obra nueva: vacío. */
export function semillaMateriales(): DatosMateriales {
  return { materiales: [] };
}

/** Pedidos a proveedores iniciales de una obra nueva: vacíos. */
export function semillaPedidos(): DatosPedidos {
  return { pedidos: [] };
}

/** Biblioteca técnica y legal inicial de una obra nueva: vacía. */
export function semillaBiblioteca(): DatosBiblioteca {
  return { documentos: [] };
}
