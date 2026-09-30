import type { Moneda } from "@/lib/types";

/**
 * Formateo de moneda y números con las convenciones de Paraguay.
 *
 * Guaraní: sin decimales, separador de miles con punto (Gs. 1.500.000).
 * Dólar: dos decimales, separador con punto (US$ 1.234,56).
 *
 * `Intl` con locale `es-PY` no produce el formato de miles con punto de forma
 * consistente entre runtimes, por eso se formatea a mano. Esto además evita
 * discrepancias entre el HTML renderizado en servidor y el hidratado en cliente.
 */

const MIL = 1000;

function separarMiles(valor: string, sep: string) {
  return valor.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatGs(monto: number, opciones: { decimales?: boolean } = {}): string {
  const { decimales = false } = opciones;
  const negativo = monto < 0;
  const abs = Math.abs(monto);
  const entero = Math.floor(abs);
  const frac = Math.round((abs - entero) * 100);

  let cuerpo = separarMiles(String(entero), ".");
  if (decimales && frac > 0) {
    cuerpo += "," + String(frac).padStart(2, "0");
  }
  return `${negativo ? "-" : ""}Gs. ${cuerpo}`;
}

export function formatUsd(monto: number): string {
  const negativo = monto < 0;
  const abs = Math.abs(monto);
  const entero = Math.floor(abs);
  const frac = Math.round((abs - entero) * 100);
  const cuerpo = separarMiles(String(entero), ".") + "," + String(frac).padStart(2, "0");
  return `${negativo ? "-" : ""}US$ ${cuerpo}`;
}

/**
 * Convierte de Gs a USD usando la cotización en Gs por 1 USD.
 * Devuelve el monto ya en dólares.
 */
export function gsAUsd(montoGs: number, tipoCambio: number): number {
  if (tipoCambio <= 0) return 0;
  return montoGs / tipoCambio;
}

export function formatMoneda(
  montoGs: number,
  moneda: Moneda,
  tipoCambio: number,
  opciones: { decimales?: boolean } = {},
): string {
  return moneda === "USD"
    ? formatUsd(gsAUsd(montoGs, tipoCambio))
    : formatGs(montoGs, opciones);
}

/**
 * Versión compacta para KPIs: Gs. 1,5 M / US$ 21.300
 * Se usa donde el número exacto estorba y se mantiene el dato completo en el
 * title del elemento para no perder precisión.
 */
export function formatCompacto(montoGs: number, moneda: Moneda, tipoCambio: number): string {
  const valor = moneda === "USD" ? gsAUsd(montoGs, tipoCambio) : montoGs;
  const prefijo = moneda === "USD" ? "US$ " : "Gs. ";
  const signo = valor < 0 ? "-" : "";
  const abs = Math.abs(valor);

  if (moneda === "PYG") {
    if (abs >= 1_000_000_000) return `${signo}${prefijo}${trim(abs / 1_000_000_000)} MM`;
    if (abs >= 1_000_000) return `${signo}${prefijo}${trim(abs / 1_000_000)} M`;
    if (abs >= MIL) return `${signo}${prefijo}${trim(abs / MIL)} mil`;
    return formatGs(montoGs);
  }

  if (abs >= 1_000_000) return `${signo}${prefijo}${trim(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${signo}${prefijo}${trim(abs / 1_000)} k`;
  return formatUsd(gsAUsd(montoGs, tipoCambio));
}

function trim(n: number) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
}

/* ------------------------------------------------------------------ */
/* Números y fechas                                                    */
/* ------------------------------------------------------------------ */

const UNIDADES_ABBR: Record<string, string> = {
  m2: "m²",
  m3: "m³",
  m: "m",
  ml: "ml",
  kg: "kg",
  gl: "gl",
  u: "u",
  dia: "día",
  jornal: "jornal",
  mes: "mes",
};

export function formatUnidad(u: string) {
  return UNIDADES_ABBR[u] ?? u;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-PY", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Las fechas del dominio son ISO `YYYY-MM-DD`; se parsean en UTC a propósito
 *  para que el día no cambie según la zona horaria del cliente. */
export function formatFecha(iso: string, variante: "corta" | "larga" = "corta") {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return (variante === "larga" ? FECHA_LARGA : FECHA_CORTA).format(d);
}

export function formatPct(valor: number, decimales = 1) {
  return `${(valor * 100).toFixed(decimales)}%`;
}

export function formatPctSigno(valor: number, decimales = 1) {
  const signo = valor > 0 ? "+" : "";
  return `${signo}${(valor * 100).toFixed(decimales)}%`;
}

export function formatNumero(n: number, decimales = 0) {
  return separarMiles(
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }),
    ".",
  );
}

/** Días entre hoy y una fecha ISO, negativo si ya pasó. */
export function diasHasta(iso: string, desde = new Date()) {
  const hoy = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const f = new Date(iso + "T00:00:00Z").getTime();
  return Math.round((f - hoy) / 86_400_000);
}
