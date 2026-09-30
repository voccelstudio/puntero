import { AppShell } from "@/components/app-shell";
import { MonedaProvider } from "@/components/moneda-provider";
import { getCotizacion } from "@/lib/cotizacion";
import { OBRA } from "@/lib/data/obra";

// Sin `revalidate` a propósito: la revalidación incremental necesita un
// servidor, y el export estático de GitHub Pages no la soporta. La cotización
// se resuelve una vez en cada build — para tenerla al día hay que redesplegar.

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
