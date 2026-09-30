"use client";

import { useMemo, useState } from "react";
import { useMoneda } from "@/components/moneda-provider";
import { Icono } from "@/components/icono";
import {
  Button,
  Card,
  CardAcento,
  CardTitle,
  Chip,
  EmptyState,
  Gauge,
  Progress,
  Td,
  Th,
  Tabla,
} from "@/components/ui";
import { useObra } from "@/components/obra-provider";
import { useColeccion } from "@/lib/datos/almacen";
import {
  calcularPresupuesto, totalFase, totalItem,
} from "@/lib/calculo";
import { formatFecha, formatNumero, formatPct, formatUnidad } from "@/lib/format";
import type { DatosPresupuesto, ItemPresupuesto, Obra, ParametrosFinancieros } from "@/lib/types";
import type { ResumenPresupuesto } from "@/lib/calculo";

const FILA_ADENDA = "bg-primary/5 hover:bg-primary/10";

function EstadoItem({ estado }: { estado: ItemPresupuesto["estado"] }) {
  const mapa = {
    PENDIENTE: { tono: "neutro" as const, texto: "Pendiente" },
    EN_EJECUCION: { tono: "tertiary" as const, texto: "En ejecución" },
    EJECUTADO: { tono: "exito" as const, texto: "Ejecutado" },
    APROBADO: { tono: "primario" as const, texto: "Aprobado" },
  };
  const { tono, texto } = mapa[estado];
  return <Chip tono={tono}>{texto}</Chip>;
}

function LineaItem({
  item,
  fmt,
  ocultarInternos,
}: {
  item: ItemPresupuesto;
  fmt: (n: number) => string;
  ocultarInternos: boolean;
}) {
  const esAdenda = Boolean(item.adenda);
  const unitario = item.precioMaterial + item.precioManoObra;
  const avance = item.cantidad > 0 ? item.cantidadEjecutada / item.cantidad : 0;

  return (
    <tr className={esAdenda ? FILA_ADENDA : "hover:bg-surface-container-low/40 transition-colors"}>
      <Td>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span
              className={`font-headline-sm text-headline-sm leading-tight ${
                esAdenda ? "font-bold text-primary" : "text-on-surface"
              }`}
            >
              {item.descripcion}
            </span>
            {item.estado === "EN_EJECUCION" ? <EstadoItem estado={item.estado} /> : null}
            {esAdenda ? <Chip tono="primario">Variación aprobada</Chip> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-space-xs">
            <span className="rounded bg-surface-container px-1 font-label-sm text-label-sm text-secondary">
              {item.codigo}
            </span>
            {item.nota ? (
              <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {item.nota}
              </span>
            ) : null}
          </div>
          {esAdenda ? (
            <Progress valor={avance} alto="sm" className="mt-1.5 max-w-48" />
          ) : null}
        </div>
      </Td>
      <Td align="center" className="font-label-sm text-label-sm text-secondary">
        {formatUnidad(item.unidad)}
      </Td>
      <Td align="right">
        <span className="font-label-md text-label-md text-on-surface">
          {formatNumero(item.cantidad)}
        </span>
        {avance > 0 && !esAdenda ? (
          <span className="block font-label-sm text-label-sm text-tertiary">
            {formatNumero(item.cantidadEjecutada)} ejec.
          </span>
        ) : null}
      </Td>
      {!ocultarInternos ? (
        <Td align="right" className="font-label-md text-label-md text-secondary">
          {fmt(item.precioMaterial)}
        </Td>
      ) : null}
      {!ocultarInternos ? (
        <Td align="right" className="font-label-md text-label-md text-on-surface">
          {fmt(item.precioManoObra)}
        </Td>
      ) : null}
      <Td align="right" className="font-label-md text-label-md text-on-surface">
        {fmt(unitario)}
      </Td>
      <Td
        align="right"
        className={`font-label-md text-label-md ${
          esAdenda ? "font-bold text-primary" : "font-semibold text-on-surface"
        }`}
      >
        {fmt(totalItem(item))}
      </Td>
      <Td align="right">
        {esAdenda ? (
          <Icono name="verified" className="text-sm text-primary" />
        ) : (
          <button
            type="button"
            className="text-secondary transition-colors hover:text-primary"
            aria-label={`Opciones de ${item.descripcion}`}
          >
            <Icono name="more_vert" tamano="sm" />
          </button>
        )}
      </Td>
    </tr>
  );
}

function FilaTotales({
  resumen,
  params,
  fmt,
}: {
  resumen: ResumenPresupuesto;
  params: ParametrosFinancieros;
  fmt: (n: number) => string;
}) {
  return (
    <div className="space-y-space-sm">
      <div className="flex items-center justify-between py-1">
        <span className="font-body-md text-body-md text-on-surface-variant">Subtotal costo directo</span>
        <span className="font-label-md text-label-md font-semibold text-on-surface">
          {fmt(resumen.costoDirecto)}
        </span>
      </div>
      <div className="flex items-center justify-between rounded bg-surface-container-low px-space-sm py-1">
        <div className="flex items-center gap-1">
          <span className="font-body-sm text-body-sm text-on-surface">Gastos generales / imprevistos</span>
          <span className="font-label-sm text-label-sm text-secondary">
            ({formatPct(params.gastosGenerales, 0)})
          </span>
        </div>
        <span className="font-label-md text-label-md text-on-surface">
          {fmt(resumen.gastosGenerales)}
        </span>
      </div>
      <div className="flex items-center justify-between rounded bg-surface-container-low px-space-sm py-1">
        <div className="flex items-center gap-1">
          <span className="font-body-sm text-body-sm text-on-surface">
            Beneficio / margen del constructor
          </span>
          <span className="font-label-sm text-label-sm font-semibold text-primary">
            ({formatPct(params.beneficio, 0)})
          </span>
        </div>
        <span className="font-label-md text-label-md font-semibold text-primary">
          {fmt(resumen.beneficio)}
        </span>
      </div>
      <div className="flex items-center justify-between pt-space-xs">
        <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          Subtotal neto
        </span>
        <span className="font-label-lg text-label-lg font-bold text-on-surface">
          {fmt(resumen.subtotalNeto)}
        </span>
      </div>
        <div className="flex items-center justify-between py-1 text-secondary">
          <div className="flex flex-col gap-0.5">
            <span className="font-body-sm text-body-sm">IVA discriminado</span>
            <span className="font-label-sm text-label-sm text-secondary">
              materiales {formatPct(params.ivaMateriales, 1)} · mano de obra{" "}
              {formatPct(params.ivaManoObra, 1)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-label-md text-label-md">{fmt(resumen.iva)}</span>
            <span className="font-label-sm text-label-sm text-secondary">
              mat. {fmt(resumen.ivaMateriales)} · MO {fmt(resumen.ivaManoObra)}
            </span>
          </div>
        </div>
    </div>
  );
}

export default function ConstructorPresupuestos() {
  const { obra, semilla } = useObra();
  const { datos } = useColeccion(obra.id, "presupuesto", semilla.presupuesto);

  // El `key` remonta la tabla al cambiar de obra: así las fases abiertas y la
  // adenda seleccionada arrancan bien solas para la obra nueva, sin un efecto
  // que tenga que corregir el estado después de pintar.
  return <TablaPresupuesto key={obra.id} obra={obra} datos={datos} />;
}

function TablaPresupuesto({ obra, datos }: { obra: Obra; datos: DatosPresupuesto }) {
  const { fmt, fmtGs, fmtUsd, tipoCambio } = useMoneda();

  const FASES_PRESUPUESTO = datos.fases;
  const ADENDAS = datos.adendas;
  const PARAMETROS_FINANCIEROS = datos.parametros;
  const TODOS = FASES_PRESUPUESTO.flatMap((f) => f.items);

  const [fasesAbiertas, setFasesAbiertas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(datos.fases.map((f) => [f.id, f.items.length > 0 && f.numero === 2])),
  );
  const [vistaCliente, setVistaCliente] = useState(false);
  const [adendaActiva, setAdendaActiva] = useState<string | null>(
    datos.adendas[0]?.codigo ?? null,
  );

  const resumen = useMemo(
    () => calcularPresupuesto(TODOS, PARAMETROS_FINANCIEROS),
    [TODOS, PARAMETROS_FINANCIEROS],
  );

  const totalItems = useMemo(() => TODOS.length, [TODOS]);
  const avanceCertificado = useMemo(() => {
    const presup = TODOS.reduce((a, i) => a + totalItem(i), 0);
    const ejec = TODOS.reduce((a, i) => a + i.cantidadEjecutada * (i.precioMaterial + i.precioManoObra), 0);
    return presup > 0 ? Math.min(1, ejec / presup) : 0;
  }, [TODOS]);

  const alternarFase = (id: string) =>
    setFasesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-space-lg p-gutter-desktop">
      {/* Franja superior de contexto y acciones */}
      <Card className="flex flex-col items-start justify-between gap-space-md p-space-lg xl:flex-row xl:items-center">
        <div className="space-y-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              {obra.empConstructora}
            </span>
            <span className="text-secondary">•</span>
            <span className="rounded bg-tertiary-container/30 px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-tertiary">
              Rev. 3 (aprobado + adenda 1)
            </span>
            <span className="flex items-center gap-1 rounded bg-primary/10 px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Versión 3.2 — vigente
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-space-md">
            <h1 className="font-headline-xl text-headline-xl text-on-surface">
              Presupuesto de obra: {obra.nombre.split("—")[1]?.trim() ?? obra.nombre}
            </h1>
            <Button variante="secundario" tamano="sm">
              <Icono name="history_edu" tamano="sm" />
              Ver adendas / variaciones (+{ADENDAS.length})
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-sm rounded bg-surface-container-low p-space-sm">
          <div className="rounded bg-surface-container-lowest px-space-sm py-1 shadow-sm">
            <span className="block font-label-sm text-label-sm text-secondary">Costo directo</span>
            <span className="font-label-md text-label-md font-bold text-on-surface">
              {fmt(resumen.costoDirecto)}
            </span>
          </div>
          <div className="rounded bg-surface-container-lowest px-space-sm py-1 shadow-sm">
            <span className="block font-label-sm text-label-sm text-secondary">Mano de obra</span>
            <span className="font-label-md text-label-md font-semibold text-primary">
              {formatPct(resumen.pctManoObra, 0)}
            </span>
          </div>
          <div className="rounded bg-surface-container-lowest px-space-sm py-1 shadow-sm">
            <span className="block font-label-sm text-label-sm text-secondary">Materiales</span>
            <span className="font-label-md text-label-md font-semibold text-secondary">
              {formatPct(resumen.pctMateriales, 0)}
            </span>
          </div>
          <div className="rounded bg-inverse-surface px-space-sm py-1 shadow-sm">
            <span className="block font-label-sm text-label-sm text-surface-dim">Total c/ IVA</span>
            <span className="font-label-md text-label-md font-bold text-tertiary-fixed">
              {fmt(resumen.total)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <Button variante="secundario">
            <Icono name="table_view" tamano="sm" />Excel / CSV
          </Button>
          <Button variante="secundario">
            <Icono name="picture_as_pdf" tamano="sm" />PDF cliente
          </Button>
          <Button variante="secundario">
            <Icono name="bookmark_add" tamano="sm" />Guardar adenda
          </Button>
          <Button>
            <Icono name="add_circle" tamano="sm" />+ Nuevo ítem / rubro
          </Button>
        </div>
      </Card>

      {/* Espacio de trabajo */}
      <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
        {/* Cómputo métrico */}
        <div className="space-y-space-md xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="flex items-center gap-space-xs">
              <Icono name="tune" className="text-base text-primary" />
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Cómputo métrico dinámico
              </span>
              <span className="rounded bg-surface-container px-space-xs py-0.5 font-label-sm text-label-sm text-secondary">
                {FASES_PRESUPUESTO.length} fases / {totalItems} ítems
              </span>
            </div>
            <div className="flex items-center gap-space-md">
              <label className="flex cursor-pointer items-center gap-space-xs select-none">
                <input
                  type="checkbox"
                  checked={vistaCliente}
                  onChange={(e) => setVistaCliente(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-0"
                />
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Modo vista cliente
                </span>
              </label>
              <div className="flex items-center gap-1 rounded bg-tertiary-container/20 px-2 py-0.5 font-label-sm text-label-sm text-tertiary">
                <Icono name="sync" tamano="sm" />
                En vivo
              </div>
            </div>
          </div>

          {FASES_PRESUPUESTO.map((fase) => {
            const abierta = fasesAbiertas[fase.id];
            const subtotal = totalFase(fase.items);
            const esActiva = fase.numero === 2;

            return (
              <Card key={fase.id} className={`overflow-hidden ${esActiva ? "shadow-md" : ""}`}>
                <button
                  type="button"
                  onClick={() => alternarFase(fase.id)}
                  aria-expanded={abierta}
                  className={`flex w-full items-center justify-between gap-space-sm px-space-md py-space-sm text-left transition-colors ${
                    esActiva
                      ? "bg-inverse-surface text-inverse-on-surface"
                      : "bg-surface-container-high hover:bg-surface-container-highest"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-space-sm">
                    <Icono
                      name="expand_more"
                      className={`text-base transition-transform ${esActiva ? "text-tertiary-fixed" : "rotate-180 text-secondary"}`}
                    />
                    <span
                      className={`font-headline-sm text-headline-sm ${
                        esActiva ? "text-inverse-on-surface" : "text-on-surface"
                      }`}
                    >
                      Fase {String(fase.numero).padStart(2, "0")}: {fase.nombre}
                    </span>
                    <span
                      className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm ${
                        esActiva
                          ? "bg-surface-container/20 text-inverse-on-surface"
                          : "bg-surface-container-lowest text-secondary shadow-sm"
                      }`}
                    >
                      {fase.items.length} ítems
                    </span>
                  </div>
                  <div className="flex items-center gap-space-md">
                    <span
                      className={`font-label-sm text-label-sm ${esActiva ? "text-surface-dim" : "text-secondary"}`}
                    >
                      Subtotal rubro:
                    </span>
                    <span
                      className={`font-label-md text-label-md font-bold ${
                        esActiva ? "text-tertiary-fixed" : "text-on-surface"
                      }`}
                    >
                      {fmt(subtotal)}
                    </span>
                  </div>
                </button>

                {abierta ? (
                  fase.items.length > 0 ? (
                    <Tabla>
                      <thead className="bg-surface-container-low text-secondary">
                        <tr>
                          <Th>Ítem / descripción</Th>
                          <Th align="center">Unidad</Th>
                          <Th align="right">Cant.</Th>
                          {!vistaCliente ? <Th align="right">Material</Th> : null}
                          {!vistaCliente ? <Th align="right">Mano obra</Th> : null}
                          <Th align="right">Unitario</Th>
                          <Th align="right">Total</Th>
                          <Th />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        {fase.items.map((item) => (
                          <LineaItem
                            key={item.id}
                            item={item}
                            fmt={fmt}
                            ocultarInternos={vistaCliente}
                          />
                        ))}
                      </tbody>
                    </Tabla>
                  ) : (
                    <div className="p-space-md">
                      <EmptyState
                        titulo="Partidas pendientes de cargar"
                        detalle={`Haga clic en la cabecera para desplegar las partidas de ${fase.nombre.toLowerCase()}.`}
                      />
                    </div>
                  )
                ) : null}
              </Card>
            );
          })}

          {/* Avance y foto de obra */}
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            <Card className="flex items-center gap-space-md p-space-md">
              <Gauge valor={avanceCertificado} tamano="lg">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {formatPct(avanceCertificado, 0)}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">Certif.</span>
              </Gauge>
              <div className="space-y-1">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Avance de cómputo
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  La fase 02 presenta un desvío volumétrico positivo de +2,4% debido a zapatas
                  ensanchadas en cota −3,20 m.
                </p>
              </div>
            </Card>

            <CardAcento tono="tertiary">
              <CardTitle titulo="Habilitación de colado" extra={<Chip tono="exito">Fase 2</Chip>} />
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Sector B-3 · se habilita el vertido de hormigón H-21 en losa de piso 4.
              </p>
              <p className="mt-2 font-label-sm text-label-sm text-secondary">
                Última verificación: {formatFecha("2024-10-16")}
              </p>
            </CardAcento>
          </div>
        </div>

        {/* Motor financiero */}
        <aside className="space-y-space-md xl:col-span-4 xl:sticky xl:top-20">
          <Card className="space-y-space-md p-space-lg shadow-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <Icono name="functions" className="text-base text-primary" />
                <span className="font-headline-md text-headline-md text-on-surface">
                  Motor financiero
                </span>
              </div>
              <span className="rounded bg-primary/10 px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-primary">
                Cálculo dinámico
              </span>
            </div>

            <FilaTotales resumen={resumen} params={PARAMETROS_FINANCIEROS} fmt={fmt} />

            <div className="space-y-1 rounded-xl bg-inverse-surface p-space-md text-inverse-on-surface shadow-md">
              <span className="block font-label-sm text-label-sm uppercase tracking-wider text-surface-dim">
                Total presupuestado al cliente
              </span>
              <div className="font-headline-xl text-headline-xl font-bold leading-none text-tertiary-fixed">
                {fmt(resumen.total)}
              </div>
              <div className="flex items-center justify-between pt-2 font-label-sm text-label-sm text-surface-dim">
                <span title={fmtUsd(resumen.total)}>
                  Equiv. USD: {fmtUsd(resumen.total)}
                </span>
                <span className="text-tertiary-fixed">TC: {fmtGs(tipoCambio)}/USD</span>
              </div>
            </div>

            <div className="space-y-space-xs pt-space-xs">
              <Button tamano="lg">
                <Icono name="send" />Emitir certificado de obra
              </Button>
              <Button variante="secundario" tamano="lg">
                <Icono name="tune" tamano="sm" />
                Ajustar coeficientes K de sobrecosto
              </Button>
            </div>

            <div className="flex items-start gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
              <Icono name="verified" className="text-base text-tertiary" />
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                Precios de referencia sincronizados con la Cámara Paraguaya de la Construcción.
                Última actualización: ayer.
              </div>
            </div>
          </Card>

          {/* Adendas */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-container p-space-md">
              <CardTitle
                titulo="Adendas y variaciones"
                icono={<Icono name="bookmark_add" className="text-primary" />}
                extra={<Chip tono="neutro">{ADENDAS.length}</Chip>}
              />
            </div>
            <ul className="divide-y divide-surface-container-low">
              {ADENDAS.map((adenda) => (
                <li key={adenda.codigo}>
                  <button
                    type="button"
                    onClick={() =>
                      setAdendaActiva(adendaActiva === adenda.codigo ? null : adenda.codigo)
                    }
                    aria-expanded={adendaActiva === adenda.codigo}
                    className="flex w-full items-start justify-between gap-space-sm p-space-md text-left transition-colors hover:bg-surface-container-low"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-sm text-label-sm font-bold text-primary">
                          {adenda.codigo}
                        </span>
                        <Chip tono={adenda.estado === "APROBADA" ? "exito" : "neutro"}>
                          {adenda.estado === "APROBADA" ? "Aprobada" : "Borrador"}
                        </Chip>
                      </div>
                      <p className="mt-0.5 font-headline-sm text-headline-sm text-on-surface">
                        {adenda.titulo}
                      </p>
                      <p className="font-label-sm text-label-sm text-secondary">
                        {formatFecha(adenda.fecha)} · {adenda.autorizadaPor}
                      </p>
                    </div>
                    <span className="shrink-0 font-label-md text-label-md font-semibold text-on-surface">
                      {adenda.monto > 0 ? fmt(adenda.monto) : "—"}
                    </span>
                  </button>
                  {adendaActiva === adenda.codigo ? (
                    <div className="border-t border-surface-container-low bg-surface-container-low/50 px-space-md py-space-sm">
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {adenda.descripcion}
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          {/* Bitácora de dirección */}
          <Card className="flex items-start gap-space-sm p-space-md">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-tertiary-container text-on-tertiary-container">
              <Icono name="menu_book" className="text-2xl" />
            </div>
            <div className="space-y-0.5">
              <span className="font-label-sm text-label-sm font-semibold uppercase text-primary">
                Bitácora de dirección
              </span>
              <p className="font-body-sm text-body-sm leading-tight text-on-surface">
                La adenda de sala de máquinas fue incorporada según orden de servicio N° 14
                autorizada por la comitente.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
