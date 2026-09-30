"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Moneda } from "@/lib/types";
import { formatGs, formatUsd, gsAUsd } from "@/lib/format";

interface MonedaContext {
  moneda: Moneda;
  setMoneda: (m: Moneda) => void;
  /** Guaraníes por 1 USD. */
  tipoCambio: number;
  fechaCotizacion: string;
  fuente: string;
  estimada: boolean;
  /** Convierte un monto en Gs a la moneda activa. */
  convertir: (montoGs: number) => number;
  /** Formatea un monto en Gs según la moneda activa. */
  fmt: (montoGs: number, opciones?: { decimales?: boolean }) => string;
  /** Formatea explícitamente en Gs, ignorando la moneda activa. */
  fmtGs: (montoGs: number) => string;
  /** Formatea explícitamente en USD. */
  fmtUsd: (montoGs: number) => string;
}

const Ctx = createContext<MonedaContext | null>(null);

export function MonedaProvider({
  tipoCambio,
  fechaCotizacion,
  fuente,
  estimada,
  children,
}: {
  tipoCambio: number;
  fechaCotizacion: string;
  fuente: string;
  estimada: boolean;
  children: ReactNode;
}) {
  const [moneda, setMoneda] = useState<Moneda>("PYG");

  const value = useMemo<MonedaContext>(() => {
    const convertir = (montoGs: number) =>
      moneda === "USD" ? gsAUsd(montoGs, tipoCambio) : montoGs;

    return {
      moneda,
      setMoneda,
      tipoCambio,
      fechaCotizacion,
      fuente,
      estimada,
      convertir,
      fmt: (montoGs, opciones) =>
        moneda === "USD"
          ? formatUsd(gsAUsd(montoGs, tipoCambio))
          : formatGs(montoGs, opciones),
      fmtGs: (montoGs) => formatGs(montoGs),
      fmtUsd: (montoGs) => formatUsd(gsAUsd(montoGs, tipoCambio)),
    };
  }, [moneda, tipoCambio, fechaCotizacion, fuente, estimada]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMoneda() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useMoneda debe usarse dentro de <MonedaProvider>");
  }
  return ctx;
}
