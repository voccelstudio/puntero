/**
 * Agregación de informes de obra.
 *
 * Un informe resume un período. Las tres granularidades se construyen una
 * sobre otra, de abajo hacia arriba, para que sea literal lo que pide la obra:
 *
 *   - diario:  un parte de bitácora (más los movimientos de ese día)
 *   - semanal: la suma de los diarios de la semana ISO
 *   - mensual: la suma de los semanales cuyo lunes cae en el mes
 *
 * Así el mensual es exactamente el acumulado de lo que el usuario ya vio en
 * los diarios y semanales, sin recálculos paralelos.
 */

import type { EntradaBitacora, MovimientoCaja } from "@/dominio/tipos";

export interface Informe {
  clave: string;
  etiqueta: string;
  inicio: string;
  fin: string;
  /** Cantidad de partes diarios incluidos. */
  dias: number;
  personalPromedio: number;
  horas: number;
  /** Avance declarado al cierre del período, 0..1. */
  avance: number;
  diasLluvia: number;
  /** Partes con incidencias cargadas. */
  conIncidencias: number;
  ingresos: number;
  egresos: number;
  neto: number;
}

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fechaUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Lunes de la semana ISO a la que pertenece una fecha. */
export function inicioSemana(iso: string): string {
  const d = fechaUtc(iso);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

export function finSemana(iso: string): string {
  const d = fechaUtc(inicioSemana(iso));
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Clave de semana ISO: `2026-W03`. */
export function claveSemana(iso: string): string {
  const d = fechaUtc(iso);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia + 3);
  const anio = d.getUTCFullYear();
  const primerJueves = fechaUtc(`${anio}-01-04`);
  const ajuste = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - ajuste + 3);
  const semana = 1 + Math.round((d.getTime() - primerJueves.getTime()) / 604_800_000);
  return `${anio}-W${String(semana).padStart(2, "0")}`;
}

/** Clave de mes: `2026-03`. */
export function claveMes(iso: string): string {
  return iso.slice(0, 7);
}

export function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split("-");
  return `${MESES_LARGO[Number(mes) - 1] ?? mes} ${anio}`;
}

/** Último día del mes `YYYY-MM`. */
export function finMes(clave: string): string {
  const [anio, mes] = clave.split("-").map(Number);
  return new Date(Date.UTC(anio!, mes!, 0)).toISOString().slice(0, 10);
}

function etiquetaSemana(clave: string): string {
  const [anio, semana] = clave.split("-W");
  return `Semana ${Number(semana)} · ${anio}`;
}

/**
 * Mes al que se imputa una semana (por su jueves, el día ISO representativo).
 * Así una semana que cruza fin de mes queda del lado de la mayoría de sus días.
 */
export function mesDeSemana(inicioDeSemana: string): string {
  const d = fechaUtc(inicioDeSemana);
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 7);
}

function movimientosDelDia(movimientos: MovimientoCaja[], dia: string): MovimientoCaja[] {
  return movimientos.filter((m) => m.fecha === dia);
}

/** Combina informes hijos sumando días, horas y montos. */
function combinar(clave: string, etiqueta: string, inicio: string, fin: string, hijos: Informe[]): Informe {
  const dias = hijos.reduce((a, i) => a + i.dias, 0);
  const ingresos = hijos.reduce((a, i) => a + i.ingresos, 0);
  const egresos = hijos.reduce((a, i) => a + i.egresos, 0);
  const ultimo = [...hijos].sort((a, b) => a.fin.localeCompare(b.fin)).at(-1);
  return {
    clave,
    etiqueta,
    inicio,
    fin,
    dias,
    personalPromedio: dias === 0 ? 0 : hijos.reduce((a, i) => a + i.personalPromedio * i.dias, 0) / dias,
    horas: hijos.reduce((a, i) => a + i.horas, 0),
    avance: ultimo?.avance ?? 0,
    diasLluvia: hijos.reduce((a, i) => a + i.diasLluvia, 0),
    conIncidencias: hijos.reduce((a, i) => a + i.conIncidencias, 0),
    ingresos,
    egresos,
    neto: ingresos + egresos,
  };
}

/** Un informe por cada parte diario. */
export function informesDiarios(entradas: EntradaBitacora[], movimientos: MovimientoCaja[]): Informe[] {
  return [...entradas]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((e) => {
      const movs = movimientosDelDia(movimientos, e.fecha);
      const ingresos = movs.filter((m) => m.monto > 0).reduce((a, m) => a + m.monto, 0);
      const egresos = movs.filter((m) => m.monto < 0).reduce((a, m) => a + m.monto, 0);
      return {
        clave: e.fecha,
        etiqueta: e.fecha,
        inicio: e.fecha,
        fin: e.fecha,
        dias: 1,
        personalPromedio: e.personalPresente,
        horas: e.horasTrabajadas,
        avance: e.avance,
        diasLluvia: e.clima === "LLUVIA" || e.clima === "TORMENTA" ? 1 : 0,
        conIncidencias: (e.incidencias ?? "").trim().length > 0 ? 1 : 0,
        ingresos,
        egresos,
        neto: ingresos + egresos,
      };
    });
}

/** Suma de los diarios agrupados por semana ISO. */
export function informesSemanales(entradas: EntradaBitacora[], movimientos: MovimientoCaja[]): Informe[] {
  const grupos = new Map<string, Informe[]>();
  for (const d of informesDiarios(entradas, movimientos)) {
    const k = claveSemana(d.inicio);
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  return [...grupos.entries()]
    .map(([clave, ds]) =>
      combinar(clave, etiquetaSemana(clave), inicioSemana(ds[0]!.inicio), finSemana(ds[0]!.inicio), ds),
    )
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
}

/** Suma de los semanales agrupados por el mes de su jueves. */
export function informesMensuales(entradas: EntradaBitacora[], movimientos: MovimientoCaja[]): Informe[] {
  const grupos = new Map<string, Informe[]>();
  for (const s of informesSemanales(entradas, movimientos)) {
    const k = mesDeSemana(s.inicio);
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  return [...grupos.entries()]
    .map(([clave, ss]) => combinar(clave, etiquetaMes(clave), `${clave}-01`, finMes(clave), ss))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
}
