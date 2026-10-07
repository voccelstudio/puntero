import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCotizacion } from "@/dominio/cotizacion";
import {
  formatCompacto,
  formatGs,
  formatMoneda,
  formatUsd,
  gsAUsd,
} from "@/dominio/formato";
import type { Moneda } from "@/dominio/tipos";

/**
 * Moneda activa (Gs / US$) y formateadores.
 *
 * Todos los montos se guardan en guaraníes; el dólar es derivado contra la
 * cotización del día, con respaldo offline. La última moneda elegida se
 * guarda en `localStorage`.
 */

interface ContextoMoneda {
  moneda: Moneda;
  setMoneda: (m: Moneda) => void;
  pygPorUsd: number;
  cotizacionEstimada: boolean;
  fuenteCotizacion: string;
  fechaCotizacion: string;
  fmtGs: (m: number, decimales?: boolean) => string;
  fmtUsd: (m: number) => string;
  fmt: (m: number, decimales?: boolean) => string;
  fmtCompacto: (m: number) => string;
  aUsd: (m: number) => number;
}

const Ctx = createContext<ContextoMoneda | null>(null);

const CLAVE_MONEDA = "puntero.v1.moneda";

function monedaGuardada(): Moneda {
  try {
    const leida = window.localStorage.getItem(CLAVE_MONEDA);
    return leida === "USD" ? "USD" : "PYG";
  } catch {
    return "PYG";
  }
}

export function MonedaProvider({ children }: { children: ReactNode }) {
  const [moneda, setMonedaState] = useState<Moneda>(monedaGuardada);
  const [cotizacion, setCotizacion] = useState({
    pygPorUsd: 0,
    estimada: true,
    fuente: "cargando…",
    fecha: "",
  });

  useEffect(() => {
    let vivo = true;
    getCotizacion().then((c) => {
      if (!vivo) return;
      setCotizacion({
        pygPorUsd: c.pygPorUsd,
        estimada: c.estimada,
        fuente: c.fuente,
        fecha: c.fecha,
      });
    });
    return () => {
      vivo = false;
    };
  }, []);

  const setMoneda = (m: Moneda) => {
    setMonedaState(m);
    try {
      window.localStorage.setItem(CLAVE_MONEDA, m);
    } catch {
      // Sin almacenamiento: la moneda rige solo esta sesión.
    }
  };

  const valor = useMemo<ContextoMoneda>(
    () => ({
      moneda,
      setMoneda,
      pygPorUsd: cotizacion.pygPorUsd,
      cotizacionEstimada: cotizacion.estimada,
      fuenteCotizacion: cotizacion.fuente,
      fechaCotizacion: cotizacion.fecha,
      fmtGs: (m, decimales = false) => formatGs(m, decimales),
      fmtUsd: (m) => formatUsd(m),
      fmt: (m, decimales = false) =>
        formatMoneda(m, moneda, cotizacion.pygPorUsd || 7300, decimales),
      fmtCompacto: (m) => formatCompacto(m, moneda, cotizacion.pygPorUsd || 7300),
      aUsd: (m) => gsAUsd(m, cotizacion.pygPorUsd || 7300),
    }),
    [moneda, cotizacion],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useMoneda(): ContextoMoneda {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMoneda fuera del <MonedaProvider>");
  return ctx;
}