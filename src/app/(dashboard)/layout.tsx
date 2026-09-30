import { AppShell } from "@/components/app-shell";
import { MonedaProvider } from "@/components/moneda-provider";
import { ObraProvider } from "@/components/obra-provider";
import { getCotizacion } from "@/lib/cotizacion";

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
      {/* `ObraProvider` no necesita `Suspense`: lee `window.location` después
          del montaje, no `useSearchParams`. Así las cuatro páginas siguen
          pre-renderizándose y el HTML de GitHub Pages llega con los datos. */}
      <ObraProvider>
        <AppShell>{children}</AppShell>
      </ObraProvider>
    </MonedaProvider>
  );
}
