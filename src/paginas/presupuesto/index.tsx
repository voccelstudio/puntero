import { useMemo, useState } from "react";
import { useObra } from "@/contexto/obra";
import { useMoneda } from "@/contexto/moneda";
import { useColeccion } from "@/dominio/almacen";
import {
  calcularAvanceFisico,
  calcularPresupuesto,
  totalFase,
  totalItem,
  todosLosItems,
} from "@/dominio/calculo";
import { formatPct, formatUnidad } from "@/dominio/formato";
import { semillaPresupuesto } from "@/dominio/semillas/presupuesto";
import type { FasePresupuesto, ItemPresupuesto, ParametrosFinancieros } from "@/dominio/tipos";
import { Boton, Card, Chip, Icono, Kpi, Modal, Progress, Tabla, Td, Th } from "@/ui/base";
import { AdendasModal } from "@/paginas/presupuesto/adendas";
import { CatalogoRubros } from "@/paginas/presupuesto/catalogo";
import { Computo } from "@/paginas/presupuesto/computo";
import { FichaItem, type FichaItemValor } from "@/paginas/presupuesto/ficha-item";
import {
  addFase,
  addItem,
  addVersion,
  patchFase,
  patchItem,
  patchParametros,
  removeFase,
  removeItem,
} from "@/paginas/presupuesto/operaciones";
import { Versiones } from "@/paginas/presupuesto/versiones";

const ETIQUETA_ESTADO: Record<ItemPresupuesto["estado"], { texto: string; tono: "neutro" | "primario" | "tertiary" | "exito" }> = {
  PENDIENTE: { texto: "Pendiente", tono: "neutro" },
  EN_EJECUCION: { texto: "En ejecución", tono: "tertiary" },
  EJECUTADO: { texto: "Ejecutado", tono: "primario" },
  APROBADO: { texto: "Aprobado", tono: "exito" },
};

export function PaginaPresupuesto() {
  const { obra } = useObra();
  const { fmt } = useMoneda();
  const { datos, guardar } = useColeccion(
    obra.id,
    "presupuesto",
    semillaPresupuesto(obra.id),
  );

  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [mostrarFicha, setMostrarFicha] = useState<FichaItemValor | null>(null);
  const [fichaNuevo, setFichaNuevo] = useState(false);
  const [mostrarComputo, setMostrarComputo] = useState(false);
  const [mostrarAdendas, setMostrarAdendas] = useState(false);
  const [mostrarVersiones, setMostrarVersiones] = useState(false);
  const [mostrarParams, setMostrarParams] = useState(false);
  const [faseDestino, setFaseDestino] = useState(datos.fases[0]?.id ?? "");
  const [ocultarPrecios, setOcultarPrecios] = useState(false);
  const [vistaCliente, setVistaCliente] = useState(false);

  const resumen = useMemo(() => calcularPresupuesto(todosLosItems(datos), datos.parametros), [datos]);
  const avance = useMemo(() => calcularAvanceFisico(todosLosItems(datos)), [datos]);
  const totalItems = useMemo(() => todosLosItems(datos).length, [datos]);
  const adendasActivas = datos.adendas.filter((a) => a.estado === "APROBADA" || a.estado === "BORRADOR").length;

  const faseDeItem = (itemId: string) => datos.fases.find((f) => f.items.some((i) => i.id === itemId));

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de módulo */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">
            Contratación · Presupuesto
          </p>
          <h1 className="font-headline-xl">Presupuesto de obra</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} · {totalItems} ítems · {datos.fases.length} fases ·{" "}
            {datos.adendas.length} adenda(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono="history" onClick={() => setMostrarVersiones(true)}>
            Historial ({datos.versiones.length})
          </Boton>
          <Boton variante="secundario" icono="post_add" onClick={() => setMostrarAdendas(true)}>
            Adendas (+{adendasActivas})
          </Boton>
          <Boton variante="secundario" icono="functions" onClick={() => setMostrarComputo(true)}>
            Cómputo
          </Boton>
          <Boton variante="secundario" icono="tune" onClick={() => setMostrarParams(true)}>
            Parámetros
          </Boton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Costo directo" valor={fmt(resumen.costoDirecto)} icono="construction" />
        <Kpi etiqueta="Mano de obra" valor={formatPct(resumen.pctManoObra)} pie={`${fmt(resumen.costoManoObra)}`} icono="engineering" />
        <Kpi etiqueta="Materiales" valor={formatPct(resumen.pctMateriales)} pie={`${fmt(resumen.costoMateriales)}`} icono="inventory" />
        <Kpi etiqueta="Total c/ IVA" valor={fmt(resumen.total)} pie={`Avance certificado ${formatPct(avance)}`} icono="receipt_long" />
      </div>

      {/* Controles */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant p-3 bg-surface-container-low">
          <label className="flex items-center gap-2 font-label-sm">
            Agregar a fase:
            <select
              value={faseDestino}
              onChange={(e) => setFaseDestino(e.target.value)}
              className="bg-surface border border-outline-variant rounded-sm px-2 py-1 cursor-pointer"
            >
              {datos.fases.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.numero}. {f.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex flex-wrap gap-2">
            <Boton variante="secundario" icono="menu_book" onClick={() => setMostrarCatalogo(true)}>
              Del catálogo
            </Boton>
            <Boton variante="secundario" icono="add_circle" onClick={() => setFichaNuevo(true)}>
              Nuevo ítem
            </Boton>
            <Boton
              variante="secundario"
              icono="save"
              onClick={() => {
                const etiqueta = prompt("Nombre de la versión:", `Versión ${datos.versiones.length + 1}`);
                if (etiqueta) guardar(addVersion(datos, etiqueta));
              }}
            >
              Guardar versión
            </Boton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-3">
          <label className="flex items-center gap-2 font-label-sm cursor-pointer">
            <input type="checkbox" checked={ocultarPrecios} onChange={(e) => setOcultarPrecios(e.target.checked)} />
            Ocultar precios internos
          </label>
          <label className="flex items-center gap-2 font-label-sm cursor-pointer">
            <input type="checkbox" checked={vistaCliente} onChange={(e) => setVistaCliente(e.target.checked)} />
            Vista cliente
          </label>
          <span className="font-label-sm text-on-surface-variant ml-auto">
            GG {formatPct(datos.parametros.gastosGenerales)} · Beneficio {formatPct(datos.parametros.beneficio)} · Honorarios{" "}
            {formatPct(datos.parametros.honorarios)}
            {datos.parametros.descuento > 0 && <> · Desc. {formatPct(datos.parametros.descuento)}</>}
          </span>
        </div>

        {/* Fases */}
        <div className="flex flex-col divide-y divide-outline-variant">
          {datos.fases.map((fase) => (
            <FaseAcordeon
              key={fase.id}
              fase={fase}
              resumen={resumen}
              ocultarPrecios={ocultarPrecios}
              vistaCliente={vistaCliente}
              onEditar={(item) =>
                setMostrarFicha({ item, faseId: faseDeItem(item.id)?.id ?? fase.id })
              }
              onEliminar={(itemId) => {
                if (confirm("¿Eliminar este ítem?")) guardar(removeItem(datos, fase.id, itemId));
              }}
              onCambiar={(itemId, patch) => guardar(patchItem(datos, fase.id, itemId, patch))}
              onRenombrar={(nombre) => guardar(patchFase(datos, fase.id, { nombre }))}
              onEliminarFase={() => {
                if (fase.items.length > 0) {
                  if (!confirm(`La fase "${fase.nombre}" tiene ${fase.items.length} ítems. ¿Eliminarla igual?`)) return;
                }
                guardar(removeFase(datos, fase.id));
              }}
              onAgregarItem={() => {
                setFaseDestino(fase.id);
                setFichaNuevo(true);
              }}
            />
          ))}

          {datos.fases.length === 0 && (
            <div className="p-6 text-center font-body-sm text-on-surface-variant">
              Sin fases. Agregá una fase desde «+ Nueva fase».
            </div>
          )}

          <div className="p-3">
            <Boton
              variante="fantasma"
              icono="create_new_folder"
              onClick={() => {
                const nombre = prompt("Nombre de la nueva fase:");
                if (nombre?.trim()) guardar(addFase(datos, nombre.trim()));
              }}
            >
              Nueva fase
            </Boton>
          </div>
        </div>
      </Card>

      {/* Panel financiero */}
      <PanelFinanciero resumen={resumen} params={datos.parametros} onEditarParams={() => setMostrarParams(true)} />

      {/* Modales */}
      {mostrarCatalogo && (
        <CatalogoRubros
          abierto
          onClose={() => setMostrarCatalogo(false)}
          onAgregar={(item) => guardar(addItem(datos, faseDestino, item))}
        />
      )}

      {fichaNuevo && (
        <FichaItem
          abierto
          inicial={null}
          faseIdInicial={faseDestino}
          fases={datos.fases}
          adendas={datos.adendas}
          onCerrar={() => setFichaNuevo(false)}
          onGuardar={({ item, faseId }) => guardar(addItem(datos, faseId, item))}
        />
      )}

      {mostrarFicha && (
        <FichaItem
          abierto
          inicial={mostrarFicha}
          faseIdInicial={mostrarFicha.faseId}
          fases={datos.fases}
          adendas={datos.adendas}
          onCerrar={() => setMostrarFicha(null)}
          onGuardar={({ item }) =>
            guardar(patchItem(datos, mostrarFicha.faseId, item.id, item))
          }
        />
      )}

      {mostrarComputo && <Computo abierto={mostrarComputo} datos={datos} onClose={() => setMostrarComputo(false)} />}

      {mostrarAdendas && (
        <AdendasModal
          abierto={mostrarAdendas}
          datos={datos}
          onClose={() => setMostrarAdendas(false)}
          onGuardar={(nuevos) => guardar(nuevos)}
        />
      )}

      {mostrarVersiones && (
        <Versiones abierto={mostrarVersiones} datos={datos} onClose={() => setMostrarVersiones(false)} onGuardar={(nuevos) => guardar(nuevos)} />
      )}

      {mostrarParams && (
        <ParamsModal
          abierto={mostrarParams}
          params={datos.parametros}
          onClose={() => setMostrarParams(false)}
          onGuardar={(patch) => guardar(patchParametros(datos, patch))}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fases                                                                */
/* ------------------------------------------------------------------ */

function FaseAcordeon({
  fase,
  resumen,
  ocultarPrecios,
  vistaCliente,
  onEditar,
  onEliminar,
  onCambiar,
  onRenombrar,
  onEliminarFase,
  onAgregarItem,
}: {
  fase: FasePresupuesto;
  resumen: ReturnType<typeof calcularPresupuesto>;
  ocultarPrecios: boolean;
  vistaCliente: boolean;
  onEditar: (item: ItemPresupuesto) => void;
  onEliminar: (itemId: string) => void;
  onCambiar: (itemId: string, patch: Partial<ItemPresupuesto>) => void;
  onRenombrar: (nombre: string) => void;
  onEliminarFase: () => void;
  onAgregarItem: () => void;
}) {
  const total = totalFase(fase.items);
  const ejecutado = fase.items.reduce((a, i) => a + i.cantidadEjecutada * (i.precioMaterial + i.precioManoObra), 0);
  const avance = total > 0 ? Math.min(1, ejecutado / total) : 0;
  const [abierta, setAbierta] = useState(true);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-low px-3 py-2">
        <button
          onClick={() => setAbierta((a) => !a)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <Icono
            nombre="expand_more"
            tamaño={18}
            className={`transition-transform ${abierta ? "" : "-rotate-90"}`}
          />
          <span className="font-label-md text-on-surface-variant w-5">{fase.numero}.</span>
          <span className="font-headline-sm">{fase.nombre}</span>
        </button>
        <span className="font-label-sm text-on-surface-variant">
          {fase.items.length} ítems
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline font-label-md w-40">
            {formatPct(avance)} total
          </span>
          <Progress valor={avance} className="hidden sm:block w-24" />
          <span className="font-label-md">{resumen.total > 0 ? (total / resumen.total).toLocaleString("es-PY", { style: "percent", maximumFractionDigits: 1 }) : "—"}</span>
          <span className="font-headline-sm min-w-28 text-right">Gs. {total.toLocaleString("es-PY")}</span>
        </span>
        {!vistaCliente && (
          <span className="flex items-center gap-1">
            <Boton tamano="sm" variante="fantasma" icono="edit" title="Renombrar fase" onClick={() => {
              const nombre = prompt("Nombre de la fase:", fase.nombre);
              if (nombre?.trim()) onRenombrar(nombre.trim());
            }} />
            <Boton tamano="sm" variante="fantasma" icono="playlist_add" onClick={onAgregarItem} />
            <Boton tamano="sm" variante="fantasma" icono="delete" onClick={onEliminarFase} />
          </span>
        )}
      </div>

      {abierta && (fase.items.length > 0 ? (
        <Tabla>
          <thead>
            <tr>
              <Th>Partida</Th>
              <Th>Un.</Th>
              <Th derecha>Cantidad</Th>
              {!vistaCliente && <Th derecha>Ejec.</Th>}
              {!ocultarPrecios && <Th derecha>Material</Th>}
              {!ocultarPrecios && <Th derecha>Mano obra</Th>}
              <Th derecha>Unitario</Th>
              <Th derecha>Total</Th>
              <Th>Estado</Th>
              {!vistaCliente && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {fase.items.map((item) => {
              const tono = ETIQUETA_ESTADO[item.estado].tono;
              const unitario = item.precioMaterial + item.precioManoObra;
              const esAdenda = Boolean(item.adenda);
              return (
                <tr
                  key={item.id}
                  className={`${esAdenda ? "bg-primary-container/20" : ""} hover:bg-surface-container-low`}
                >
                  <Td>
                    <div className="flex items-start gap-2">
                      <span className="font-label-sm text-on-surface-variant mt-0.5">{item.codigo}</span>
                      <div>
                        <span className="font-body-md">{item.descripcion}</span>
                        {item.nota && <span className="block font-body-sm text-on-surface-variant mt-0.5">{item.nota}</span>}
                        {esAdenda && <Chip tono="advertencia" className="mt-1">Variación {item.adenda}</Chip>}
                      </div>
                    </div>
                  </Td>
                  <Td>{formatUnidad(item.unidad)}</Td>
                  <Td derecha>
                    {vistaCliente ? (
                      item.cantidad.toLocaleString("es-PY")
                    ) : (
                      <Numero
                        valor={item.cantidad}
                        onCambio={(v) => onCambiar(item.id, { cantidad: v })}
                      />
                    )}
                  </Td>
                  {!vistaCliente && (
                    <Td derecha>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[0.7rem] text-on-surface-variant">
                          {Math.round(item.cantidad > 0 ? Math.min(1, item.cantidadEjecutada / item.cantidad) * 100 : 0)}%
                        </span>
                        <Numero
                          valor={item.cantidadEjecutada}
                          onCambio={(v) => onCambiar(item.id, { cantidadEjecutada: v })}
                        />
                      </div>
                    </Td>
                  )}
                  {!ocultarPrecios && <Td derecha className="text-on-surface-variant">{item.precioMaterial.toLocaleString("es-PY")}</Td>}
                  {!ocultarPrecios && <Td derecha className="text-on-surface-variant">{item.precioManoObra.toLocaleString("es-PY")}</Td>}
                  <Td derecha>{unitario.toLocaleString("es-PY")}</Td>
                  <Td derecha className="font-label-md">Gs. {totalItem(item).toLocaleString("es-PY")}</Td>
                  <Td>
                    {vistaCliente ? (
                      <Chip tono={tono}>{ETIQUETA_ESTADO[item.estado].texto}</Chip>
                    ) : (
                      <select
                        value={item.estado}
                        onChange={(e) => onCambiar(item.id, { estado: e.target.value as ItemPresupuesto["estado"] })}
                        className="bg-surface-container-low border border-outline-variant rounded-sm px-1.5 py-1 text-xs cursor-pointer"
                      >
                        {(Object.keys(ETIQUETA_ESTADO) as ItemPresupuesto["estado"][]).map((s) => (
                          <option key={s} value={s}>
                            {ETIQUETA_ESTADO[s].texto}
                          </option>
                        ))}
                      </select>
                    )}
                  </Td>
                  {!vistaCliente && (
                    <Td>
                      <div className="flex gap-1">
                        <Boton tamano="sm" variante="fantasma" icono="edit_note" onClick={() => onEditar(item)} />
                        <Boton tamano="sm" variante="fantasma" icono="delete" onClick={() => onEliminar(item.id)} />
                      </div>
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      ) : (
        <div className="p-4 text-center font-body-sm text-on-surface-variant">Fase vacía</div>
      ))}
    </div>
  );
}

function Numero({ valor, onCambio }: { valor: number; onCambio: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      className="w-24 bg-surface-container-low border border-transparent focus:border-tertiary rounded-sm px-1.5 py-1 text-right text-xs outline-none hover:border-outline-variant"
      value={valor}
      onChange={(e) => onCambio(Number(e.target.value) >= 0 ? Number(e.target.value) : 0)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Panel financiero                                                     */
/* ------------------------------------------------------------------ */

function FilaTotales({ etiqueta, valor, detalle, destacado = false }: { etiqueta: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${destacado ? "" : ""}`}>
      <span className="font-label-sm">{etiqueta}</span>
      <span className="text-right">
        <span className={`block ${destacado ? "font-headline-md text-primary" : "font-label-md"}`}>{valor}</span>
        {detalle && <span className="block font-body-sm text-on-surface-variant">{detalle}</span>}
      </span>
    </div>
  );
}

function PanelFinanciero({
  resumen: r,
  params,
  onEditarParams,
}: {
  resumen: ReturnType<typeof calcularPresupuesto>;
  params: ParametrosFinancieros;
  onEditarParams: () => void;
}) {
  const { fmt } = useMoneda();
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-headline-md">Resumen financiero</h3>
        <Boton tamano="sm" variante="fantasma" icono="tune" onClick={onEditarParams}>
          Parámetros
        </Boton>
      </div>
      <div className="divide-y divide-outline-variant">
        <FilaTotales etiqueta="Materiales" valor={fmt(r.costoMateriales)} detalle={`${formatPct(r.pctMateriales, 0)} del costo directo`} />
        <FilaTotales etiqueta="Mano de obra" valor={fmt(r.costoManoObra)} detalle={`${formatPct(r.pctManoObra, 0)} del costo directo`} />
        <FilaTotales etiqueta="Costo directo" valor={fmt(r.costoDirecto)} destacado />
        <FilaTotales etiqueta="Gastos generales" valor={fmt(r.gastosGenerales)} detalle={`${formatPct(params.gastosGenerales)}`} />
        <FilaTotales etiqueta="Beneficio" valor={fmt(r.beneficio)} detalle={`${formatPct(params.beneficio)}`} />
        <FilaTotales etiqueta="Honorarios" valor={fmt(r.honorarios)} detalle={`${formatPct(params.honorarios)}`} />
        <FilaTotales etiqueta="Subtotal bruto" valor={fmt(r.subtotalBruto)} />
        {params.descuento > 0 && (
          <FilaTotales etiqueta="Descuento" valor={`- ${fmt(r.descuento)}`} detalle={`${formatPct(params.descuento)}`} />
        )}
        <FilaTotales etiqueta="Subtotal neto" valor={fmt(r.subtotalNeto)} />
        {params.facturaIva && (
          <>
            <FilaTotales etiqueta="IVA materiales (10%)" valor={fmt(r.ivaMateriales)} />
            <FilaTotales etiqueta="IVA mano de obra (5%)" valor={fmt(r.ivaManoObra)} />
          </>
        )}
        <div className="px-3 py-2.5 bg-primary-container/30 border border-primary/20 rounded-sm mt-1 flex items-center justify-between">
          <span className="font-headline-sm">Total a facturar</span>
          <span className="font-headline-lg text-primary">Gs. {r.total.toLocaleString("es-PY")}</span>
        </div>
        {!params.facturaIva && (
          <p className="font-body-sm text-on-surface-variant px-3 py-2">
            IVA desactivado en los parámetros; el total se muestra sin impuesto.
          </p>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Parámetros                                                           */
/* ------------------------------------------------------------------ */

function ParamsModal({
  abierto,
  params,
  onClose,
  onGuardar,
}: {
  abierto: boolean;
  params: ParametrosFinancieros;
  onClose: () => void;
  onGuardar: (patch: Partial<ParametrosFinancieros>) => void;
}) {
  const [gg, setGg] = useState(String(params.gastosGenerales * 100));
  const [beneficio, setBeneficio] = useState(String(params.beneficio * 100));
  const [honorarios, setHonorarios] = useState(String(params.honorarios * 100));
  const [descuento, setDescuento] = useState(String(params.descuento * 100));
  const [ivaMat, setIvaMat] = useState(String(params.ivaMateriales * 100));
  const [ivaMo, setIvaMo] = useState(String(params.ivaManoObra * 100));
  const [facturaIva, setFacturaIva] = useState(params.facturaIva);

  return (
    <Modal abierto={abierto} titulo="Parámetros financieros" icono="tune" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="font-body-sm text-on-surface-variant">
          Los coeficientes se aplican en orden: GG y honorarios sobre el costo directo, beneficio
          sobre el costo cargado, descuento sobre el subtotal bruto, e IVA repartido (materiales
          10%, mano de obra 5%) sobre la base neta.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PctInput etiqueta="Gastos generales" valor={gg} onCambio={setGg} />
          <PctInput etiqueta="Beneficio" valor={beneficio} onCambio={setBeneficio} />
          <PctInput etiqueta="Honorarios" valor={honorarios} onCambio={setHonorarios} />
          <PctInput etiqueta="Descuento" valor={descuento} onCambio={setDescuento} />
          <PctInput etiqueta="IVA materiales" valor={ivaMat} onCambio={setIvaMat} />
          <PctInput etiqueta="IVA mano de obra" valor={ivaMo} onCambio={setIvaMo} />
        </div>
        <label className="flex items-center gap-2 font-label-md cursor-pointer">
          <input type="checkbox" checked={facturaIva} onChange={(e) => setFacturaIva(e.target.checked)} />
          Facturar IVA (mostrar impuesto en el total)
        </label>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onClose}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            icono="check"
            onClick={() => {
              const num = (s: string) => (Number(s) >= 0 ? Number(s) / 100 : 0);
              onGuardar({
                gastosGenerales: num(gg),
                beneficio: num(beneficio),
                honorarios: num(honorarios),
                descuento: num(descuento),
                ivaMateriales: num(ivaMat),
                ivaManoObra: num(ivaMo),
                facturaIva,
              });
              onClose();
            }}
          >
            Aplicar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

function PctInput({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm">{etiqueta}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          className="bg-surface-container-low border border-outline-variant rounded-sm px-2.5 py-1.5 text-sm focus:border-tertiary outline-none w-full pr-7"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-label-sm text-on-surface-variant">%</span>
      </div>
    </label>
  );
}