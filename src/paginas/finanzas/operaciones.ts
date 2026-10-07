/**
 * Operaciones puras sobre `DatosFinanzas`. Cada función devuelve un nuevo
 * `DatosFinanzas` para `guardar`.
 */

import {
  aLiquidacion,
  resumirLiquidacion,
} from "@/dominio/finanzas";
import type {
  CertificadoObra,
  DatosFinanzas,
  Jornada,
  Jornalero,
  LiquidacionJornal,
  MovimientoCaja,
  Subcontrato,
} from "@/dominio/tipos";

export function patchFondo(datos: DatosFinanzas, fondoFijo: number): DatosFinanzas {
  return { ...datos, fondoFijo };
}

export function addMovimiento(datos: DatosFinanzas, m: MovimientoCaja): DatosFinanzas {
  return { ...datos, movimientos: [m, ...datos.movimientos] };
}

export function patchMovimiento(
  datos: DatosFinanzas,
  id: string,
  patch: Partial<MovimientoCaja>,
): DatosFinanzas {
  return {
    ...datos,
    movimientos: datos.movimientos.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function removeMovimiento(datos: DatosFinanzas, id: string): DatosFinanzas {
  return {
    ...datos,
    movimientos: datos.movimientos.filter((m) => m.id !== id),
    jornadas: datos.jornadas.map((j) =>
      j.movimientoId === id ? { ...j, pagada: false, movimientoId: undefined } : j,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Certificados                                                        */
/* ------------------------------------------------------------------ */

export function addCertificado(datos: DatosFinanzas, c: CertificadoObra): DatosFinanzas {
  return { ...datos, certificados: [...datos.certificados, c] };
}

export function patchCertificado(
  datos: DatosFinanzas,
  id: string,
  patch: Partial<CertificadoObra>,
): DatosFinanzas {
  return {
    ...datos,
    certificados: datos.certificados.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function removeCertificado(datos: DatosFinanzas, id: string): DatosFinanzas {
  return {
    ...datos,
    certificados: datos.certificados.filter((c) => c.id !== id),
  };
}

/** Registra un cobro: monto cobrado, estado y un ingreso en caja (certificado). */
export function cobrarCertificado(
  datos: DatosFinanzas,
  id: string,
  cobrado: number,
): DatosFinanzas {
  const cert = datos.certificados.find((c) => c.id === id);
  if (!cert) return datos;
  const monto = Math.min(cobrado, cert.monto);
  const movimiento: MovimientoCaja = {
    id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: new Date().toISOString().slice(0, 10),
    concepto: `Cobro certificado N° ${cert.numero} — ${cert.periodo}`,
    categoria: "INGRESOS",
    fuente: "CERTIFICADO",
    metodo: "TRANSFERENCIA",
    responsable: "Admin",
    monto,
    estado: "APROBADO",
  };
  const cobradoTotal = cert.montoCobrado + monto;
  return {
    ...datos,
    certificados: datos.certificados.map((c) =>
      c.id === id
        ? {
            ...c,
            montoCobrado: cobradoTotal,
            estado: cobradoTotal >= c.monto ? "COBRADO" : "PENDIENTE",
          }
        : c,
    ),
    movimientos: [movimiento, ...datos.movimientos],
  };
}

/* ------------------------------------------------------------------ */
/* Subcontratos                                                        */
/* ------------------------------------------------------------------ */

export function addSubcontrato(datos: DatosFinanzas, s: Subcontrato): DatosFinanzas {
  return { ...datos, subcontratos: [...datos.subcontratos, s] };
}

export function patchSubcontrato(
  datos: DatosFinanzas,
  id: string,
  patch: Partial<Subcontrato>,
): DatosFinanzas {
  return {
    ...datos,
    subcontratos: datos.subcontratos.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function removeSubcontrato(datos: DatosFinanzas, id: string): DatosFinanzas {
  return {
    ...datos,
    subcontratos: datos.subcontratos.filter((s) => s.id !== id),
  };
}

/* ------------------------------------------------------------------ */
/* Jornaleros y jornadas                                               */
/* ------------------------------------------------------------------ */

export function addJornalero(datos: DatosFinanzas, j: Jornalero): DatosFinanzas {
  return { ...datos, jornaleros: [...datos.jornaleros, j] };
}

export function patchJornalero(
  datos: DatosFinanzas,
  id: string,
  patch: Partial<Jornalero>,
): DatosFinanzas {
  return {
    ...datos,
    jornaleros: datos.jornaleros.map((j) => (j.id === id ? { ...j, ...patch } : j)),
  };
}

export function addJornada(datos: DatosFinanzas, jornada: Jornada): DatosFinanzas {
  return { ...datos, jornadas: [...datos.jornadas, jornada] };
}

export function removeJornada(datos: DatosFinanzas, id: string): DatosFinanzas {
  return { ...datos, jornadas: datos.jornadas.filter((j) => j.id !== id) };
}

/**
 * Liquida a un jornalero: toma sus jornadas impagas, genera la
 * `LiquidacionJornal` y un egreso de mano de obra en caja, y marca las
 * jornadas como pagadas apuntando al movimiento creado.
 */
export function liquidarJornalero(datos: DatosFinanzas, jornaleroId: string): DatosFinanzas {
  const jornalero = datos.jornaleros.find((j) => j.id === jornaleroId);
  if (!jornalero) return datos;
  const resumen = resumirLiquidacion(jornalero, datos.jornadas);
  if (resumen.total <= 0) return datos;

  const liquidacion = aLiquidacion(jornalero, resumen, "PAGADO");
  const movimiento: MovimientoCaja = {
    id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: new Date().toISOString().slice(0, 10),
    concepto: `Liquidación ${jornalero.nombre} — ${resumen.diasTrabajados} día(s)`,
    categoria: "MANO_DE_OBRA",
    fuente: "CAJA_CHICA",
    metodo: "EFECTIVO",
    responsable: jornalero.nombre,
    monto: -resumen.total,
    estado: "APROBADO",
  };

  return {
    ...datos,
    liquidaciones: [...datos.liquidaciones, liquidacion],
    movimientos: [movimiento, ...datos.movimientos],
    jornadas: datos.jornadas.map((j) =>
      j.jornaleroId === jornaleroId && !j.pagada
        ? { ...j, pagada: true, movimientoId: movimiento.id }
        : j,
    ),
  };
}

export function patchLiquidacion(
  datos: DatosFinanzas,
  id: string,
  patch: Partial<LiquidacionJornal>,
): DatosFinanzas {
  return {
    ...datos,
    liquidaciones: datos.liquidaciones.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  };
}