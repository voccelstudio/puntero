import { useState } from "react";
import { useMoneda } from "@/contexto/moneda";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import { nuevoId } from "@/dominio/calculo";
import { descargarCsv } from "@/dominio/exportar";
import { formatFecha, formatUnidad, hoyIso, sumarDias } from "@/dominio/formato";
import { semillaBiblioteca, semillaMateriales, semillaPedidos } from "@/dominio/semillas/recursos";
import type {
  DatosBiblioteca,
  DatosMateriales,
  DatosPedidos,
  DocumentoBiblioteca,
  EstadoDocumento,
  EstadoPedido,
  ItemPedido,
  Material,
  Pedido,
  TipoDocumento,
  Unidad,
} from "@/dominio/tipos";
import { Area, Boton, Campo, Card, Chip, EmptyState, Kpi, Modal, Select, Tabla, Td, Texto, Th } from "@/ui/base";
import { BotonesExportar } from "@/ui/exportar";
import {
  addDocumento,
  addMaterial,
  addPedido,
  documentoVencido,
  entregasProximas,
  estadoDocumento,
  patchDocumento,
  patchMaterial,
  patchPedido,
  pedidoAbierto,
  pedidosEnTransito,
  pendienteItem,
  removeDocumento,
  removeMaterial,
  removePedido,
  stockCritico,
  totalPedido,
  valorAcopio,
} from "@/paginas/recursos/operaciones";

type Pestania = "materiales" | "pedidos" | "biblioteca";

type Tono = "neutro" | "primario" | "secundario" | "tertiary" | "exito" | "error" | "advertencia";

const UNIDADES: Unidad[] = ["m2", "m3", "m", "ml", "kg", "gl", "u", "dia", "jornal", "mes"];

const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  BORRADOR: { texto: "Borrador", tono: "neutro" },
  ENVIADO: { texto: "Enviado", tono: "secundario" },
  EN_TRANSITO: { texto: "En tránsito", tono: "tertiary" },
  RECIBIDO_PARCIAL: { texto: "Recibido parcial", tono: "advertencia" },
  RECIBIDO: { texto: "Recibido", tono: "exito" },
  CANCELADO: { texto: "Cancelado", tono: "error" },
};

const TIPO_DOC: Record<TipoDocumento, string> = {
  CONTRATO: "Contrato",
  PLIEGO: "Pliego",
  PLANO: "Plano",
  FICHA_TECNICA: "Ficha técnica",
  SEGURO: "Seguro",
  NORMA: "Norma",
  OTRO: "Otro",
};

const ESTADO_DOC: Record<EstadoDocumento, { texto: string; tono: Tono }> = {
  VIGENTE: { texto: "Vigente", tono: "exito" },
  VENCIDO: { texto: "Vencido", tono: "error" },
  EN_REVISION: { texto: "En revisión", tono: "advertencia" },
};

export function PaginaRecursos() {
  const { obra } = useObra();
  const { fmt } = useMoneda();
  const materiales = useColeccion<DatosMateriales>(obra.id, "materiales", semillaMateriales());
  const pedidos = useColeccion<DatosPedidos>(obra.id, "pedidos", semillaPedidos());
  const biblioteca = useColeccion<DatosBiblioteca>(obra.id, "biblioteca", semillaBiblioteca());

  const [pestania, setPestania] = useState<Pestania>("materiales");
  const [materialForm, setMaterialForm] = useState<Material | "nuevo" | null>(null);
  const [pedidoForm, setPedidoForm] = useState<Pedido | "nuevo" | null>(null);
  const [documentoForm, setDocumentoForm] = useState<DocumentoBiblioteca | "nuevo" | null>(null);

  const criticos = materiales.datos.materiales.filter(stockCritico).length;
  const vencidos = biblioteca.datos.documentos.filter(documentoVencido).length;

  const exportarCsv = () => {
    if (pestania === "materiales") {
      descargarCsv(
        `materiales-${obra.codigo}`,
        ["Código", "Nombre", "Categoría", "Unidad", "Proveedor", "Precio ref (Gs.)", "Stock", "Stock mínimo", "Alerta"],
        materiales.datos.materiales.map((m) => [
          m.codigo,
          m.nombre,
          m.categoria,
          formatUnidad(m.unidad),
          m.proveedorHabitual,
          m.precioReferencia,
          m.stock,
          m.stockMinimo,
          stockCritico(m) ? "Stock crítico" : "",
        ]),
      );
    } else if (pestania === "pedidos") {
      descargarCsv(
        `pedidos-${obra.codigo}`,
        ["Número", "Fecha", "Proveedor", "Destino", "Entrega", "Estado", "Total (Gs.)"],
        pedidos.datos.pedidos.map((p) => [
          p.numero,
          p.fecha,
          p.proveedor,
          p.destino,
          p.fechaEntrega,
          ESTADO_PEDIDO[p.estado].texto,
          totalPedido(p),
        ]),
      );
    } else {
      descargarCsv(
        `biblioteca-${obra.codigo}`,
        ["Título", "Tipo", "Categoría", "Descripción", "Referencia", "Vence", "Estado"],
        biblioteca.datos.documentos.map((d) => [
          d.titulo,
          TIPO_DOC[d.tipo],
          d.categoria,
          d.descripcion,
          d.referencia ?? "",
          d.vence ?? "",
          ESTADO_DOC[estadoDocumento(d)].texto,
        ]),
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Recursos · Insumos</p>
          <h1 className="font-headline-xl">Materiales, pedidos y biblioteca</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} · {materiales.datos.materiales.length} insumos · {pedidos.datos.pedidos.length} pedidos ·{" "}
            {biblioteca.datos.documentos.length} documentos
          </p>
        </div>
        <BotonesExportar onCsv={exportarCsv} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Pedidos en tránsito" valor={pedidosEnTransito(pedidos.datos)} icono="local_shipping" />
        <Kpi etiqueta="Entregas (7 días)" valor={entregasProximas(pedidos.datos)} icono="event_available" />
        <Kpi etiqueta="Stock crítico" valor={criticos} icono="warning" alerta={criticos > 0} />
        <Kpi etiqueta="Valor en acopios" valor={fmt(valorAcopio(materiales.datos))} icono="inventory_2" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2">
        {(
          [
            ["materiales", "Materiales"],
            ["pedidos", "Pedidos"],
            ["biblioteca", "Biblioteca"],
          ] as [Pestania, string][]
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setPestania(id)}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-label-md cursor-pointer ${
              pestania === id ? "bg-primary text-on-primary" : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {etiqueta}
            {id === "biblioteca" && vencidos > 0 && <Chip tono="error">{vencidos}</Chip>}
          </button>
        ))}

        <div className="ml-auto no-print">
          {pestania === "materiales" && (
            <Boton variante="primario" icono="add" onClick={() => setMaterialForm("nuevo")}>
              Nuevo material
            </Boton>
          )}
          {pestania === "pedidos" && (
            <Boton variante="primario" icono="add" onClick={() => setPedidoForm("nuevo")}>
              Nuevo pedido
            </Boton>
          )}
          {pestania === "biblioteca" && (
            <Boton variante="primario" icono="add" onClick={() => setDocumentoForm("nuevo")}>
              Nuevo documento
            </Boton>
          )}
        </div>
      </div>

      {pestania === "materiales" && (
        <MaterialesView
          datos={materiales.datos}
          fmt={fmt}
          onEditar={(m) => setMaterialForm(m)}
          onEliminar={(id) => confirm("¿Eliminar este material?") && materiales.guardar(removeMaterial(materiales.datos, id))}
        />
      )}

      {pestania === "pedidos" && (
        <PedidosView
          datos={pedidos.datos}
          fmt={fmt}
          onEditar={(p) => setPedidoForm(p)}
          onEstado={(id, estado) => pedidos.guardar(patchPedido(pedidos.datos, id, { estado }))}
          onEliminar={(id) => confirm("¿Eliminar este pedido?") && pedidos.guardar(removePedido(pedidos.datos, id))}
        />
      )}

      {pestania === "biblioteca" && (
        <BibliotecaView
          datos={biblioteca.datos}
          onEditar={(d) => setDocumentoForm(d)}
          onEliminar={(id) => confirm("¿Eliminar este documento?") && biblioteca.guardar(removeDocumento(biblioteca.datos, id))}
        />
      )}

      {materialForm && (
        <MaterialForm
          valor={materialForm === "nuevo" ? null : materialForm}
          onCerrar={() => setMaterialForm(null)}
          onGuardar={(m) => {
            materiales.guardar(
              materialForm === "nuevo"
                ? addMaterial(materiales.datos, { ...m, id: nuevoId("mat") })
                : patchMaterial(materiales.datos, materialForm.id, m),
            );
            setMaterialForm(null);
          }}
        />
      )}

      {pedidoForm && (
        <PedidoForm
          valor={pedidoForm === "nuevo" ? null : pedidoForm}
          onCerrar={() => setPedidoForm(null)}
          onGuardar={(p) => {
            pedidos.guardar(
              pedidoForm === "nuevo" ? addPedido(pedidos.datos, p) : patchPedido(pedidos.datos, pedidoForm.id, p),
            );
            setPedidoForm(null);
          }}
        />
      )}

      {documentoForm && (
        <DocumentoForm
          valor={documentoForm === "nuevo" ? null : documentoForm}
          onCerrar={() => setDocumentoForm(null)}
          onGuardar={(d) => {
            biblioteca.guardar(
              documentoForm === "nuevo"
                ? addDocumento(biblioteca.datos, { ...d, id: nuevoId("doc") })
                : patchDocumento(biblioteca.datos, documentoForm.id, d),
            );
            setDocumentoForm(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Materiales                                                          */
/* ------------------------------------------------------------------ */

function MaterialesView({
  datos,
  fmt,
  onEditar,
  onEliminar,
}: {
  datos: DatosMateriales;
  fmt: (m: number, decimales?: boolean) => string;
  onEditar: (m: Material) => void;
  onEliminar: (id: string) => void;
}) {
  if (datos.materiales.length === 0) {
    return (
      <EmptyState
        icono="inventory_2"
        titulo="Sin materiales"
        descripcion="Cargá los insumos con su precio de referencia y su stock para controlar reposiciones."
      />
    );
  }
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Código</Th>
          <Th>Insumo</Th>
          <Th>Unidad</Th>
          <Th>Proveedor</Th>
          <Th derecha>Precio ref.</Th>
          <Th derecha>Stock</Th>
          <Th derecha>Mínimo</Th>
          <Th>Alerta</Th>
          <Th>Acciones</Th>
        </tr>
      </thead>
      <tbody>
        {datos.materiales.map((m) => (
          <tr key={m.id} className="hover:bg-surface-container-low">
            <Td className="font-mono text-xs">{m.codigo}</Td>
            <Td>
              <span className="block font-body-md">{m.nombre}</span>
              <span className="block font-body-sm text-on-surface-variant">{m.categoria}</span>
            </Td>
            <Td className="text-on-surface-variant">{formatUnidad(m.unidad)}</Td>
            <Td className="text-on-surface-variant">{m.proveedorHabitual || "—"}</Td>
            <Td derecha>{fmt(m.precioReferencia)}</Td>
            <Td derecha className="font-medium">{m.stock}</Td>
            <Td derecha className="text-on-surface-variant">{m.stockMinimo}</Td>
            <Td>{stockCritico(m) ? <Chip tono="error">Reponer</Chip> : <Chip tono="exito">OK</Chip>}</Td>
            <Td>
              <div className="flex gap-1">
                <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => onEditar(m)} />
                <Boton tamano="sm" variante="fantasma" icono="delete" onClick={() => onEliminar(m.id)} />
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function MaterialForm({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: Material | null;
  onCerrar: () => void;
  onGuardar: (m: Omit<Material, "id">) => void;
}) {
  const [codigo, setCodigo] = useState(valor?.codigo ?? "");
  const [nombre, setNombre] = useState(valor?.nombre ?? "");
  const [categoria, setCategoria] = useState(valor?.categoria ?? "");
  const [unidad, setUnidad] = useState<Unidad>(valor?.unidad ?? "u");
  const [proveedorHabitual, setProveedor] = useState(valor?.proveedorHabitual ?? "");
  const [precioReferencia, setPrecio] = useState(String(valor?.precioReferencia ?? 0));
  const [stock, setStock] = useState(String(valor?.stock ?? 0));
  const [stockMinimo, setStockMinimo] = useState(String(valor?.stockMinimo ?? 0));

  return (
    <Modal abierto titulo={valor ? "Editar material" : "Nuevo material"} icono="inventory_2" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Código">
            <Texto value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="MET-ADN-10" />
          </Campo>
          <Campo etiqueta="Categoría">
            <Texto value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Aceros" />
          </Campo>
        </div>
        <Campo etiqueta="Nombre del insumo">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Unidad">
            <Select value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{formatUnidad(u)}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Proveedor habitual">
            <Texto value={proveedorHabitual} onChange={(e) => setProveedor(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Precio ref. (Gs.)">
            <Texto type="number" inputMode="numeric" value={precioReferencia} onChange={(e) => setPrecio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Stock">
            <Texto type="number" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} />
          </Campo>
          <Campo etiqueta="Stock mínimo">
            <Texto type="number" inputMode="decimal" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
          </Campo>
        </div>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={nombre.trim().length === 0}
            onClick={() =>
              onGuardar({
                codigo: codigo.trim() || "—",
                nombre: nombre.trim(),
                categoria: categoria.trim() || "General",
                unidad,
                proveedorHabitual: proveedorHabitual.trim(),
                precioReferencia: Math.round(Number(precioReferencia)) || 0,
                stock: Number(stock) || 0,
                stockMinimo: Number(stockMinimo) || 0,
              })
            }
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

function PedidosView({
  datos,
  fmt,
  onEditar,
  onEstado,
  onEliminar,
}: {
  datos: DatosPedidos;
  fmt: (m: number, decimales?: boolean) => string;
  onEditar: (p: Pedido) => void;
  onEstado: (id: string, estado: EstadoPedido) => void;
  onEliminar: (id: string) => void;
}) {
  if (datos.pedidos.length === 0) {
    return (
      <EmptyState
        icono="local_shipping"
        titulo="Sin pedidos"
        descripcion="Cargá órdenes de compra para seguir entregas, recepciones parciales y destino en obra."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {datos.pedidos.map((p) => (
        <Card key={p.id} className={pedidoAbierto(p) ? "" : "opacity-70"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-label-md">{p.numero}</span>
                <Chip tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Chip>
                <span className="font-body-sm text-on-surface-variant">
                  {formatFecha(p.fecha)} → entrega {formatFecha(p.fechaEntrega)}
                </span>
              </div>
              <p className="font-headline-sm mt-1">{p.proveedor || "Proveedor sin cargar"}</p>
              <p className="font-body-sm text-on-surface-variant">
                Destino: {p.destino || "—"} · {p.items.length} línea(s) ·{" "}
                {p.items.reduce((a, i) => a + pendienteItem(i), 0)} pendiente(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-headline-md">{fmt(totalPedido(p))}</span>
              <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => onEditar(p)} />
              <Boton tamano="sm" variante="fantasma" icono="delete" onClick={() => onEliminar(p.id)} />
            </div>
          </div>

          {p.items.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <Th>Descripción</Th>
                    <Th derecha>Cantidad</Th>
                    <Th derecha>Recibido</Th>
                    <Th derecha>P. unitario</Th>
                    <Th derecha>Subtotal</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((i) => (
                    <tr key={i.id}>
                      <Td>{i.descripcion}</Td>
                      <Td derecha>{i.cantidad} {formatUnidad(i.unidad)}</Td>
                      <Td derecha className="text-on-surface-variant">{i.cantidadRecibida}</Td>
                      <Td derecha>{fmt(i.precioUnitario)}</Td>
                      <Td derecha className="font-medium">{fmt(i.cantidad * i.precioUnitario)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3 no-print">
            <span className="font-label-sm text-on-surface-variant">Estado logístico:</span>
            <Select
              className="w-auto"
              value={p.estado}
              onChange={(e) => onEstado(p.id, e.target.value as EstadoPedido)}
            >
              {(Object.keys(ESTADO_PEDIDO) as EstadoPedido[]).map((e) => (
                <option key={e} value={e}>{ESTADO_PEDIDO[e].texto}</option>
              ))}
            </Select>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PedidoForm({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: Pedido | null;
  onCerrar: () => void;
  onGuardar: (p: Pedido) => void;
}) {
  const [numero, setNumero] = useState(valor?.numero ?? "");
  const [fecha, setFecha] = useState(valor?.fecha ?? hoyIso());
  const [proveedor, setProveedor] = useState(valor?.proveedor ?? "");
  const [destino, setDestino] = useState(valor?.destino ?? "");
  const [fechaEntrega, setFechaEntrega] = useState(valor?.fechaEntrega ?? sumarDias(hoyIso(), 7));
  const [estado, setEstado] = useState<EstadoPedido>(valor?.estado ?? "BORRADOR");
  const [items, setItems] = useState<ItemPedido[]>(valor?.items ?? []);
  const [nueva, setNueva] = useState<{ descripcion: string; unidad: Unidad; cantidad: string; precioUnitario: string }>({
    descripcion: "",
    unidad: "u",
    cantidad: "1",
    precioUnitario: "0",
  });

  const agregarItem = () => {
    if (nueva.descripcion.trim().length === 0) return;
    setItems((previo) => [
      ...previo,
      {
        id: nuevoId("item"),
        descripcion: nueva.descripcion.trim(),
        unidad: nueva.unidad,
        cantidad: Number(nueva.cantidad) || 0,
        precioUnitario: Math.round(Number(nueva.precioUnitario)) || 0,
        cantidadRecibida: 0,
      },
    ]);
    setNueva({ descripcion: "", unidad: "u", cantidad: "1", precioUnitario: "0" });
  };

  return (
    <Modal abierto titulo={valor ? "Editar pedido" : "Nuevo pedido"} icono="local_shipping" onClose={onCerrar} tamano="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Número / OC">
            <Texto value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="OC-2026-001" />
          </Campo>
          <Campo etiqueta="Fecha">
            <Texto type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Proveedor">
            <Texto value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          </Campo>
          <Campo etiqueta="Destino en obra">
            <Texto value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Acopio central, Fase 2…" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha de entrega">
            <Texto type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </Campo>
          <Campo etiqueta="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedido)}>
              {(Object.keys(ESTADO_PEDIDO) as EstadoPedido[]).map((e) => (
                <option key={e} value={e}>{ESTADO_PEDIDO[e].texto}</option>
              ))}
            </Select>
          </Campo>
        </div>

        <div>
          <p className="font-label-sm mb-2">Líneas del pedido</p>
          <Tabla>
            <thead>
              <tr>
                <Th>Descripción</Th>
                <Th derecha>Cantidad</Th>
                <Th derecha>U. precio</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <Td>{i.descripcion}</Td>
                  <Td derecha>{i.cantidad} {formatUnidad(i.unidad)}</Td>
                  <Td derecha>{i.precioUnitario.toLocaleString("es-PY")}</Td>
                  <Td>
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="close"
                      onClick={() => setItems((previo) => previo.filter((x) => x.id !== i.id))}
                    />
                  </Td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <Td className="text-on-surface-variant">Sin líneas cargadas.</Td>
                </tr>
              )}
            </tbody>
          </Tabla>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Campo etiqueta="Descripción" className="flex-1 min-w-40">
              <Texto value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} />
            </Campo>
            <Campo etiqueta="Unidad" className="w-24">
              <Select value={nueva.unidad} onChange={(e) => setNueva({ ...nueva, unidad: e.target.value as Unidad })}>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{formatUnidad(u)}</option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Cantidad" className="w-24">
              <Texto type="number" inputMode="decimal" value={nueva.cantidad} onChange={(e) => setNueva({ ...nueva, cantidad: e.target.value })} />
            </Campo>
            <Campo etiqueta="U. precio (Gs.)" className="w-32">
              <Texto type="number" inputMode="numeric" value={nueva.precioUnitario} onChange={(e) => setNueva({ ...nueva, precioUnitario: e.target.value })} />
            </Campo>
            <Boton variante="secundario" icono="add" disabled={nueva.descripcion.trim().length === 0} onClick={agregarItem}>
              Agregar
            </Boton>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            onClick={() =>
              onGuardar({
                id: valor?.id ?? nuevoId("ped"),
                numero: numero.trim() || "Sin número",
                fecha,
                proveedor: proveedor.trim(),
                destino: destino.trim(),
                fechaEntrega,
                estado,
                items,
              })
            }
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Biblioteca                                                          */
/* ------------------------------------------------------------------ */

function BibliotecaView({
  datos,
  onEditar,
  onEliminar,
}: {
  datos: DatosBiblioteca;
  onEditar: (d: DocumentoBiblioteca) => void;
  onEliminar: (id: string) => void;
}) {
  if (datos.documentos.length === 0) {
    return (
      <EmptyState
        icono="folder_open"
        titulo="Biblioteca vacía"
        descripcion="Guardá contratos, planos, fichas técnicas y seguros, con su vencimiento para no perder el control."
      />
    );
  }
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Documento</Th>
          <Th>Tipo</Th>
          <Th>Descripción</Th>
          <Th>Referencia</Th>
          <Th>Vence</Th>
          <Th>Estado</Th>
          <Th>Acciones</Th>
        </tr>
      </thead>
      <tbody>
        {datos.documentos.map((d) => {
          const estado = estadoDocumento(d);
          return (
            <tr key={d.id} className="hover:bg-surface-container-low">
              <Td>
                <span className="block font-body-md">{d.titulo}</span>
                <span className="block font-body-sm text-on-surface-variant">{d.categoria}</span>
              </Td>
              <Td className="text-on-surface-variant">{TIPO_DOC[d.tipo]}</Td>
              <Td className="text-on-surface-variant max-w-64">{d.descripcion}</Td>
              <Td className="font-mono text-xs text-on-surface-variant">{d.referencia ?? "—"}</Td>
              <Td className={estado === "VENCIDO" ? "text-error" : "text-on-surface-variant"}>{formatFecha(d.vence ?? "")}</Td>
              <Td><Chip tono={ESTADO_DOC[estado].tono}>{ESTADO_DOC[estado].texto}</Chip></Td>
              <Td>
                <div className="flex gap-1">
                  <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => onEditar(d)} />
                  <Boton tamano="sm" variante="fantasma" icono="delete" onClick={() => onEliminar(d.id)} />
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function DocumentoForm({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: DocumentoBiblioteca | null;
  onCerrar: () => void;
  onGuardar: (d: Omit<DocumentoBiblioteca, "id">) => void;
}) {
  const [titulo, setTitulo] = useState(valor?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoDocumento>(valor?.tipo ?? "OTRO");
  const [categoria, setCategoria] = useState(valor?.categoria ?? "");
  const [descripcion, setDescripcion] = useState(valor?.descripcion ?? "");
  const [referencia, setReferencia] = useState(valor?.referencia ?? "");
  const [vence, setVence] = useState(valor?.vence ?? "");
  const [estado, setEstado] = useState<EstadoDocumento>(valor?.estado ?? "VIGENTE");

  return (
    <Modal abierto titulo={valor ? "Editar documento" : "Nuevo documento"} icono="folder_open" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Título">
          <Texto value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
              {(Object.keys(TIPO_DOC) as TipoDocumento[]).map((t) => (
                <option key={t} value={t}>{TIPO_DOC[t]}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Categoría">
            <Texto value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Legal, técnico…" />
          </Campo>
        </div>
        <Campo etiqueta="Descripción">
          <Area value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Referencia / enlace" hint="Ruta, código o URL">
            <Texto value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </Campo>
          <Campo etiqueta="Vence" hint="Opcional">
            <Texto type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Estado">
          <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoDocumento)}>
            {(Object.keys(ESTADO_DOC) as EstadoDocumento[]).map((s) => (
              <option key={s} value={s}>{ESTADO_DOC[s].texto}</option>
            ))}
          </Select>
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={titulo.trim().length === 0}
            onClick={() =>
              onGuardar({
                titulo: titulo.trim(),
                tipo,
                categoria: categoria.trim() || "General",
                descripcion: descripcion.trim(),
                referencia: referencia.trim() || undefined,
                vence: vence || undefined,
                fecha: valor?.fecha ?? hoyIso(),
                estado,
              })
            }
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
