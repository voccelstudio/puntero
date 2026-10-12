/**
 * Operaciones puras sobre `DatosContratos` y cálculos de la cartera.
 */

import { diasEntre, hoyIso } from "@/dominio/formato";
import type { Contrato, DatosContratos, EstadoContrato, TipoContrato } from "@/dominio/tipos";

export function addContrato(datos: DatosContratos, c: Contrato): DatosContratos {
  return { ...datos, contratos: [...datos.contratos, c] };
}

export function patchContrato(datos: DatosContratos, id: string, patch: Partial<Contrato>): DatosContratos {
  return {
    ...datos,
    contratos: datos.contratos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function removeContrato(datos: DatosContratos, id: string): DatosContratos {
  return { ...datos, contratos: datos.contratos.filter((c) => c.id !== id) };
}

export const ESTADO_CONTRATO_NOMBRE: Record<EstadoContrato, string> = {
  BORRADOR: "Borrador",
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  FINALIZADO: "Finalizado",
  RESCINDIDO: "Rescindido",
};

export const TIPO_CONTRATO_NOMBRE: Record<TipoContrato, string> = {
  CLIENTE: "Cliente",
  SUBCONTRATO: "Subcontrato",
  PROVEEDOR: "Proveedor",
  SERVICIOS: "Servicios",
  ALQUILER: "Alquiler",
};

export function contratosActivos(datos: DatosContratos): number {
  return datos.contratos.filter((c) => c.estado === "ACTIVO").length;
}

/** Monto total contratado (todos los contratos), en Gs. */
export function totalContratado(datos: DatosContratos): number {
  return datos.contratos.reduce((a, c) => a + c.monto, 0);
}

/** Retenciones comprometidas sobre contratos activos, en Gs. */
export function totalRetenciones(datos: DatosContratos): number {
  return datos.contratos
    .filter((c) => c.estado === "ACTIVO")
    .reduce((a, c) => a + c.monto * c.retencion, 0);
}

/** Contratos activos que vencen dentro de `dias` o ya vencidos. */
export function porVencer(datos: DatosContratos, dias = 30): Contrato[] {
  const hoy = hoyIso();
  return datos.contratos
    .filter((c) => c.estado === "ACTIVO" && diasEntre(hoy, c.fechaFin) <= dias)
    .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin));
}

/** Fracción del plazo transcurrida (0..1), acotada. */
export function avancePlazo(c: Contrato): number {
  const total = diasEntre(c.fechaInicio, c.fechaFin);
  if (total <= 0) return 0;
  const transcurrido = diasEntre(c.fechaInicio, hoyIso());
  return Math.min(1, Math.max(0, transcurrido / total));
}
