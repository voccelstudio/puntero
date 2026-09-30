import { AppShell } from "@/components/app-shell";
import { MonedaProvider } from "@/components/moneda-provider";
import { getCotizacion } from "@/lib/cotizacion";
import { OBRA } from "@/lib/data/obra";

/**
 * Toda la app depende de la cotización, así que se revalida entera cada hora
 * en lugar de dejar páginas congeladas con el tipo de cambio del build.
 */
export const revalidate = 3600;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cotizacion = await getCotizacion();

  return (
    <MonedaProvider
      tipoCambio={cotizacion.pygPorUsd}
      fechaCotizacion={cotizacion.fecha}
      fuente={cotizacion.fuente}
      estimada={cotizacion.estimada}
    >
      <AppShell
        obraNombre={OBRA.nombre}
        obraCodigo={OBRA.codigo}
        semana={OBRA.semanaActual}
        semanasTotales={OBRA.semanasTotales}
      >
        {children}
      </AppShell>
    </MonedaProvider>
  );
}
