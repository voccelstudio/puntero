import type { ItemPresupuesto, ParametrosFinancieros } from "@/lib/types";

/**
 * Motor financiero del presupuesto.
 *
 * Los coeficientes son encadenados sobre el costo directo, que es la práctica
 * habitual en el ramo. El orden importa: los gastos generales se calculan
 * sobre el costo directo (no sobre el costo ya cargado con beneficio), para
 * evitar doble conteo.
 */

export interface ResumenPresupuesto {
  /** Suma de materiales + mano de obra de todos los ítems. */
  costoDirecto: number;
  costoMateriales: number;
  costoManoObra: number;
  /** Costo directo + gastos generales. */
  costoTotal: number;
  gastosGenerales: number;
  beneficio: number;
  /** Total antes de IVA. */
  subtotalNeto: number;
  iva: number;
  /** Total que se le presenta al cliente. */
  total: number;
  /** Participación de cada rubro en el costo directo, 0..1. */
  pctMateriales: number;
  pctManoObra: number;
}

export function totalItem(item: Pick<ItemPresupuesto, "cantidad" | "precioMaterial" | "precioManoObra">) {
  return item.cantidad * (item.precioMaterial + item.precioManoObra);
}

export function totalFase(items: ItemPresupuesto[]) {
  return items.reduce((acc, item) => acc + totalItem(item), 0);
}

export function calcularPresupuesto(
  items: ItemPresupuesto[],
  params: ParametrosFinancieros,
): ResumenPresupuesto {
  const costoMateriales = items.reduce((acc, i) => acc + i.cantidad * i.precioMaterial, 0);
  const costoManoObra = items.reduce((acc, i) => acc + i.cantidad * i.precioManoObra, 0);
  const costoDirecto = costoMateriales + costoManoObra;

  const gastosGenerales = costoDirecto * params.gastosGenerales;
  const costoTotal = costoDirecto + gastosGenerales;
  const beneficio = costoTotal * params.beneficio;
  const subtotalNeto = costoTotal + beneficio;
  const iva = subtotalNeto * params.iva;

  return {
    costoDirecto,
    costoMateriales,
    costoManoObra,
    costoTotal,
    gastosGenerales,
    beneficio,
    subtotalNeto,
    iva,
    total: subtotalNeto + iva,
    pctMateriales: costoDirecto > 0 ? costoMateriales / costoDirecto : 0,
    pctManoObra: costoDirecto > 0 ? costoManoObra / costoDirecto : 0,
  };
}

/**
 * Costo previsto de los ítems realmente ejecutados, usando la misma
 * estructura de precios. Sirve para medir el desvío de costo.
 */
export function calcularCostoEjecutado(items: ItemPresupuesto[]) {
  return items.reduce((acc, i) => acc + i.cantidadEjecutada * (i.precioMaterial + i.precioManoObra), 0);
}

/**
 * Desvío de costo contra presupuesto para un conjunto de ítems.
 * Negativo = ahorro. Se acompaña de la ejecución nominal para poder detectar
 * el caso "se ejecutó de más pero se cobró menos", que sí es favorable.
 */
export function calcularDesvio(items: ItemPresupuesto[]) {
  const presupuestado = items.reduce((acc, i) => acc + totalItem(i), 0);
  const ejecutado = calcularCostoEjecutado(items);
  const monto = ejecutado - presupuestado;
  return {
    presupuestado,
    ejecutado,
    monto,
    pct: presupuestado > 0 ? monto / presupuestado : 0,
    favorable: monto < 0,
  };
}

/** Avance físico ponderado por costo, 0..1. */
export function calcularAvanceFisico(items: ItemPresupuesto[]) {
  const presupuestado = items.reduce((acc, i) => acc + totalItem(i), 0);
  if (presupuestado === 0) return 0;
  const ejecutado = calcularCostoEjecutado(items);
  return Math.min(1, ejecutado / presupuestado);
}
