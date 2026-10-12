import type { DatosFinanzas } from "@/dominio/tipos";

/** Finanzas iniciales de una obra nueva: caja chica en cero y sin movimientos. */
export function semillaFinanzas(): DatosFinanzas {
  return {
    fondoFijo: 0,
    movimientos: [],
    jornaleros: [],
    jornadas: [],
    liquidaciones: [],
    subcontratos: [],
    certificados: [],
  };
}
