/**
 * Operaciones puras sobre `DatosBitacora` (partes diarios de obra).
 */

import type { ClimaObra, DatosBitacora, EntradaBitacora } from "@/dominio/tipos";

export function addEntrada(datos: DatosBitacora, e: EntradaBitacora): DatosBitacora {
  return { ...datos, entradas: ordenar([...datos.entradas, e]) };
}

export function patchEntrada(datos: DatosBitacora, id: string, patch: Partial<EntradaBitacora>): DatosBitacora {
  return {
    ...datos,
    entradas: ordenar(datos.entradas.map((e) => (e.id === id ? { ...e, ...patch } : e))),
  };
}

export function removeEntrada(datos: DatosBitacora, id: string): DatosBitacora {
  return { ...datos, entradas: datos.entradas.filter((e) => e.id !== id) };
}

/** Más reciente primero. */
function ordenar(entradas: EntradaBitacora[]): EntradaBitacora[] {
  return [...entradas].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function ultimaEntrada(datos: DatosBitacora): EntradaBitacora | null {
  return ordenar(datos.entradas)[0] ?? null;
}

export function horasAcumuladas(datos: DatosBitacora): number {
  return datos.entradas.reduce((a, e) => a + e.horasTrabajadas, 0);
}

export function diasConLluvia(datos: DatosBitacora): number {
  return datos.entradas.filter((e) => e.clima === "LLUVIA" || e.clima === "TORMENTA").length;
}

/** Avance promedio de los partes cargados, 0..1. */
export function avancePromedio(datos: DatosBitacora): number {
  if (datos.entradas.length === 0) return 0;
  return datos.entradas.reduce((a, e) => a + e.avance, 0) / datos.entradas.length;
}

export const CLIMA_NOMBRE: Record<ClimaObra, string> = {
  SOLEADO: "Soleado",
  NUBLADO: "Nublado",
  LLUVIA: "Lluvia",
  TORMENTA: "Tormenta",
  VIENTO: "Viento",
  CALOR_EXTREMO: "Calor extremo",
};
