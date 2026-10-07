/**
 * Formateo de números y fechas.
 *
 * Se hace a mano y no con `Intl.NumberFormat` porque la app se compila a
 * estáticos y se sirve desde GitHub Pages: un formateo determinista evita que
 * la primera pintura (generada en el build) difiera de la del navegador y
 * produzca parpadeos. El estilo es el del español paraguayo: punto para los
 * miles y coma para los decimales.
 */

import type { Moneda, Unidad } from "@/dominio/tipos";

function miles(numero: string): string {
  return numero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Gs. 1.500.000 — sin decimales por defecto, como se cotiza en obra. */
export function formatGs(monto: number, decimales = false): string {
  const abs = Math.abs(monto);
  const entero = Math.floor(abs);
  const frac = abs - entero;
  let salida = miles(Math.round(entero).toString());
  if (decimales) {
    const centavos = Math.round(frac * 100)
      .toString()
      .padStart(2, "0");
    salida += `,${centavos}`;
  }
  return `${monto < 0 ? "-" : ""}Gs. ${salida}`;
}

/** US$ 1.234,56 */
export function formatUsd(monto: number): string {
  const signo = monto < 0 ? "-" : "";
  const abs = Math.abs(monto);
  const entero = Math.floor(abs);
  const centavos = Math.round((abs - entero) * 100)
    .toString()
    .padStart(2, "0");
  return `${signo}US$ ${miles(entero.toString())},${centavos}`;
}

export function gsAUsd(montoGs: number, pygPorUsd: number): number {
  return pygPorUsd > 0 ? montoGs / pygPorUsd : 0;
}

export function formatMoneda(
  montoGs: number,
  moneda: Moneda,
  pygPorUsd: number,
  decimales = false,
): string {
  return moneda === "USD" ? formatUsd(gsAUsd(montoGs, pygPorUsd)) : formatGs(montoGs, decimales);
}

/** Gs. 1,2 M / US$ 850 k — para KPIs y tarjetas. */
export function formatCompacto(montoGs: number, moneda: Moneda, pygPorUsd: number): string {
  const valor = moneda === "USD" ? gsAUsd(montoGs, pygPorUsd) : montoGs;
  const signo = valor < 0 ? "-" : "";
  const abs = Math.abs(valor);
  const sufijo = moneda === "USD" ? "US$ " : "Gs. ";

  if (abs >= 1_000_000_000) return `${signo}${sufijo}${corta(abs / 1_000_000_000)} B`;
  if (abs >= 1_000_000) return `${signo}${sufijo}${corta(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${signo}${sufijo}${corta(abs / 1_000)} k`;
  return `${signo}${sufijo}${Math.round(abs).toString()}`;
}

function corta(valor: number): string {
  const texto = valor.toFixed(1);
  return texto.endsWith(",0") ? texto.slice(0, -2) : texto;
}

const UNIDADES: Record<Unidad, string> = {
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

export function formatUnidad(unidad: Unidad): string {
  return UNIDADES[unidad] ?? unidad;
}

/**
 * Fecha a partir de un ISO `YYYY-MM-DD`. Se parsea como UTC para que la
 * zona horaria del navegador no corra el día hacia atrás.
 */
export function formatFecha(iso: string, variante: "corta" | "larga" = "corta"): string {
  if (!iso) return "—";
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  const [a, m, d] = partes as [string, string, string];
  const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "UTC",
    day: "2-digit",
    month: variante === "corta" ? "2-digit" : "long",
    year: "numeric",
  }).format(fecha);
}

export function formatPct(valor: number, decimales = 1): string {
  return `${(valor * 100).toFixed(decimales).replace(".", ",")}%`;
}

/** Con signo explícito: +7,3% / -2,0%. Para desvíos y variaciones. */
export function formatPctSigno(valor: number, decimales = 1): string {
  const pct = valor * 100;
  const texto = `${Math.abs(pct).toFixed(decimales).replace(".", ",")}%`;
  if (pct > 0) return `+${texto}`;
  if (pct < 0) return `-${texto}`;
  return texto;
}

/** Días entre dos fechas ISO, sin depender de la zona horaria. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Hoy en ISO local `YYYY-MM-DD`, para precargar formularios. */
export function hoyIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Suma días calendario a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
