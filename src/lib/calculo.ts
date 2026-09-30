import type { FasePresupuesto, ItemPresupuesto, ParametrosFinancieros } from "@/lib/types";
import { IVA_LAB, IVA_MAT, type Rubro } from "@/lib/data/precios";

/**
 * Motor financiero del presupuesto.
 *
 * Los coeficientes son encadenados sobre el costo directo, que es la práctica
 * habitual en el ramo. El orden importa: los gastos generales se calculan
 * sobre el costo directo (no sobre el costo ya cargado con beneficio), para
 * evitar doble conteo.
 *
 * ## Sobre el IVA
 *
 * Paraguay no tiene un IVA único para obra: los materiales y el resto de los
 * bienes caen al 10%, y los servicios de carácter personal —la mano de obra—
 * al 5%. Por eso el impuesto se calcula partido sobre la porción de materiales
 * y la de mano de obra, en vez de aplicar un porcentaje único al total.
 *
 * La base del IVA es el subtotal ya cargado con gastos generales y beneficio,
 * que es lo que se factura. Ojo: el Puntero 3.0 lo aplicaba sobre el costo
 * directo sin cargar. El total factura un poco más. **Esto es una decisión
 * impositiva y debería ir contra tu contador antes de emitir facturas.**
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
  /** Parte del IVA que corresponde a materiales, al 10%. */
  ivaMateriales: number;
  /** Parte del IVA que corresponde a mano de obra, al 5%. */
  ivaManoObra: number;
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

  // Gastos generales y beneficio se reparten entre materiales y mano de obra
  // con el mismo factor, para que cada porción conserve su base imponible.
  const factorCarga = (1 + params.gastosGenerales) * (1 + params.beneficio);
  const baseMateriales = costoMateriales * factorCarga;
  const baseManoObra = costoManoObra * factorCarga;

  const ivaMateriales = baseMateriales * params.ivaMateriales;
  const ivaManoObra = baseManoObra * params.ivaManoObra;
  const iva = ivaMateriales + ivaManoObra;

  return {
    costoDirecto,
    costoMateriales,
    costoManoObra,
    costoTotal,
    gastosGenerales,
    beneficio,
    subtotalNeto,
    iva,
    ivaMateriales,
    ivaManoObra,
    total: subtotalNeto + iva,
    pctMateriales: costoDirecto > 0 ? costoMateriales / costoDirecto : 0,
    pctManoObra: costoDirecto > 0 ? costoManoObra / costoDirecto : 0,
  };
}

/** Coeficientes por defecto, con el IVA partido que fija la base de precios. */
export const PARAMETROS_POR_DEFECTO: ParametrosFinancieros = {
  gastosGenerales: 0.08,
  beneficio: 0.15,
  ivaMateriales: IVA_MAT,
  ivaManoObra: IVA_LAB,
};

/**
 * La base de precios usa "un" para unidad de conteo y el dominio usa "u".
 * El resto coincide. Se mapea en vez de castear para no meter una unidad
 * inválida en el presupuesto.
 */
const UNIDADES = {
  m2: "m2",
  m3: "m3",
  m: "m",
  ml: "ml",
  kg: "kg",
  un: "u",
  u: "u",
  gl: "gl",
} as const satisfies Record<string, ItemPresupuesto["unidad"]>;

function mapUnidad(unidad: string): ItemPresupuesto["unidad"] {
  return UNIDADES[unidad as keyof typeof UNIDADES] ?? "u";
}

/**
 * Convierte un rubro de la base de precios en una partida de presupuesto.
 *
 * El precio unitario sale de la base: materiales y mano de obra van por
 * separado porque el IVA las grava distinto.
 */
export function itemDesdeRubro(
  rubro: Rubro,
  cantidad: number,
  opciones: { estado?: ItemPresupuesto["estado"]; cantidadEjecutada?: number; nota?: string } = {},
): ItemPresupuesto {
  return {
    id: rubro.id,
    codigo: rubro.id,
    descripcion: rubro.nombre,
    unidad: mapUnidad(rubro.unidad),
    cantidad,
    precioMaterial: rubro.costoMateriales,
    precioManoObra: rubro.costoManoObra,
    rubroId: rubro.id,
    rubroCategoria: rubro.categoria,
    rendimiento: rubro.rendimiento,
    nota: opciones.nota,
    estado: opciones.estado ?? "PENDIENTE",
    cantidadEjecutada: opciones.cantidadEjecutada ?? 0,
  };
}

/** Arma el presupuesto a partir de una selección de rubros y sus cantidades. */
export function presupuestoDesdeRubros(
  seleccion: { rubro: Rubro; cantidad: number }[],
): FasePresupuesto[] {
  const porCategoria = new Map<string, ItemPresupuesto[]>();
  for (const { rubro, cantidad } of seleccion) {
    const items = porCategoria.get(rubro.categoria) ?? [];
    items.push(itemDesdeRubro(rubro, cantidad));
    porCategoria.set(rubro.categoria, items);
  }
  return [...porCategoria.entries()].map(([categoria, items], i) => ({
    id: categoria,
    numero: i + 1,
    nombre: categoria.charAt(0) + categoria.slice(1).toLowerCase(),
    items,
  }));
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
