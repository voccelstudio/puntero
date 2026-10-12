import { Fragment, useState } from "react";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import { useMoneda } from "@/contexto/moneda";
import { descargarCsv } from "@/dominio/exportar";
import { formatFecha, formatPct, hoyIso } from "@/dominio/formato";
import {
  claveSemana,
  informesDiarios,
  informesMensuales,
  informesSemanales,
  mesDeSemana,
  type Informe,
} from "@/dominio/informes";
import { semillaBitacora } from "@/dominio/semillas/bitacora";
import { semillaFinanzas } from "@/dominio/semillas/finanzas";
import { Boton, Card, Chip, EmptyState, Kpi, Tabla, Td, Th } from "@/ui/base";
import { BotonesExportar } from "@/ui/exportar";

type Pestania = "diarios" | "semanales" | "mensuales";

const ETIQUETA: Record<Pestania, string> = {
  diarios: "Diarios",
  semanales: "Semanales",
  mensuales: "Mensuales",
};

export function PaginaInformes() {
  const { obra } = useObra();
  const { fmt } = useMoneda();
  const bitacora = useColeccion(obra.id, "bitacora", semillaBitacora());
  const finanzas = useColeccion(obra.id, "finanzas", semillaFinanzas());
  const [pestania, setPestania] = useState<Pestania>("diarios");
  const [abierto, setAbierto] = useState<string | null>(null);

  const entradas = bitacora.datos.entradas;
  const movimientos = finanzas.datos.movimientos;

  const diarios = informesDiarios(entradas, movimientos);
  const semanales = informesSemanales(entradas, movimientos);
  const mensuales = informesMensuales(entradas, movimientos);

  const informes = pestania === "diarios" ? diarios : pestania === "semanales" ? semanales : mensuales;

  const hijos = (inf: Informe): Informe[] => {
    if (pestania === "semanales") return diarios.filter((d) => claveSemana(d.inicio) === inf.clave);
    if (pestania === "mensuales") return semanales.filter((s) => mesDeSemana(s.inicio) === inf.clave);
    return [];
  };

  const exportarCsv = () =>
    descargarCsv(
      `informes-${pestania}-${obra.codigo}`,
      ["Período", "Desde", "Hasta", "Días", "Personal prom.", "Horas", "Avance", "Días de lluvia", "Con incidencias", "Ingresos (Gs.)", "Egresos (Gs.)", "Neto (Gs.)"],
      informes.map((i) => [
        i.etiqueta,
        i.inicio,
        i.fin,
        i.dias,
        i.personalPromedio.toFixed(1).replace(".", ","),
        i.horas,
        formatPct(i.avance),
        i.diasLluvia,
        i.conIncidencias,
        i.ingresos,
        i.egresos,
        i.neto,
      ]),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Resumen · Informes</p>
          <h1 className="font-headline-xl">Informes de obra</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} · diarios, semanales (suma de diarios) y mensuales (suma de semanales) — generado al {formatFecha(hoyIso())}
          </p>
        </div>
        <BotonesExportar onCsv={exportarCsv} etiquetaCsv="Exportar" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Partes diarios" valor={diarios.length} icono="fact_check" />
        <Kpi etiqueta="Semanas con actividad" valor={semanales.length} icono="date_range" />
        <Kpi etiqueta="Meses con actividad" valor={mensuales.length} icono="calendar_view_month" />
        <Kpi etiqueta="Horas acumuladas" valor={diarios.reduce((a, d) => a + d.horas, 0)} icono="schedule" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2">
        {(Object.keys(ETIQUETA) as Pestania[]).map((id) => (
          <button
            key={id}
            onClick={() => {
              setPestania(id);
              setAbierto(null);
            }}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-label-md cursor-pointer ${
              pestania === id ? "bg-primary text-on-primary" : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {ETIQUETA[id]}
          </button>
        ))}
        {pestania !== "diarios" && (
          <span className="ml-auto font-body-sm text-on-surface-variant">
            {pestania === "semanales" ? "Cada semana suma sus partes diarios." : "Cada mes suma sus semanas."}
          </span>
        )}
      </div>

      {informes.length === 0 ? (
        <EmptyState
          icono="assessment"
          titulo="Sin informes todavía"
          descripcion="Los informes se arman con los partes de la Bitácora y los movimientos de Finanzas. Cargá datos para verlos."
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Período</Th>
              <Th derecha>Días</Th>
              <Th derecha>Personal prom.</Th>
              <Th derecha>Horas</Th>
              <Th derecha>Avance</Th>
              <Th derecha>Lluvia</Th>
              <Th derecha>Ingresos</Th>
              <Th derecha>Egresos</Th>
              <Th derecha>Neto</Th>
              {(pestania === "semanales" || pestania === "mensuales") && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {informes.map((inf) => {
              const detalle = hijos(inf);
              const expandido = abierto === inf.clave;
              return (
                <Fragment key={inf.clave}>
                  <tr className="hover:bg-surface-container-low">
                    <Td>
                      <span className="block font-body-md">{inf.etiqueta}</span>
                      <span className="block font-body-sm text-on-surface-variant">
                        {formatFecha(inf.inicio)} → {formatFecha(inf.fin)}
                        {inf.conIncidencias > 0 && <Chip className="ml-2" tono="advertencia">{inf.conIncidencias} con incidencias</Chip>}
                      </span>
                    </Td>
                    <Td derecha>{inf.dias}</Td>
                    <Td derecha>{inf.personalPromedio.toFixed(1).replace(".", ",")}</Td>
                    <Td derecha>{inf.horas}</Td>
                    <Td derecha>{formatPct(inf.avance)}</Td>
                    <Td derecha className={inf.diasLluvia > 0 ? "text-tertiary" : ""}>{inf.diasLluvia}</Td>
                    <Td derecha>{fmt(inf.ingresos)}</Td>
                    <Td derecha>{fmt(inf.egresos)}</Td>
                    <Td derecha className={inf.neto < 0 ? "text-error" : "font-medium"}>{fmt(inf.neto)}</Td>
                    {(pestania === "semanales" || pestania === "mensuales") && (
                      <Td>
                        <Boton
                          tamano="sm"
                          variante="fantasma"
                          icono={expandido ? "expand_less" : "expand_more"}
                          onClick={() => setAbierto(expandido ? null : inf.clave)}
                          disabled={detalle.length === 0}
                        />
                      </Td>
                    )}
                  </tr>
                  {expandido &&
                    detalle.map((h) => (
                      <tr key={inf.clave + h.clave} className="bg-surface-container-low/50">
                        <Td className="pl-8 text-on-surface-variant">↳ {h.etiqueta}</Td>
                        <Td derecha className="text-on-surface-variant">{h.dias}</Td>
                        <Td derecha className="text-on-surface-variant">{h.personalPromedio.toFixed(1).replace(".", ",")}</Td>
                        <Td derecha className="text-on-surface-variant">{h.horas}</Td>
                        <Td derecha className="text-on-surface-variant">{formatPct(h.avance)}</Td>
                        <Td derecha className="text-on-surface-variant">{h.diasLluvia}</Td>
                        <Td derecha className="text-on-surface-variant">{fmt(h.ingresos)}</Td>
                        <Td derecha className="text-on-surface-variant">{fmt(h.egresos)}</Td>
                        <Td derecha className="text-on-surface-variant">{fmt(h.neto)}</Td>
                        {(pestania === "semanales" || pestania === "mensuales") && <Td></Td>}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </Tabla>
      )}

      <Card className="print-break-avoid">
        <p className="font-label-sm text-on-surface-variant">
          Nota: los montos provienen de los movimientos de caja (ingresos = pagos del cliente; egresos = pagos a
          proveedores, contratistas y gastos). El avance es el declarado en el último parte del período.
        </p>
      </Card>
    </div>
  );
}
