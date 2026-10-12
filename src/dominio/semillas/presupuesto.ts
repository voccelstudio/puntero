import { PARAMETROS_POR_DEFECTO } from "@/dominio/calculo";
import type { DatosPresupuesto } from "@/dominio/tipos";

/**
 * Presupuesto inicial de una obra nueva.
 *
 * Arranca vacío: sin fases, adendas ni versiones. Los parámetros usan los
 * valores por defecto del dominio.
 */
export function semillaPresupuesto(): DatosPresupuesto {
  return {
    fases: [],
    adendas: [],
    parametros: PARAMETROS_POR_DEFECTO,
    monedaContrato: "PYG",
    versiones: [],
  };
}
