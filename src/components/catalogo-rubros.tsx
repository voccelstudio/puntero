"use client";

import { useMemo, useState } from "react";
import { useMoneda } from "@/components/moneda-provider";
import { Icono } from "@/components/icono";
import { Card, Chip, EmptyState, SectionHeader, Tabla, Td, Th } from "@/components/ui";
import { formatNumero, formatUnidad } from "@/lib/format";
import {
  CATEGORIAS,
  DB_FECHA,
  DB_VERSION,
  IVA_LAB,
  IVA_MAT,
  MAT_PRECIOS,
  RUBROS,
  RUBROS_POR_CATEGORIA,
  buscarRubros,
  costoMaterialesDeRubro,
  type Rubro,
} from "@/lib/data/precios";

/** Cuantos rubros se pintan por pagina. */
const POR_PAGINA = 25;

export function CatalogoRubros() {
  const { fmt, fmtUsd } = useMoneda();
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  const consulta = texto.trim();

  const filtrados = useMemo(() => {
    if (consulta) return buscarRubros(consulta, 400);
    if (categoria) {
      return RUBROS.filter((r) => r.categoria === categoria);
    }
    return RUBROS;
  }, [consulta, categoria]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(
    paginaActual * POR_PAGINA,
    paginaActual * POR_PAGINA + POR_PAGINA,
  );

  /** Al cambiar el filtro se vuelve a la primera pagina, si no se lands en una vacia. */
  function reiniciar() {
    setPagina(0);
    setExpandido(null);
  }

  function elegirCategoria(id: string | null) {
    reiniciar();
    setCategoria(id);
  }

  function buscar(textoNuevo: string) {
    reiniciar();
    setTexto(textoNuevo);
  }

  function alternar(id: string) {
    setExpandido((actual) => (actual === id ? null : id));
  }

  return (
    <Card className="overflow-hidden">
      <SectionHeader
        titulo="Catálogo de rubros"
        icono={<Icono name="search" tamano="sm" />}
        acciones={
          <>
            <Chip tono="neutro">{RUBROS.length} rubros</Chip>
            <Chip tono="neutro">{CATEGORIAS.length} categorías</Chip>
          </>
        }
      />

      <div className="space-y-space-md p-space-md">
        {/* Procedencia: de donde salen estos precios y cuando se pisaron */}
        <div className="flex flex-wrap items-center gap-space-xs text-label-sm text-secondary">
          <Chip tono="tertiary">Base {DB_VERSION}</Chip>
          <span>{DB_FECHA}</span>
          <span aria-hidden>·</span>
          <span>
            Materiales IVA {formatNumero(IVA_MAT * 100, 0)}% · Mano de obra IVA{" "}
            {formatNumero(IVA_LAB * 100, 0)}%
          </span>
        </div>

        <label className="relative block">
          <span className="sr-only">Buscar rubros</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar por nombre, material o código (ej: hormigon, ladrillo, E-01)"
            className="w-full rounded border border-outline bg-surface-container-lowest py-2 pl-space-md pr-space-md font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => elegirCategoria(null)}
            aria-pressed={categoria === null && !consulta}
            className={`rounded px-space-sm py-1 font-label-sm text-label-sm transition-colors ${
              categoria === null && !consulta
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Todas <span className="ml-1 opacity-70">{RUBROS.length}</span>
          </button>
          {CATEGORIAS.map((c) => {
            const activo = categoria === c && !consulta;
            return (
              <button
                key={c}
                type="button"
                onClick={() => elegirCategoria(c)}
                aria-pressed={activo}
                title={c}
                className={`rounded px-space-sm py-1 font-label-sm text-label-sm transition-colors ${
                  activo
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="max-w-40 truncate align-bottom">{c}</span>
                <span className="ml-1 opacity-70">{RUBROS_POR_CATEGORIA[c]}</span>
              </button>
            );
          })}
        </div>

        {consulta ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {filtrados.length} {filtrados.length === 1 ? "coincide" : "coincidencias"} para{" "}
            <span className="font-semibold text-on-surface">«{consulta}»</span>
            {categoria ? ` dentro de ${categoria}` : ""}
          </p>
        ) : null}

        {visibles.length === 0 ? (
          <EmptyState
            titulo="Ningún rubro coincide"
            detalle="Probá con menos palabras, o elegí una categoría de la lista."
          />
        ) : (
          <Tabla>
            <thead className="bg-surface-container-low text-secondary">
              <tr>
                <Th>Rubro</Th>
                <Th align="center">Unidad</Th>
                <Th align="right">Materiales</Th>
                <Th align="right">Mano de obra</Th>
                <Th align="right">Total (Gs)</Th>
                <Th align="right">Equiv. USD</Th>
                <Th align="center">Rend./día</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {visibles.map((r) => {
                const abierto = expandido === r.id;
                return (
                  <RubroFila
                    key={r.id}
                    rubro={r}
                    abierto={abierto}
                    fmt={fmt}
                    fmtUsd={fmtUsd}
                    onToggle={() => alternar(r.id)}
                  />
                );
              })}
            </tbody>
          </Tabla>
        )}

        {paginas > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <span className="font-label-sm text-label-sm text-secondary">
              Mostrando {paginaActual * POR_PAGINA + 1}–
              {Math.min((paginaActual + 1) * POR_PAGINA, filtrados.length)} de {filtrados.length}
            </span>
            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
                className="rounded border border-outline px-space-sm py-1 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="font-label-sm text-label-sm text-secondary">
                {paginaActual + 1} / {paginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                disabled={paginaActual >= paginas - 1}
                className="rounded border border-outline px-space-sm py-1 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function RubroFila({
  rubro,
  abierto,
  fmt,
  fmtUsd,
  onToggle,
}: {
  rubro: Rubro;
  abierto: boolean;
  fmt: (n: number) => string;
  fmtUsd: (n: number) => string;
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-surface-container-low/40"
        aria-expanded={abierto}
      >
        <Td>
          <div className="flex flex-wrap items-center gap-space-xs">
            <Icono
              name="expand_more"
              tamano="xs"
              className={`transition-transform ${abierto ? "rotate-180" : ""}`}
            />
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {rubro.nombre}
            </span>
            {rubro.materiales.length > 0 ? (
              <Chip tono="neutro">{rubro.materiales.length} mat.</Chip>
            ) : (
              <Chip tono="neutro">precio cerrado</Chip>
            )}
          </div>
          <span className="font-label-sm text-label-sm text-secondary">
            {rubro.id} · {rubro.categoria.replace(/_/g, " ").toLowerCase()}
          </span>
        </Td>
        <Td align="center" className="font-label-sm text-label-sm text-secondary">
          {formatUnidad(rubro.unidad)}
        </Td>
        <Td align="right" className="font-label-sm text-label-sm text-secondary">
          {fmt(rubro.costoMateriales)}
        </Td>
        <Td align="right" className="font-label-sm text-label-sm text-secondary">
          {fmt(rubro.costoManoObra)}
          <span className="ml-1 opacity-70">({formatNumero(rubro.porcentajeManoObra, 0)}%)</span>
        </Td>
        <Td align="right" className="font-label-md text-label-md font-semibold text-on-surface">
          {fmt(rubro.costoTotal)}
        </Td>
        <Td align="right" className="font-label-sm text-label-sm text-secondary">
          {fmtUsd(rubro.costoTotal)}
        </Td>
        <Td align="center" className="font-label-sm text-label-sm text-secondary">
          {rubro.rendimiento == null ? "—" : formatNumero(rubro.rendimiento, 2)}
        </Td>
      </tr>

      {abierto ? (
        <tr>
          <td colSpan={7} className="bg-surface-container-lowest p-space-md">
            <DetalleRubro rubro={rubro} fmt={fmt} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetalleRubro({ rubro, fmt }: { rubro: Rubro; fmt: (n: number) => string }) {
  const { total: totalReferencia, sinPrecio } = costoMaterialesDeRubro(rubro);
  const cierra = rubro.costoMateriales > 0 && Math.abs(totalReferencia - rubro.costoMateriales) / rubro.costoMateriales < 0.02;

  return (
    <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
      <div>
        <h4 className="font-headline-sm text-headline-sm text-on-surface">
          Materiales que consume
        </h4>
        <p className="mb-space-xs font-label-sm text-label-sm text-secondary">
          La lista dice qué se usa típicamente por unidad de rubro.{" "}
          {cierra ? (
            <>En este rubro cierra contra el costo de materiales.</>
          ) : (
            <>
              En general <span className="font-semibold">no cierra</span>: la base guarda un costo
              de materiales único y esta lista es referencia, así que el subtotal de abajo no se
              compara con el precio del rubro.
            </>
          )}
        </p>
        {rubro.materiales.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            Este rubro no declara materiales consumibles: es un precio cerrado.
          </p>
        ) : (
          <Tabla>
            <thead className="text-secondary">
              <tr>
                <Th>Material</Th>
                <Th align="right">Cant.</Th>
                <Th align="right">Precio unit.</Th>
                <Th align="right">Subtotal</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {rubro.materiales.map((m) => {
                const precio = MAT_PRECIOS[m.n];
                return (
                  <tr key={m.n}>
                    <Td className="font-body-sm text-body-sm text-on-surface">
                      {m.n}
                      {!precio ? (
                        <Chip tono="error" className="ml-space-xs">
                          sin precio
                        </Chip>
                      ) : null}
                    </Td>
                    <Td align="right" className="font-label-sm text-label-sm text-secondary">
                      {formatNumero(m.q, 2)} {formatUnidad(m.u)}
                    </Td>
                    <Td align="right" className="font-label-sm text-label-sm text-secondary">
                      {precio ? fmt(precio.p) : "—"}
                    </Td>
                    <Td align="right" className="font-label-sm text-label-sm text-on-surface">
                      {precio ? fmt(precio.p * m.q) : "—"}
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-surface-container-low">
                <Td className="font-label-md text-label-md font-semibold text-on-surface">
                  Subtotal de referencia
                </Td>
                <Td />
                <Td />
                <Td align="right" className="font-label-md text-label-md font-semibold text-on-surface">
                  {fmt(totalReferencia)}
                </Td>
              </tr>
            </tbody>
          </Tabla>
        )}
      </div>

      <div className="space-y-space-sm">
        <h4 className="font-headline-sm text-headline-sm text-on-surface">
          Composición del precio
        </h4>
        <dl className="space-y-space-xs">
          <Fila etiqueta="Costo de materiales (base)" valor={fmt(rubro.costoMateriales)} />
          <Fila
            etiqueta={
              rubro.manoObraDerivada
                ? "Mano de obra (derivada del % de categoría)"
                : "Mano de obra (cargada en la base)"
            }
            valor={`${fmt(rubro.costoManoObra)}  ·  ${formatNumero(rubro.porcentajeManoObra, 0)}%`}
          />
          <Fila etiqueta="Costo total por unidad" valor={fmt(rubro.costoTotal)} fuerte />
          <Fila
            etiqueta="IVA si este rubro se factura solo"
            valor={`mat. ${formatNumero(IVA_MAT * 100, 0)}% = ${fmt(rubro.costoMateriales * IVA_MAT)} · MO ${formatNumero(IVA_LAB * 100, 0)}% = ${fmt(rubro.costoManoObra * IVA_LAB)}`}
          />
        </dl>

        {rubro.manoObraDerivada ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Este rubro no trae mano de obra cargada: se derivó aplicando el{" "}
            <span className="font-semibold">{formatNumero(rubro.porcentajeManoObra, 0)}%</span> de
            la categoría. Para planning es un valor estimado, no un precio pactado.
          </p>
        ) : null}

        {rubro.rendimiento != null ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Rendimiento <span className="font-semibold">{formatNumero(rubro.rendimiento, 2)}</span>{" "}
            {formatUnidad(rubro.unidad)} por jornada, así que una unidad cuesta{" "}
            {formatNumero(1 / rubro.rendimiento, 2)} jornadas.
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-secondary">
            La base no trae rendimiento para este rubro, así que no se puede planningar a partir
            del precio.
          </p>
        )}

        {sinPrecio.length > 0 ? (
          <p className="font-body-sm text-body-sm text-error">
            Faltan {sinPrecio.length} {sinPrecio.length === 1 ? "material" : "materiales"} en la
            tabla de precios: {sinPrecio.join(", ")}. El subtotal de arriba no los incluye.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-space-sm border-b border-surface-container-low pb-space-xs">
      <dt className="font-body-sm text-body-sm text-on-surface-variant">{etiqueta}</dt>
      <dd
        className={
          fuerte
            ? "font-label-lg text-label-lg font-semibold text-on-surface"
            : "font-label-sm text-label-sm text-on-surface"
        }
      >
        {valor}
      </dd>
    </div>
  );
}
