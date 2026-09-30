/**
 * Cotización Gs/USD.
 *
 * Fuente: open.er-api.com (gratuita, sin clave, 160+ monedas, incluye PYG).
 * Es una tasa de referencia, no la del BCP. Para emitir certificados y
 * presentar a comitentes hay que permitir configurar un proveedor de tasa
 * comercial (ver `proveedor`).
 */

import { cache } from "react";

export interface Cotizacion {
  /** Guaraníes por 1 dólar. */
  pygPorUsd: number;
  fecha: string;
  /** Moneda contra la que se cotiza siempre. */
  base: "USD";
  fuente: string;
  /** true cuando el valor vino del respaldo local y no de la red. */
  estimada: boolean;
}

/** Respaldo offline. Se usa solo si la API no responde, para que la pantalla
 *  siga renderizando en vez de romper la navegación. */
const COTIZACION_FALLBACK: Cotizacion = {
  pygPorUsd: 7300,
  fecha: "2024-10-16",
  base: "USD",
  fuente: "respaldo local",
  estimada: true,
};

const API_URL = "https://open.er-api.com/v6/latest/USD";
const REVALIDATE_SEGUNDOS = 3600;

interface RespuestaER {
  result: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

async function consultar(): Promise<Cotizacion> {
  try {
    const res = await fetch(API_URL, {
      // La tasa se revalida cada hora: alcanza para el día y evita pegarle
      // al proveedor en cada render.
      next: { revalidate: REVALIDATE_SEGUNDOS },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as RespuestaER;
    const valor = data.rates?.PYG;

    if (data.result !== "success" || typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
      throw new Error("Respuesta sin tasa PYG válida");
    }

    return {
      pygPorUsd: valor,
      fecha: data.time_last_update_utc,
      base: "USD",
      fuente: "Banco Central del Paraguay (vía open.er-api.com)",
      estimada: false,
    };
  } catch {
    return COTIZACION_FALLBACK;
  }
}

/**
 * Deduplicado por request: si varias pantallas del mismo render piden la
 * cotización, se hace una sola llamada.
 */
export const getCotizacion = cache(consultar);

/** Igual que `getCotizacion` pero garantiza salida fresca. Útil tras una
 *  acción del usuario que depende del tipo de cambio del momento. */
export async function getCotizacionActualizada() {
  const res = await fetch(`${API_URL}?t=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  const data = (await res.json()) as RespuestaER;
  const valor = data.rates?.PYG;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return COTIZACION_FALLBACK;
  }
  return {
    pygPorUsd: valor,
    fecha: data.time_last_update_utc,
    base: "USD" as const,
    fuente: "Banco Central del Paraguay (vía open.er-api.com)",
    estimada: false,
  };
}
