import { Boton, Card, Icono } from "@/ui/base";

/** Pantalla en blanco para módulos planificados y todavía no construidos. */
export function Proximamente({
  modulo,
  icono,
}: {
  modulo: string;
  icono: string;
}) {
  return (
    <div className="max-w-xl mx-auto">
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-md bg-primary-container text-on-primary-container border border-primary/40">
          <Icono nombre={icono} tamaño={28} />
        </span>
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">
            Módulo planificado
          </p>
          <h1 className="font-headline-xl">{modulo}</h1>
          <p className="font-body-md text-on-surface-variant mt-2">
            Este módulo se construye en la fase correspondiente del plan Puntero 5.0. Mientras
            tanto, el presupuesto ya está operativo.
          </p>
        </div>
        <Boton variante="primario" icono="receipt_long" onClick={() => (window.location.hash = "#/presupuesto")}>
          Ir al presupuesto
        </Boton>
      </Card>
    </div>
  );
}