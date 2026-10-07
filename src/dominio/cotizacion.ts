/**
 * Cotización Gs/USD.
 *
 * Fuente: open.er-api.com (gratuita, sin clave, incluye PYG). Es una tasa de
 * referencia, no la del Banco Central del Paraguay, y la UI lo rotula como
 * "referencia, no oficial". Para producir certificados hay que enchufar una
 * fuente oficial.
 *
 * Si la red falla se usa el respaldo local: la app nunca debe quedar vacía
 * solo porque no hay cotización.
 */

export interface Cotizacion {
  /** Guaraníes por 1 dólar. */
  pygPorUsd: number;
  fecha: string;
  base: "USD";
  fuente: string;
  /** true cuando el valor vino del respaldo local y no de la red. */
  estimada: boolean;
}

export const COTIZACION_FALLBACK: Cotizacion = {
  pygPorUsd: 7300,
  fecha: "2024-10-16",
  base: "USD",
  fuente: "respaldo local",
  estimada: true,
};

const API_URL = "https://open.er-api.com/v6/latest/USD";
const CLAVE_CACHE = "puntero.v1.cotizacion";

interface RespuestaER {
  result: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

let promesa: Promise<Cotizacion> | null = null;

function leerCache(): Cotizacion | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_CACHE);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Cotizacion & { guardado: number };
    if (typeof dato?.pygPorUsd !== "number") return null;
    // Un día de vida: sirve para arrancar offline sin mostrar una tasa vieja.
    if (Date.now() - dato.guardado > 24 * 60 * 60 * 1000) return null;
    return dato;
  } catch {
    return null;
  }
}

function guardarCache(cotizacion: Cotizacion): void {
  try {
    window.localStorage.setItem(
      CLAVE_CACHE,
      JSON.stringify({ ...cotizacion, guardado: Date.now() }),
    );
  } catch {
    // Cuota llena o modo privado: la tasa sigue siendo la de esta sesión.
  }
}

async function consultar(): Promise<Cotizacion> {
  const cacheado = leerCache();
  if (cacheado) return cacheado;

  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as RespuestaER;
    const valor = data.rates?.PYG;

    if (
      data.result !== "success" ||
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      throw new Error("Respuesta sin tasa PYG válida");
    }

    const cotizacion: Cotizacion = {
      pygPorUsd: valor,
      fecha: data.time_last_update_utc,
      base: "USD",
      fuente: "open.er-api.com (referencia, no oficial)",
      estimada: false,
    };
    guardarCache(cotizacion);
    return cotizacion;
  } catch {
    return COTIZACION_FALLBACK;
  }
}

/**
 * Deduplicado: si varias pantallas del mismo render piden la cotización, se
 * hace una sola llamada. En el navegador se cachea además en `localStorage`.
 */
export function getCotizacion(): Promise<Cotizacion> {
  promesa ??= consultar();
  return promesa;
}
