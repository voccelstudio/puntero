"use client";

import { useMemo } from "react";
import { useMoneda } from "@/components/moneda-provider";
import {
  Button,
  Card,
  CardAcento,
  CardTitle,
  Chip,
  Gauge,
  Kpi,
  Progress,
  SectionHeader,
  Td,
  Tabla,
} from "@/components/ui";
import { useObra } from "@/components/obra-provider";
import { useColeccion } from "@/lib/datos/almacen";
import { calcularAvanceFisico, calcularDesvio, calcularPresupuesto } from "@/lib/calculo";
import {
  formatFecha,
  formatNumero,
  formatPct,
  formatPctSigno,
  formatUnidad,
} from "@/lib/format";
import type { CriticidadHito, Hito } from "@/lib/types";
import { Icono } from "@/components/icono";

const TONO_HITO: Record<CriticidadHito, string> = {
  CRITICO: "bg-error-container/40",
  EN_CURSO: "bg-surface-container-low",
  PROGRAMADO: "bg-surface-container-lowest",
};

const CHIP_HITO: Record<CriticidadHito, "error" | "exito" | "neutro"> = {
  CRITICO: "error",
  EN_CURSO: "exito",
  PROGRAMADO: "neutro",
};

const ETIQUETA_HITO: Record<CriticidadHito, string> = {
  CRITICO: "Hito crítico",
  EN_CURSO: "En curso",
  PROGRAMADO: "Programada",
};

function Milestone({ hito }: { hito: Hito }) {
  return (
    <div className={`flex flex-col gap-space-sm rounded p-space-md md:flex-row md:items-center md:justify-between ${TONO_HITO[hito.criticidad]}`}>
      <div className="flex items-start gap-space-md">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${
            hito.criticidad === "CRITICO"
              ? "bg-error-container text-on-error-container"
              : hito.criticidad === "EN_CURSO"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-secondary"
          }`}
        >
          <Icono name={hito.icono} className="text-xl" />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <Chip tono={CHIP_HITO[hito.criticidad]}>
              {ETIQUETA_HITO[hito.criticidad]}
            </Chip>
            {hito.criticidad === "CRITICO" ? (
              <span className="font-label-sm text-label-sm font-semibold text-error">
                {hito.fecha}
              </span>
            ) : (
              <span className="font-label-sm text-label-sm text-secondary">{hito.fecha}</span>
            )}
          </div>
          <h3
            className={`mt-1 font-headline-sm text-headline-sm ${
              hito.criticidad === "CRITICO" ? "font-bold text-on-surface" : "font-semibold text-on-surface"
            }`}
          >
            {hito.titulo}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{hito.descripcion}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-space-xs md:items-end">
        {hito.avance !== undefined ? (
          <>
            <div className="w-full md:w-44">
              <Progress
                valor={hito.avance}
                alto="lg"
                tono={hito.avance > 0.7 ? "primary" : "tertiary"}
              />
            </div>
            <span className="font-label-sm text-label-sm text-secondary">
              Avance: {formatPct(hito.avance, 0)} · {hito.fecha}
            </span>
          </>
        ) : (
          <>
            <span className="font-label-sm text-label-sm text-secondary">
              A cargo de: {hito.responsable}
            </span>
            {hito.accion ? (
              <Button variante={hito.criticidad === "CRITICO" ? "primario" : "secundario"}>
                {hito.accion}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function CentroDeComando() {
  const { fmt, fmtGs, moneda, tipoCambio } = useMoneda();
  const { obra, semilla } = useObra();

  const { datos: presupuestoDatos, guardar: guardarPresupuesto } = useColeccion(
    obra.id,
    "presupuesto",
    semilla.presupuesto,
  );
  const { datos: comando } = useColeccion(obra.id, "comando", semilla.comando);

  const todosLosItems = presupuestoDatos.fases.flatMap((f) => f.items);
  const presupuesto = calcularPresupuesto(
    todosLosItems,
    presupuestoDatos.parametros,
  );
  const avanceFisico = calcularAvanceFisico(todosLosItems);
  const desvio = calcularDesvio(todosLosItems);

  const cuadrillas = comando.cuadrillas;
  const precioPromedio =
    cuadrillas.length > 0
      ? cuadrillas.reduce((acc, c) => acc + c.rendimientoPct, 0) / cuadrillas.length
      : 0;
  const horasImproductivas = cuadrillas.reduce((acc, c) => acc + c.horasImproductivas, 0);

  // Los dias restantes se miden contra la fecha del navegador: la app es
  // estatica y no hay servidor que sepa que dia es.
  const diasRestantes = useMemo(() => {
    const hoy = new Date();
    const fin = new Date(obra.finEstimado + "T00:00:00");
    if (Number.isNaN(fin.getTime())) return 0;
    return Math.max(0, Math.round((fin.getTime() - hoy.getTime()) / 86_400_000));
  }, [obra.finEstimado]);
  void guardarPresupuesto;

  return (
    <div className="space-y-space-lg">
      {/* Franja de contexto de ejecución */}
      <section className="rounded bg-surface-container-low px-space-lg py-space-md shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-sm">
              <Chip tono="exito">Fase estructural</Chip>
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                <Icono name="location_on" className="text-sm" />
                {obra.ubicacion}
              </span>
              <span className="text-surface-dim">•</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {obra.codigo}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-space-md">
              <h2 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                {obra.nombre}
              </h2>
              <div className="flex items-center gap-space-xs rounded bg-tertiary-container/30 px-space-sm py-0.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
                <span className="font-label-sm text-label-sm font-semibold text-on-tertiary-container">
                  En plazo (desvío global: {formatPctSigno(desvio.pct)})
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-space-md">
            <div className="flex items-center gap-space-sm rounded bg-surface-container-lowest px-space-md py-space-xs shadow-sm">
              <div className="flex flex-col border-r border-surface-container pr-space-sm">
                <span className="font-label-sm text-label-sm text-secondary">Inicio</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {formatFecha(obra.inicio)}
                </span>
              </div>
              <div className="flex flex-col border-r border-surface-container pr-space-sm">
                <span className="font-label-sm text-label-sm text-secondary">Fin estimado</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {formatFecha(obra.finEstimado)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm font-bold text-primary">
                  Días restantes
                </span>
                <span className="font-label-md text-label-md font-bold text-primary">
                  {diasRestantes} días
                </span>
              </div>
            </div>
            <Button>
              <Icono name="receipt_long" className="text-base" />
              Emitir certificado
            </Button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta="Progreso físico global"
          valor={formatPct(avanceFisico)}
          pie={`Base planeada: ${formatPct(0.56)}`}
          variacion={desvio.favorable ? -desvio.pct : -desvio.pct}
          progreso={avanceFisico}
          icono={<Gauge valor={avanceFisico} tamano="sm" />}
        />
        <Kpi
          etiqueta="Financiero certificado"
          valor={fmt(presupuesto.costoDirecto * 0.84)}
          unidad={moneda}
          pie={`de ${fmt(presupuesto.total)} presupuestado`}
          tonoTrafilla="tertiary"
          progreso={0.589}
          icono={
            <div className="rounded bg-secondary-container p-space-xs text-on-secondary-container">
              <Icono name="payments" className="text-xl" />
            </div>
          }
        />
        <Kpi
          etiqueta="Rendimiento de cuadrillas"
          valor={formatPctSigno(precioPromedio / 100)}
          pie={`Horas improductivas: ${horasImproductivas.toFixed(1)} h / sem`}
          tonoTrafilla="secondary"
          icono={
            <div className="rounded bg-surface-container-high p-space-xs text-on-surface">
              <Icono name="speed" className="text-xl" />
            </div>
          }
        />
        <Kpi
          etiqueta="Personal en obra hoy"
          valor="34"
          unidad="operarios activos"
          pie="Presentismo: 97,1% (turno mañana)"
          tonoTrafilla="primary-container"
          icono={
            <div className="rounded bg-surface-container p-space-xs text-primary">
              <Icono name="groups" className="text-xl" />
            </div>
          }
        />
      </section>

      {/* Cuerpo: 8 + 4 columnas */}
      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          {/* Cronograma y hitos */}
          <Card className="overflow-hidden">
            <SectionHeader
              titulo="Cronograma crítico e hitos operativos"
              icono={<Icono name="pending_actions" className="text-primary text-xl" />}
              acciones={
                <>
                  <span className="rounded bg-surface-container-highest px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-surface">
                    Semana {obra.semanaActual} / {obra.semanasTotales}
                  </span>
                  <Button variante="fantasma" title="Ver Gantt completo">
                    <Icono name="open_in_new" className="text-base" />
                  </Button>
                </>
              }
            />
            <div className="flex flex-col gap-space-md p-space-md">
              {comando.hitos.map((hito) => (
                <Milestone key={hito.id} hito={hito} />
              ))}
            </div>
          </Card>

          {/* Bitácora y OT */}
          <Card className="overflow-hidden">
            <SectionHeader
              titulo="Bitácora diaria y órdenes de trabajo"
              icono={<Icono name="menu_book" className="text-primary text-xl" />}
              acciones={
                <Button>
                  <Icono name="add_circle" className="text-base" />+ Nueva entrada / OT
                </Button>
              }
            />
            <div className="flex flex-col gap-space-lg p-space-md">
              {comando.ordenesTrabajo.map((ot) => (
                <div
                  key={ot.id}
                  className="flex flex-col gap-space-sm rounded bg-surface-container-lowest p-space-md shadow-sm print-break-avoid"
                >
                  <div className="flex flex-wrap items-center justify-between gap-space-sm">
                    <div className="flex flex-wrap items-center gap-space-sm">
                      <span className="rounded bg-primary-fixed px-2 py-0.5 font-label-md text-label-md font-bold text-primary">
                        OT #{ot.id.replace("ot-", "")}
                      </span>
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        {ot.titulo}
                      </span>
                    </div>
                    {ot.estado === "EN_PROCESO" ? (
                      <span className="flex items-center gap-1 rounded bg-secondary-container px-2 py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-container">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                        En proceso
                      </span>
                    ) : (
                      <Chip tono="neutro">Finalizada</Chip>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-space-sm rounded bg-surface-container-low/60 px-space-sm py-space-xs md:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary">
                        Responsable técnico
                      </span>
                      <span className="font-body-md text-body-md font-semibold text-on-surface">
                        {ot.responsable}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary">Cuadrilla</span>
                      <span className="font-body-md text-body-md text-on-surface">
                        {ot.cuadrilla}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary">
                        Inicio / fin previsto
                      </span>
                      <span className="font-label-md text-label-md text-on-surface">
                        {ot.horario}
                      </span>
                    </div>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {ot.descripcion}
                    {ot.norma ? (
                      <>
                        {" "}
                        <span className="font-mono text-label-sm">Ensayo según {ot.norma}.</span>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}

              {comando.bitacora.map((entrada) => (
                <div key={entrada.id} className="flex flex-col gap-space-sm">
                  <div className="flex flex-wrap items-center justify-between gap-space-xs">
                    <div className="flex items-center gap-space-xs text-on-surface">
                      <Icono name="photo_camera" className="text-base text-primary" />
                      <span className="font-headline-sm text-headline-sm font-semibold">
                        {entrada.titulo}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary">
                      {formatFecha(entrada.fecha)}, {entrada.hora} · {entrada.autor}
                    </span>
                  </div>

                  <div className="flex flex-col gap-space-md rounded bg-surface-container-low p-space-sm md:flex-row">
                    <div className="flex flex-col justify-between py-1">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-space-sm">
                          <Chip tono="tertiary">Condición aprobada</Chip>
                          <span className="flex items-center gap-0.5 font-label-sm text-label-sm text-secondary">
                            <Icono name="wb_sunny" className="text-sm" />
                            {entrada.clima.temperatura}°C · {entrada.clima.condicion} · Viento{" "}
                            {entrada.clima.viento} km/h
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface">
                          &ldquo;{entrada.cuerpo}&rdquo;
                        </p>
                      </div>
                      <div className="mt-space-sm flex flex-wrap items-center gap-space-md border-t border-surface-container pt-space-xs font-label-sm text-label-sm text-secondary">
                        <span className="flex items-center gap-1">
                          <Icono name="attachment" className="text-sm" />
                          {entrada.adjuntos} archivos adjuntos
                        </span>
                        {entrada.firmaValidada ? (
                          <span className="flex items-center gap-1">
                            <Icono name="verified" className="text-sm" />
                            Firma digital validada
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-space-lg lg:col-span-4">
          {/* Cómputo y rendimiento */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-space-md">
              <CardTitle
                titulo="Cómputo métrico y rendimiento"
                icono={<Icono name="bar_chart" className="text-primary text-xl" />}
              />
              <span className="font-label-sm text-label-sm text-secondary">Real vs. presup.</span>
            </div>
            <div className="flex flex-col gap-space-md p-space-md">
              {comando.computo.map((item) => {
                const pct = item.presupuestado > 0 ? item.ejecutado / item.presupuestado : 0;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 rounded p-space-xs transition-colors hover:bg-surface-container-low"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        {item.rubro}
                      </span>
                      <Chip tono={item.tono === "primario" ? "tertiary" : item.tono === "tertiary" ? "exito" : "neutro"}>
                        {item.nota}
                      </Chip>
                    </div>
                    <div className="flex items-baseline justify-between font-label-sm text-label-sm text-secondary">
                      <span>
                        Ejecutado:{" "}
                        <strong className="font-label-md text-label-md text-on-surface">
                          {formatNumero(item.ejecutado)} {formatUnidad(item.unidad)}
                        </strong>{" "}
                        / {formatNumero(item.presupuestado)} {formatUnidad(item.unidad)}
                      </span>
                      <span className="font-bold text-on-surface">{formatPct(pct)}</span>
                    </div>
                    <Progress
                      valor={pct}
                      alto="lg"
                      tono={item.tono === "primario" ? "primary" : item.tono === "tertiary" ? "tertiary" : "secondary"}
                      className="mt-1"
                    />
                  </div>
                );
              })}

              <div className="mt-space-xs flex items-center justify-between rounded bg-surface-container-low p-space-sm">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm uppercase text-secondary">
                    Desvío acumulado en costo
                  </span>
                  <span
                    className={`font-label-md text-label-md font-bold ${
                      desvio.favorable ? "text-tertiary" : "text-secondary"
                    }`}
                  >
                    {fmt(desvio.monto)} ({desvio.favorable ? "Ahorro" : "Sobrecosto"})
                  </span>
                </div>
                <Icono
                  name={desvio.favorable ? "trending_down" : "trending_up"}
                  className={`text-2xl ${desvio.favorable ? "text-tertiary" : "text-secondary"}`}
                />
              </div>
            </div>
          </Card>

          {/* Seguridad y clima */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-space-md">
              <CardTitle
                titulo="Seguridad (HSE) y clima"
                icono={<Icono name="health_and_safety" className="text-tertiary text-xl" />}
              />
              <span className="rounded bg-tertiary-fixed px-1.5 py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-fixed">
                0 accidentes
              </span>
            </div>
            <div className="flex flex-col gap-space-md p-space-md">
              <div className="flex items-center justify-between rounded bg-surface-container p-space-sm">
                <div className="flex items-center gap-space-sm">
                  <Icono name="sunny" className="text-3xl text-primary" />
                  <div className="flex flex-col">
                    <span className="font-headline-md text-headline-md font-bold text-on-surface">
                      23°C
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Despejado · Humedad 44%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-label-sm text-label-sm font-semibold text-tertiary">
                    Apto hormigonado
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    Turno tarde seguro
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Control EPP matutino
                </span>
                {comando.controlesEPP.map((control, i) => (
                  <div
                    key={control.id}
                    className={`flex items-center justify-between py-1 ${
                      i < comando.controlesEPP.length - 1 ? "border-b border-surface-container" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icono
                        name={control.hora ? "verified" : "check_circle"}
                        className={`text-base ${control.hora ? "text-primary" : "text-tertiary"}`}
                      />
                      <span className="font-body-sm text-body-sm text-on-surface">
                        {control.concepto}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm font-bold text-tertiary">
                      {control.detalle || control.hora}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-space-sm flex flex-col gap-space-xs border-t border-surface-container pt-space-sm">
                <span className="font-label-sm text-label-sm text-secondary">
                  Reporte de transparencia
                </span>
                <Button variante="inverso" tamano="lg">
                  <Icono name="download" className="text-base" />
                  Descargar informe semanal (.pdf)
                </Button>
                <span className="text-center font-label-sm text-label-sm text-secondary">
                  Listo para compartir con fideicomiso y propietarios
                </span>
              </div>
            </div>
          </Card>

          {/* Detalle de obra */}
          <CardAcento tono="tertiary">
            <CardTitle
              titulo="Ficha de obra"
              extra={<Chip tono="primario">En ejecución</Chip>}
            />
            <Tabla className="mt-space-sm">
              <tbody className="divide-y divide-surface-container-low">
                {[
                  ["Constructora", obra.empConstructora],
                  ["Comitente", obra.comitente],
                  ["Superficie", `${formatNumero(obra.superficie)} m²`],
                  ["Moneda de contrato", "Guaraníes (PYG)"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <Td className="!px-0 !py-1.5 font-label-sm text-label-sm text-secondary">
                      {k}
                    </Td>
                    <Td align="right" className="!px-0 !py-1.5 font-body-sm text-body-sm font-semibold text-on-surface">
                      {v}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <p className="mt-space-sm font-label-sm text-label-sm text-secondary">
              Cotización de referencia: 1 US$ = {fmtGs(tipoCambio)} · monto total{" "}
              {fmt(presupuesto.total)}
            </p>
          </CardAcento>
        </div>
      </div>
    </div>
  );
}
