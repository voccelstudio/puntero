/**
 * Motor financiero del presupuesto.
 *
 * ## Orden de aplicación de los coeficientes
 *
 * 1. `costoDirecto` = materiales + mano de obra (suma de todos los ítems).
 * 2. `gastosGenerales` = costoDirecto × GG → sobre el costo directo, nunca
 *    sobre el costo ya cargado con beneficio (para no duplicar la base).
 * 3. `beneficio` = (costoDirecto + GG) × beneficio.
 * 4. `honorarios` = costoDirecto × honorarios (profesional proyectista).
 * 5. `subtotalBruto` = costoDirecto + GG + beneficio + honorarios.
 * 6. `descuento` = subtotalBruto × descuento (comercial).
 * 7. `subtotalNeto` = subtotalBruto − descuento.
 * 8. IVA partido: Paraguay grava los materiales al 10% y la mano de obra —
 *    servicios de carácter personal — al 5%. El impuesto se calcula sobre el
 *    subtotal ya cargado (la base imponible) repartiendo la carga con un mismo
 *    `factorCarga` entre la porción de materiales y la de mano de obra.
 * 9. `total` = subtotalNeto + IVA (si `facturaIva` está activo).
 */

import {
  IVA_LAB,
  IVA_MAT,
  type Rubro,
} from "@/dominio/precios";
import type {
  DatosPresupuesto,
  EstadoItem,
  FasePresupuesto,
  ItemPresupuesto,
  ParametrosFinancieros,
  Unidad,
} from "@/dominio/tipos";

export interface ResumenPresupuesto {
  costoMateriales: number;
  costoManoObra: number;
  costoDirecto: number;
  gastosGenerales: number;
  costoTotal: number;
  beneficio: number;
  honorarios: number;
  subtotalBruto: number;
  descuento: number;
  subtotalNeto: number;
  ivaMateriales: number;
  ivaManoObra: number;
  iva: number;
  total: number;
  pctMateriales: number;
  pctManoObra: number;
}

export function totalItem(item: Pick<ItemPresupuesto, "cantidad" | "precioMaterial" | "precioManoObra">) {
  return item.cantidad * (item.precioMaterial + item.precioManoObra);
}

export function totalFase(items: ItemPresupuesto[]): number {
  return items.reduce((acc, item) => acc + totalItem(item), 0);
}

export function todosLosItems(datos: DatosPresupuesto): ItemPresupuesto[] {
  return datos.fases.flatMap((fase) => fase.items);
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
  const honorarios = costoDirecto * params.honorarios;
  const subtotalBruto = costoTotal + beneficio + honorarios;
  const descuento = subtotalBruto * params.descuento;
  const subtotalNeto = subtotalBruto - descuento;

  // GG y beneficio se reparten entre materiales y mano de obra con el mismo
  // factor, para que cada porción conserve su base imponible, y el descuento
  // se aplica proporcional a esa base.
  const factorCarga = (1 + params.gastosGenerales) * (1 + params.beneficio) * (1 - params.descuento);
  const baseMateriales = costoMateriales * factorCarga;
  const baseManoObra = costoManoObra * factorCarga;

  const ivaMateriales = params.facturaIva ? baseMateriales * params.ivaMateriales : 0;
  const ivaManoObra = params.facturaIva ? baseManoObra * params.ivaManoObra : 0;
  const iva = ivaMateriales + ivaManoObra;

  return {
    costoDirecto,
    costoMateriales,
    costoManoObra,
    costoTotal,
    gastosGenerales,
    beneficio,
    honorarios,
    subtotalBruto,
    descuento,
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
  honorarios: 0.07,
  descuento: 0,
  ivaMateriales: IVA_MAT,
  ivaManoObra: IVA_LAB,
  facturaIva: true,
};

/* ------------------------------------------------------------------ */
/* Construcción de ítems desde la base de precios                      */
/* ------------------------------------------------------------------ */

const UNIDADES = {
  m2: "m2",
  m3: "m3",
  m: "m",
  ml: "ml",
  kg: "kg",
  un: "u",
  u: "u",
  gl: "gl",
} as const satisfies Record<string, Unidad>;

function mapUnidad(unidad: string): Unidad {
  return UNIDADES[unidad as keyof typeof UNIDADES] ?? "u";
}

/**
 * Convierte un rubro de la base de precios en una partida de presupuesto.
 * Materiales y mano de obra van por separado porque el IVA las grava distinto.
 */
export function itemDesdeRubro(
  rubro: Rubro,
  cantidad: number,
  opciones: { estado?: EstadoItem; cantidadEjecutada?: number; nota?: string } = {},
): ItemPresupuesto {
  return {
    id: rubro.id,
    codigo: "",
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

/* ------------------------------------------------------------------ */
/* ítems y códigos                                                     */
/* ------------------------------------------------------------------ */

/**
 * Renumera todos los ítems con códigos jerárquicos: las fases como "1", "2",
 * ... y los ítems como "1.1", "1.2", ... dentro de la posición que ocupan.
 */
export function numerarItems(fases: FasePresupuesto[]): FasePresupuesto[] {
  return fases.map((fase, i) => ({
    ...fase,
    numero: i + 1,
    items: fase.items.map((item, j) => ({ ...item, codigo: `${i + 1}.${j + 1}` })),
  }));
}

function nuevoSufijo(actual: string): string {
  return actual.replace(/^(.*\.)?(\d+)$/, (_m, pre?: string, n?: string) => {
    const num = (n ? Number(n) : 0) + 1;
    return `${pre ?? ""}${num}`;
  });
}

/** Id corto y único para cualquier entidad editable. */
export function nuevoId(coleccion = "item"): string {
  return `${coleccion}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Rebase los ids de ítems de una fase para que no choquen al unir fases. */
export function rebasarItems(items: ItemPresupuesto[], sufijo: string): ItemPresupuesto[] {
  return items.map((item) => ({ ...item, id: nuevoSufijo(item.id + sufijo) }));
}

/* ------------------------------------------------------------------ */
/* Avance y desvío                                                     */
/* ------------------------------------------------------------------ */

/** Costo previsto de los ítems realmente ejecutados. */
export function calcularCostoEjecutado(items: ItemPresupuesto[]): number {
  return items.reduce(
    (acc, i) => acc + i.cantidadEjecutada * (i.precioMaterial + i.precioManoObra),
    0,
  );
}

/**
 * Desvío de costo contra presupuesto. Negativo = ahorro. Se acompaña de la
 * ejecución nominal para poder detectar "se ejecutó de más pero se cobró
 * menos", que sí es favorable.
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
export function calcularAvanceFisico(items: ItemPresupuesto[]): number {
  const presupuestado = items.reduce((acc, i) => acc + totalItem(i), 0);
  if (presupuestado === 0) return 0;
  return Math.min(1, calcularCostoEjecutado(items) / presupuestado);
}

/* ------------------------------------------------------------------ */
/* Cómputo métrico                                                     */
/* ------------------------------------------------------------------ */

export interface ComputoRubro {
  rubroId: string;
  categoria: string;
  descripcion: string;
  unidad: Unidad;
  precioUnitario: number;
  presupuestado: number;
  ejecutado: number;
  saldo: number;
  /** % de avance del rubro, 0..1. */
  avance: number;
  costoPresupuestado: number;
  costoEjecutado: number;
  totalItems: number;
}

/** Cómputo por rubro, abriendo cada ítem con matriz por partida. */
export function computoPorRubro(items: ItemPresupuesto[]): ComputoRubro[] {
  const mapa = new Map<string, ComputoRubro>();

  for (const item of items) {
    const clave = item.rubroId ?? item.descripcion;
    const actual = mapa.get(clave) ?? {
      rubroId: clave,
      categoria: item.rubroCategoria ?? "Personalizados",
      descripcion: item.descripcion,
      unidad: item.unidad,
      precioUnitario: item.precioMaterial + item.precioManoObra,
      presupuestado: 0,
      ejecutado: 0,
      saldo: 0,
      avance: 0,
      costoPresupuestado: 0,
      costoEjecutado: 0,
      totalItems: 0,
    };
    actual.presupuestado += item.cantidad;
    actual.ejecutado += item.cantidadEjecutada;
    actual.saldo = actual.presupuestado - actual.ejecutado;
    actual.costoPresupuestado += totalItem(item);
    actual.costoEjecutado += item.cantidadEjecutada * (item.precioMaterial + item.precioManoObra);
    actual.avance = actual.presupuestado > 0 ? actual.ejecutado / actual.presupuestado : 0;
    actual.totalItems += 1;
    mapa.set(clave, actual);
  }

  return [...mapa.values()].sort(
    (a, b) =>
      b.costoPresupuestado - a.costoPresupuestado || a.descripcion.localeCompare(b.descripcion),
  );
}

/* ------------------------------------------------------------------ */
/* Adendas                                                             */
/* ------------------------------------------------------------------ */

export function totalAdenda(item: Pick<ItemPresupuesto, "cantidad" | "precioMaterial" | "precioManoObra">) {
  return totalItem(item);
}

export function computoAdenda(datos: DatosPresupuesto, codigo: string): ItemPresupuesto[] {
  return todosLosItems(datos).filter((i) => i.adenda === codigo);
}

export function totalAdendas(datos: DatosPresupuesto): number {
  return datos.adendas.reduce((acc, adenda) => acc + adenda.monto, 0);
}