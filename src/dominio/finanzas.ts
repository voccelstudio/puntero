import type {
  DatosFinanzas,
  Jornalero,
  Jornada,
  LiquidacionJornal,
  MovimientoCaja,
} from "@/dominio/tipos";

/** Caja chica: neto de todos los movimientos de caja. */
export function netoMovimientos(movs: MovimientoCaja[]): number {
  return movs.reduce((a, m) => a + m.monto, 0);
}

export function saldoCaja(datos: DatosFinanzas): number {
  return datos.fondoFijo + netoMovimientos(datos.movimientos.filter((m) => m.fuente === "CAJA_CHICA"));
}

export function ingresos(movs: MovimientoCaja[]): number {
  return movs.filter((m) => m.monto > 0).reduce((a, m) => a + m.monto, 0);
}

export function egresos(movs: MovimientoCaja[]): number {
  return movs.filter((m) => m.monto < 0).reduce((a, m) => a + m.monto, 0);
}

export function movimientosDelPeriodo(movs: MovimientoCaja[], inicioMes: string): MovimientoCaja[] {
  return movs.filter((m) => m.fecha >= inicioMes);
}

export function totalCertificado(certs: DatosFinanzas["certificados"]): number {
  return certs.reduce((a, c) => a + c.monto, 0);
}

export function totalCobrado(certs: DatosFinanzas["certificados"]): number {
  return certs.reduce((a, c) => a + c.montoCobrado, 0);
}

export function totalContratado(subs: DatosFinanzas["subcontratos"]): number {
  return subs.reduce((a, s) => a + s.montoContratado, 0);
}

export function totalCertificadoSub(subs: DatosFinanzas["subcontratos"]): number {
  return subs.reduce((a, s) => a + s.montoCertificado, 0);
}

/* ------------------------------------------------------------------ */
/* Jornaleros y liquidaciones                                          */
/* ------------------------------------------------------------------ */

/**
 * Monto de una jornada: jornal/hora con 50% de recargo para las horas
 * extra. Sin importar cómo se carguen las horas, la liquidación siempre
 * sale coherente con el jornal diario base.
 */
export function montoJornada(jornalero: Jornalero, jornada: Jornada): number {
  const porHora = jornalero.jornalDiario / 8;
  return Math.round(porHora * jornada.horasNormales + porHora * 1.5 * jornada.horasExtra);
}

export interface ResumenLiquidacion {
  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtra: number;
  total: number;
}

/** Agrega todas las jornadas sin pagar de un jornalero en una liquidación. */
export function resumirLiquidacion(
  jornalero: Jornalero,
  jornadas: Jornada[],
): ResumenLiquidacion {
  const mías = jornadas.filter((j) => j.jornaleroId === jornalero.id && !j.pagada);
  const dias = new Set(mías.map((j) => j.fecha)).size;
  const horasOrdinarias = mías.reduce((a, j) => a + j.horasNormales, 0);
  const horasExtra = mías.reduce((a, j) => a + j.horasExtra, 0);
  const total = Math.round(
    mías.reduce((a, j) => a + montoJornada(jornalero, j), 0),
  );
  return { diasTrabajados: dias, horasOrdinarias, horasExtra, total };
}

/** Convierte un resumen en la liquidación tipada que va a `localStorage`. */
export function aLiquidacion(
  jornalero: Jornalero,
  resumen: ResumenLiquidacion,
  estado: LiquidacionJornal["estado"] = "PENDIENTE",
): LiquidacionJornal {
  return {
    id: `liq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    nombre: jornalero.nombre,
    ci: jornalero.ci,
    oficio: jornalero.oficio,
    diasTrabajados: resumen.diasTrabajados,
    horasOrdinarias: resumen.horasOrdinarias,
    horasExtra: resumen.horasExtra,
    jornalDiario: jornalero.jornalDiario,
    total: resumen.total,
    estado,
  };
}

export const ROL_NOMBRE: Record<Jornalero["rol"], string> = {
  AYUDANTE: "Ayudante",
  OFICIAL: "Oficial",
  PUNTERO: "Puntero",
  ESPECIALISTA: "Especialista",
};

export const CATEGORIA_NOMBRE: Record<MovimientoCaja["categoria"], string> = {
  MATERIALES: "Materiales",
  MANO_DE_OBRA: "Mano de obra",
  SUBCONTRATOS: "Subcontratos",
  MAQUINARIAS: "Maquinarias",
  SERVICIOS: "Servicios",
  TRAMITES: "Trámites",
  VIATICOS: "Viáticos",
  ALMACEN: "Almacén",
  HONORARIOS: "Honorarios",
  INGRESOS: "Ingresos",
  OTROS: "Otros",
};

export const FUENTE_NOMBRE: Record<MovimientoCaja["fuente"], string> = {
  CAJA_CHICA: "Caja chica",
  CUENTA: "Cuenta",
  ANTICIPO: "Anticipo",
  CERTIFICADO: "Certificado",
  OTRO: "Otro",
};

export const METODO_NOMBRE: Record<MovimientoCaja["metodo"], string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  TARJETA: "Tarjeta",
  DEPOSITO: "Depósito",
};