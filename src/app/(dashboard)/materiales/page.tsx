"use client";

import { useMemo, useState } from "react";
import { useMoneda } from "@/components/moneda-provider";
import { Icono } from "@/components/icono";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Progress,
  SectionHeader,
  Td,
  Th,
  Tabla,
} from "@/components/ui";
import { useObra } from "@/components/obra-provider";
import { useColeccion } from "@/lib/datos/almacen";
import { CatalogoRubros } from "@/components/catalogo-rubros";
import { formatFecha, formatNumero, formatPct, formatPctSigno, formatUnidad } from "@/lib/format";
import type { CategoriaMaterial, EstadoPedido } from "@/lib/types";

const CATEGORIAS: { id: CategoriaMaterial | "TODAS"; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "ESTRUCTURAL", label: "Estructural" },
  { id: "METALICOS", label: "Metálicos" },
  { id: "MAMPOSTERIA", label: "Mampostería" },
  { id: "INSTALACIONES", label: "Instalaciones" },
  { id: "TERMINACIONES", label: "Terminaciones" },
];

const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; tono: "primario" | "exito" | "tertiary" | "neutro" }> = {
  EN_CAMINO: { label: "En camino", tono: "primario" },
  ENTREGADO_VERIFICADO: { label: "Entregado y verificado", tono: "exito" },
  CONFIRMADO: { label: "Confirmado por proveedor", tono: "tertiary" },
  RECEPCIONADO: { label: "Recepcionado", tono: "neutro" },
};

const DOC_CATEGORIA: Record<string, { label: string; tono: "primario" | "tertiary" | "exito" | "secondary" | "neutro" }> = {
  CONTRATO: { label: "Contrato", tono: "primario" },
  PLIEGO: { label: "Pliego", tono: "tertiary" },
  SEGUROS: { label: "Seguro", tono: "exito" },
  NORMATIVA: { label: "Normativa", tono: "secondary" },
  LICITACION: { label: "Licitación", tono: "neutro" },
};

export default function MaterialesPedidos() {
  const { fmt, fmtUsd, tipoCambio } = useMoneda();
  const { obra, semilla } = useObra();
  const [categoria, setCategoria] = useState<CategoriaMaterial | "TODAS">("TODAS");

  const { datos: datosMateriales } = useColeccion(
    obra.id,
    "materiales",
    semilla.materiales,
  );

  const { pedidos: PEDIDOS, preciosReferencia: PRECIOS_REFERENCIA, documentos: DOCUMENTOS } =
    datosMateriales;

  const precios = useMemo(
    () =>
      categoria === "TODAS"
        ? PRECIOS_REFERENCIA
        : PRECIOS_REFERENCIA.filter((p) => p.categoria === categoria),
    [categoria, PRECIOS_REFERENCIA],
  );

  const enCamino = PEDIDOS.filter((p) => p.estado === "EN_CAMINO").length;
  const entregados = PEDIDOS.filter((p) => p.estado === "ENTREGADO_VERIFICADO").length;
  const stockCritico = PRECIOS_REFERENCIA.filter((p) => p.stockObra < p.stockMinimo);
  const docsVigentes = DOCUMENTOS.filter((d) => d.vigente).length;
  const valorInventario = PRECIOS_REFERENCIA.reduce((a, p) => a + p.stockObra * p.precioGs, 0);

  return (
    <div className="space-y-space-lg">
      {/* Contexto */}
      <div className="flex flex-wrap items-center justify-between gap-space-md rounded bg-surface-container-low p-space-lg shadow-sm">
        <div className="space-y-space-xs">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
            Abastecimiento · Logística · Biblioteca técnica
          </span>
          <h1 className="font-headline-xl text-headline-xl text-on-surface">
            Gestión de materiales, acopios y pedidos
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Control de compras en curso, tabla de precios de referencia con variaciones de mercado y
            expediente documental de la obra.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          <Button variante="secundario">
            <Icono name="table_view" tamano="sm" />Exportar
          </Button>
          <Button>
            <Icono name="add_circle" tamano="sm" />Nueva orden de compra
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
            Pedidos activos
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">
              {PEDIDOS.length}
            </span>
            <span className="font-label-sm text-label-sm text-secondary">en curso</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {enCamino} en camino · {entregados} entregados
          </p>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-tertiary" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
            Stock bajo mínimo
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className={`font-headline-xl text-headline-xl font-bold ${
                stockCritico.length > 0 ? "text-error" : "text-tertiary"
              }`}
            >
              {stockCritico.length}
            </span>
            <span className="font-label-sm text-label-sm text-secondary">rubros</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {stockCritico.length > 0 ? "Requieren reposición inmediata" : "Todo el stock por encima del mínimo"}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-secondary" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
            Valor de inventario
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
              {fmt(valorInventario)}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Equivale a {fmtUsd(valorInventario)} al cambio de hoy
          </p>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary-container" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
            Expediente documental
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">
              {docsVigentes}
            </span>
            <span className="font-label-sm text-label-sm text-secondary">vigentes</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {DOCUMENTOS.length} documentos en el expediente
          </p>
        </div>
      </section>

      {/* Aviso de stock crítico */}
      {stockCritico.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-space-sm rounded bg-error-container/40 p-space-md">
          <div className="flex items-center gap-space-sm">
            <Icono name="warning" className="text-xl text-error" />
            <div>
              <span className="block font-headline-sm text-headline-sm text-on-error-container">
                {stockCritico.length} rubro{stockCritico.length > 1 ? "s" : ""} por debajo del
                stock mínimo
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {stockCritico.map((p) => `${p.descripcion} (${formatNumero(p.stockObra)}/${formatNumero(p.stockMinimo)} ${formatUnidad(p.unidad)})`).join(" · ")}
              </span>
            </div>
          </div>
          <Button variante="secundario">Generar OC de reposición</Button>
        </div>
      ) : null}

      {/* Sección 1: control de pedidos */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Control de pedidos y entregas en obra"
          icono={<Icono name="local_shipping" className="text-primary text-xl" />}
          acciones={
            <>
              <Chip tono="primario">{PEDIDOS.length} órdenes de compra</Chip>
              <Button variante="secundario" tamano="sm">
                <Icono name="tune" tamano="sm" />Filtros
              </Button>
            </>
          }
        />
        <Tabla>
          <thead className="bg-surface-container-low text-secondary">
            <tr>
              <Th>Orden / material</Th>
              <Th>Proveedor</Th>
              <Th align="right">Cantidad</Th>
              <Th>Entrega</Th>
              <Th className="min-w-40">Avance logística</Th>
              <Th align="center">Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {PEDIDOS.map((p) => {
              const estado = ESTADO_PEDIDO[p.estado];
              return (
                <tr key={p.id} className="transition-colors hover:bg-surface-container-low/40">
                  <Td>
                    <div className="flex items-start gap-space-sm">
                      <div className="rounded bg-surface-container p-space-xs text-primary">
                        <Icono name={p.icono} className="text-base" />
                      </div>
                      <div>
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          {p.material}
                        </span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {p.especificacion}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-space-xs">
                          <span className="rounded bg-surface-container px-1 font-label-sm text-label-sm text-secondary">
                            {p.codigoOC}
                          </span>
                          <span className="font-label-sm text-label-sm text-secondary">
                            Destino: {p.destino}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-body-sm text-body-sm text-on-surface">{p.proveedor}</span>
                    <span className="block font-label-sm text-label-sm text-secondary">
                      Recepción: {p.responsableRecepcion}
                    </span>
                  </Td>
                  <Td align="right" className="font-label-md text-label-md text-on-surface">
                    {formatNumero(p.cantidad)} {formatUnidad(p.unidad)}
                  </Td>
                  <Td>
                    <span className="font-label-sm text-label-sm text-secondary">
                      Pedido {formatFecha(p.fechaPedido)}
                    </span>
                    <span className="block font-label-md text-label-md text-on-surface">
                      {p.fechaEntregaReal
                        ? `Recibido ${formatFecha(p.fechaEntregaReal)}`
                        : `Prevista ${formatFecha(p.fechaEntregaPrevista)}`}
                    </span>
                  </Td>
                  <Td>
                    <Progress
                      valor={p.avance}
                      tono={p.avance >= 1 ? "primary" : "tertiary"}
                      className="mb-1"
                    />
                    <span className="font-label-sm text-label-sm text-secondary">
                      {formatPct(p.avance, 0)}
                    </span>
                  </Td>
                  <Td align="center">
                    <Chip tono={estado.tono}>{estado.label}</Chip>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      </Card>

      {/* Sección 2: catálogo real de rubros, conectado a la base de precios */}
      <CatalogoRubros />

      {/* Sección 3: precios de referencia con control de stock de la obra */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Precios de referencia y stock en obra"
          icono={<Icono name="request_quote" className="text-primary text-xl" />}
          acciones={
            <span className="font-label-sm text-label-sm text-secondary">
              Precios en Gs · 1 US$ = {fmt(tipoCambio)}
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-space-xs border-b border-surface-container-low px-space-md py-space-sm">
          {CATEGORIAS.map((c) => {
            const activo = categoria === c.id;
            const count =
              c.id === "TODAS"
                ? PRECIOS_REFERENCIA.length
                : PRECIOS_REFERENCIA.filter((p) => p.categoria === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                aria-pressed={activo}
                className={`rounded px-space-sm py-1 font-label-sm text-label-sm transition-colors ${
                  activo
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {c.label}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {precios.length === 0 ? (
          <EmptyState
            titulo="Sin rubros en esta categoría"
            detalle="Agregá rubros al catálogo o elegí otra categoría."
          />
        ) : (
          <Tabla>
            <thead className="bg-surface-container-low text-secondary">
              <tr>
                <Th>Código / descripción</Th>
                <Th align="center">Unidad</Th>
                <Th align="right">Precio (Gs)</Th>
                <Th align="right">Equiv. USD</Th>
                <Th align="right">Variación</Th>
                <Th align="right">Stock obra</Th>
                <Th>Proveedor</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {precios.map((p) => {
                const bajoMinimo = p.stockObra < p.stockMinimo;
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      bajoMinimo ? "bg-error-container/20 hover:bg-error-container/30" : "hover:bg-surface-container-low/40"
                    }`}
                  >
                    <Td>
                      <div className="flex flex-wrap items-center gap-space-xs">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          {p.descripcion}
                        </span>
                        {bajoMinimo ? <Chip tono="error">Stock bajo</Chip> : null}
                        {Math.abs(p.variacionPct) >= 0.05 ? (
                          <Chip tono="primario">Revisión de precio</Chip>
                        ) : null}
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary">
                        {p.codigo} · act. {formatFecha(p.ultimaActualizacion)}
                      </span>
                    </Td>
                    <Td align="center" className="font-label-sm text-label-sm text-secondary">
                      {formatUnidad(p.unidad)}
                    </Td>
                    <Td align="right" className="font-label-md text-label-md font-semibold text-on-surface">
                      {fmt(p.precioGs)}
                    </Td>
                    <Td align="right" className="font-label-sm text-label-sm text-secondary">
                      {fmtUsd(p.precioGs)}
                    </Td>
                    <Td align="right">
                      <span
                        className={`font-label-md text-label-md font-semibold ${
                          p.variacionPct > 0
                            ? "text-error"
                            : p.variacionPct < 0
                              ? "text-tertiary"
                              : "text-secondary"
                        }`}
                      >
                        {formatPctSigno(p.variacionPct)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={`font-label-md text-label-md font-semibold ${
                          bajoMinimo ? "text-error" : "text-on-surface"
                        }`}
                      >
                        {formatNumero(p.stockObra)}
                      </span>
                      <span className="block font-label-sm text-label-sm text-secondary">
                        mín. {formatNumero(p.stockMinimo)}
                      </span>
                    </Td>
                    <Td className="font-body-sm text-body-sm text-on-surface-variant">
                      {p.proveedor}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-outline bg-surface-container-low font-semibold">
                <Td className="font-headline-sm text-headline-sm" colSpan={5}>
                  {precios.length} rubros · variaciones promedio{" "}
                  {formatPctSigno(
                    precios.reduce((a, p) => a + p.variacionPct, 0) / Math.max(1, precios.length),
                  )}
                </Td>
                <Td align="right" className="font-label-md text-label-md text-on-surface">
                  {formatNumero(precios.reduce((a, p) => a + p.stockObra, 0))}
                </Td>
                <Td />
              </tr>
            </tfoot>
          </Tabla>
        )}
      </Card>

      {/* Sección 3: biblioteca técnica */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Biblioteca de recursos y contratos legales de obra"
          icono={<Icono name="gavel" className="text-primary text-xl" />}
          acciones={<Chip tono="exito">{docsVigentes} vigentes</Chip>}
        />
        <div className="grid grid-cols-1 gap-space-md p-space-md md:grid-cols-2 xl:grid-cols-3">
          {DOCUMENTOS.map((doc) => {
            const cat = DOC_CATEGORIA[doc.categoria];
            return (
              <article
                key={doc.id}
                className="flex flex-col gap-space-sm rounded bg-surface-container-low p-space-md transition-colors hover:bg-surface-container"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="rounded bg-surface-container-lowest p-space-sm text-primary">
                    <Icono name={doc.icono} className="text-xl" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Chip tono={cat.tono}>{cat.label}</Chip>
                    {!doc.vigente ? <Chip tono="error">Vencido</Chip> : null}
                  </div>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    {doc.nombre}
                  </h3>
                  <p className="font-label-sm text-label-sm text-secondary">
                    {doc.numero} · {formatFecha(doc.fecha)}
                  </p>
                </div>
                <p className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
                  {doc.descripcion}
                </p>
                <Button variante="contorno" className="w-full justify-center">
                  <Icono name="picture_as_pdf" tamano="sm" />
                  Ver documento
                </Button>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
