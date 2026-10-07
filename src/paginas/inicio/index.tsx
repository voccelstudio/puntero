import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMoneda } from "@/contexto/moneda";
import { useObra, type EntradaObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import {
  calcularAvanceFisico,
  calcularPresupuesto,
  itemDesdeRubro,
  nuevoId,
  todosLosItems,
} from "@/dominio/calculo";
import {
  diasEntre,
  formatCompacto,
  formatFecha,
  formatPct,
  formatUnidad,
  hoyIso,
  sumarDias,
} from "@/dominio/formato";
import { MODULOS } from "@/dominio/modulos";
import { buscarRubros, IVA_LAB, IVA_MAT, type Rubro } from "@/dominio/precios";
import { semillaPresupuesto } from "@/dominio/semillas/presupuesto";
import type { EstadoObra, FaseObra, ItemPresupuesto, Obra, TipoObra } from "@/dominio/tipos";
import { Boton, Campo, Card, Chip, EmptyState, Icono, Kpi, Modal, Progress, Select, Texto } from "@/ui/base";
import { agregarItemsAlPresupuesto } from "@/paginas/inicio/operaciones";

const TIPO_NOMBRE: Record<TipoObra, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
  REFORMA: "Reforma",
  INFRAESTRUCTURA: "Infraestructura",
};

const TIPO_OPCIONES = (Object.keys(TIPO_NOMBRE) as TipoObra[]).map((t) => ({ valor: t, texto: TIPO_NOMBRE[t] }));

const ESTADO_NOMBRE: Record<EstadoObra, { texto: string; tono: "neutro" | "primario" | "exito" | "error" | "advertencia" }> = {
  PLANIFICACION: { texto: "Planificación", tono: "neutro" },
  EN_CURSO: { texto: "En curso", tono: "primario" },
  FINALIZADA: { texto: "Finalizada", tono: "exito" },
  SUSPENDIDA: { texto: "Suspendida", tono: "error" },
};

const ESTADO_OPCIONES = (Object.entries(ESTADO_NOMBRE) as [EstadoObra, { texto: string; tono: string }][]).map(
  ([valor, e]) => ({ valor, texto: e.texto }),
);

const FASE_NOMBRE: Record<FaseObra, string> = {
  PREPARACION: "Preparación",
  ESTRUCTURA: "Estructura",
  INSTALACIONES: "Instalaciones",
  TERMINACIONES: "Terminaciones",
};

const FASE_OPCIONES = (Object.entries(FASE_NOMBRE) as [FaseObra, string][]).map(([valor, texto]) => ({ valor, texto }));

export function PaginaInicio() {
  const { obras, cambiar, obraPorId, crearObra, actualizarObra, eliminarObra, esSemilla } = useObra();
  const navigate = useNavigate();
  const [nueva, setNueva] = useState(false);
  const [editar, setEditar] = useState<Obra | null>(null);

  const enCurso = obras.filter((o) => o.estado === "EN_CURSO");
  const enPreparacion = obras.filter((o) => o.estado === "PLANIFICACION");
  const finalizadas = obras.filter((o) => o.estado === "FINALIZADA");
  const suspendidas = obras.length - enCurso.length - enPreparacion.length - finalizadas.length;
  const superficie = enCurso.reduce((acc, o) => acc + o.superficie, 0);
  const vencimiento = proximoVencimiento(obras);

  const abrir = (id: string, ruta: string) => {
    cambiar(id);
    navigate(`${ruta}?obra=${id}`);
  };

  const nuevaYabrir = (entrada: EntradaObra) => {
    const nueva = crearObra(entrada);
    abrir(nueva.id, "/presupuesto");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Resumen</p>
          <h1 className="font-headline-xl">Comando de obra</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obras.length} proyecto(s) · {enCurso.length} en obra · vista general de tu cartera
          </p>
        </div>
        <Boton icono="add" onClick={() => setNueva(true)}>
          Nueva obra
        </Boton>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          etiqueta="En obra"
          valor={enCurso.length}
          pie={`${enPreparacion.length} en preparación`}
          icono="construction"
        />
        <Kpi
          etiqueta="Concluidas"
          valor={finalizadas.length}
          pie={`${suspendidas} suspendidas/otras`}
          icono="task_alt"
        />
        <Kpi
          etiqueta="Superficie en obra"
          valor={`${superficie.toLocaleString("es-PY")} m²`}
          pie="suma de proyectos en curso"
          icono="square_foot"
        />
        <Kpi
          etiqueta="Próximo vencimiento"
          valor={
            !vencimiento
              ? "—"
              : vencimiento.consumida
                ? "Vencido"
                : `${vencimiento.dias} días`
          }
          pie={vencimiento?.nombre ?? "sin plazos cargados"}
          icono="alarm"
          alerta={vencimiento?.consumida ?? false}
        />
      </div>

      {/* Atajos */}
      <Card padding="none">
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant px-3 py-2 bg-surface-container-low">
          <span className="font-label-sm text-on-surface-variant">Ir a</span>
          {MODULOS.filter((m) => m.disponible && m.ruta !== "/").map((m) => (
            <button
              key={m.ruta}
              onClick={() => navigate(m.ruta)}
              className="flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-2.5 py-1.5 font-label-md hover:bg-surface-container cursor-pointer"
            >
              <Icono nombre={m.icono} tamaño={16} />
              {m.etiqueta}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Proyectos */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="font-headline-md flex items-center gap-2">
            <Icono nombre="apartment" tamaño={20} />
            Proyectos
          </h2>
          {obras.length === 0 ? (
            <EmptyState
              icono="home_work"
              titulo="Todavía no hay proyectos"
              descripcion="Creá tu primera obra para arrancar: presupuesto, cronograma, finanzas y gente viven dentro de cada proyecto."
              accion={<Boton icono="add" onClick={() => setNueva(true)}>Nueva obra</Boton>}
            />
          ) : (
            obras.map((o) => (
              <TarjetaObra
                key={o.id}
                obra={o}
                onAbrir={() => abrir(o.id, "/presupuesto")}
                onEditar={() => setEditar(obraPorId(o.id) ?? o)}
              />
            ))
          )}
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-4">
          <ComputoRapido />
        </div>
      </div>

      {nueva && (
        <ObraForm
          titulo="Nueva obra"
          onCerrar={() => setNueva(false)}
          onGuardar={nuevaYabrir}
        />
      )}

      {editar && (
        <ObraForm
          titulo="Editar obra"
          obra={editar}
          onCerrar={() => setEditar(null)}
          onActualizar={(ob) => actualizarObra(ob)}
          onEliminar={(id) => eliminarObra(id)}
          puedeEliminar={!esSemilla(editar.id)}
        />
      )}
    </div>
  );
}

function proximoVencimiento(obras: Obra[]): { nombre: string; dias: number; consumida: boolean } | null {
  const conPlazo = obras.filter(
    (o) => (o.estado === "EN_CURSO" || o.estado === "PLANIFICACION") && o.finEstimado,
  );
  if (conPlazo.length === 0) return null;
  const conDias = conPlazo
    .map((o) => ({ nombre: o.nombre, dias: diasEntre(hoyIso(), o.finEstimado) }))
    .sort((a, b) => a.dias - b.dias);
  const primero = conDias[0]!;
  return { ...primero, consumida: primero.dias < 0 };
}

/* ------------------------------------------------------------------ */
/* Tarjeta de proyecto                                                  */
/* ------------------------------------------------------------------ */

function TarjetaObra({
  obra,
  onAbrir,
  onEditar,
}: {
  obra: Obra;
  onAbrir: () => void;
  onEditar: () => void;
}) {
  const { moneda, pygPorUsd } = useMoneda();
  const { datos } = useColeccion(obra.id, "presupuesto", semillaPresupuesto(obra.id));

  const items = useMemo(() => todosLosItems(datos), [datos]);
  const resumen = useMemo(
    () => calcularPresupuesto(items, datos.parametros),
    [items, datos.parametros],
  );
  const avance = useMemo(() => calcularAvanceFisico(items), [items]);
  const sinPartidas = datos.fases.length === 0;

  const dias = diasEntre(hoyIso(), obra.finEstimado);
  const estado = ESTADO_NOMBRE[obra.estado];

  return (
    <Card className="gap-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-sm text-on-surface-variant">{obra.codigo}</span>
            <Chip tono={estado.tono}>{estado.texto}</Chip>
            <Chip>{FASE_NOMBRE[obra.fase]}</Chip>
            {obra.estado === "EN_CURSO" && (
              <span className={`font-body-sm ${dias <= 30 ? "text-error" : "text-on-surface-variant"}`}>
                {dias < 0 ? `venció hace ${Math.abs(dias)} días` : `${dias} días restantes`}
              </span>
            )}
          </div>
          <h3 className="font-headline-lg mt-1">{obra.nombre}</h3>
          <p className="font-body-sm text-on-surface-variant mt-0.5">
            {obra.ubicacion || "Sin ubicación"} ·{" "}
            {obra.superficie > 0 ? `${obra.superficie.toLocaleString("es-PY")} m²` : "superficie sin cargar"}
          </p>
          <p className="font-body-sm text-on-surface-variant">
            {formatFecha(obra.inicio)} → {formatFecha(obra.finEstimado)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Boton variante="secundario" icono="edit" onClick={onEditar} tamano="sm">
            Editar
          </Boton>
          <Boton icono="arrow_forward" onClick={onAbrir} tamano="sm">
            Abrir
          </Boton>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="font-label-sm text-on-surface-variant">Total c/ IVA</p>
          <p className="font-headline-md">{formatCompacto(sinPartidas ? 0 : resumen.total, moneda, pygPorUsd)}</p>
        </div>
        <div>
          <p className="font-label-sm text-on-surface-variant">Avance físico</p>
          <p className="font-headline-md">{formatPct(avance)}</p>
        </div>
        <div>
          <p className="font-label-sm text-on-surface-variant">Ítems</p>
          <p className="font-headline-md">{items.length}</p>
        </div>
      </div>

      <div className="mt-3">
        <Progress valor={avance} />
        <div className="mt-1 flex justify-between">
          <span className="font-body-sm text-on-surface-variant">
            {sinPartidas ? "Sin partidas todavía" : "Presupuesto de la obra"}
          </span>
          <span className="font-label-sm">{formatCompacto(resumen.costoDirecto, moneda, pygPorUsd)}</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Cómputo rápido                                                      */
/* ------------------------------------------------------------------ */

interface Linea {
  rubro: Rubro;
  cantidad: number;
}

function ComputoRapido() {
  const { obra } = useObra();
  const { moneda, pygPorUsd, fmt } = useMoneda();
  const navigate = useNavigate();
  const presupuesto = useColeccion(obra.id, "presupuesto", semillaPresupuesto(obra.id));

  const [busqueda, setBusqueda] = useState("");
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [lineas, setLineas] = useState<Linea[]>([]);

  const resultados = useMemo(() => {
    const texto = busqueda.trim();
    return texto.length > 0 ? buscarRubros(texto, 8) : [];
  }, [busqueda]);

  const q = Number(cantidad) || 0;

  const resumenRubro = rubro && q > 0
    ? {
        materiales: q * rubro.costoMateriales,
        manoObra: q * rubro.costoManoObra,
        ivaMat: q * rubro.costoMateriales * IVA_MAT,
        ivaMO: q * rubro.costoManoObra * IVA_LAB,
      }
    : null;

  const subtotalLineas = lineas.reduce(
    (acc, l) => acc + l.cantidad * (l.rubro.costoMateriales + l.rubro.costoManoObra),
    0,
  );
  const ivaLineas = lineas.reduce(
    (acc, l) =>
      acc + l.cantidad * (l.rubro.costoMateriales * IVA_MAT + l.rubro.costoManoObra * IVA_LAB),
    0,
  );

  const sumarRubro = () => {
    if (!rubro || q <= 0) return;
    setLineas((previo) => {
      const existe = previo.find((l) => l.rubro.id === rubro.id);
      if (existe) {
        return previo.map((l) => (l.rubro.id === rubro.id ? { ...l, cantidad: l.cantidad + q } : l));
      }
      return [...previo, { rubro, cantidad: q }];
    });
    setCantidad("1");
    setRubro(null);
    setBusqueda("");
  };

  const cargarAlPresupuesto = () => {
    if (lineas.length === 0) return;
    const items: ItemPresupuesto[] = lineas.map((l) => ({
      ...itemDesdeRubro(l.rubro, l.cantidad),
      id: nuevoId("item"),
    }));
    presupuesto.guardar(agregarItemsAlPresupuesto(presupuesto.datos, items));
    setLineas([]);
    navigate(`/presupuesto?obra=${obra.id}`);
  };

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 bg-surface-container-low">
        <h2 className="font-headline-sm flex items-center gap-2">
          <Icono nombre="calculate" tamaño={18} />
          Cómputo rápido
        </h2>
        <Icono nombre="bolt" tamaño={18} className="text-primary" />
      </div>

      <div className="flex flex-col gap-3 p-3">
        <Texto
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setRubro(null);
          }}
          placeholder="Buscar rubro o material…"
        />

        {resultados.length > 0 && (
          <div className="flex flex-col overflow-hidden rounded-sm border border-outline-variant">
            {resultados.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRubro(r);
                  setBusqueda("");
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-surface-container-low cursor-pointer border-b last:border-b-0 border-outline-variant ${
                  rubro?.id === r.id ? "bg-primary-container" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-body-md truncate">{r.nombre}</span>
                  <span className="block font-body-sm text-on-surface-variant">
                    {r.categoria} · {formatUnidad(r.unidad as ItemPresupuesto["unidad"])}
                  </span>
                </span>
                <span className="font-label-sm shrink-0">
                  {formatCompacto(r.costoMateriales + r.costoManoObra, moneda, pygPorUsd)}
                </span>
              </button>
            ))}
          </div>
        )}

        {rubro && (
          <div className="flex flex-col gap-2 rounded-sm border border-outline-variant bg-surface-container-low p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-body-md">{rubro.nombre}</p>
              <button onClick={() => setRubro(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer" aria-label="Quitar rubro">
                <Icono nombre="close" tamaño={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-label-sm">
              <span className="text-on-surface-variant">Material</span>
              <span className="text-right">{formatCompacto(rubro.costoMateriales, moneda, pygPorUsd)}</span>
              <span className="text-on-surface-variant">Mano de obra</span>
              <span className="text-right">{formatCompacto(rubro.costoManoObra, moneda, pygPorUsd)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Campo etiqueta={`Cantidad (${formatUnidad(rubro.unidad as ItemPresupuesto["unidad"])})`}>
                <Texto inputMode="decimal" type="number" min={0} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </Campo>
              <Boton tamano="sm" icono="playlist_add" onClick={sumarRubro} disabled={q <= 0}>
                Sumar
              </Boton>
            </div>
            {resumenRubro && (
              <div className="grid grid-cols-2 gap-1 font-label-sm border-t border-outline-variant pt-2">
                <span className="text-on-surface-variant">Subtotal (mat + MO)</span>
                <span className="text-right">{fmt(resumenRubro.materiales + resumenRubro.manoObra)}</span>
                <span className="text-on-surface-variant">IVA partido (10% + 5%)</span>
                <span className="text-right">{fmt(resumenRubro.ivaMat + resumenRubro.ivaMO)}</span>
                <span className="text-on-surface font-medium">Total</span>
                <span className="text-right font-medium text-primary">
                  {fmt(resumenRubro.materiales + resumenRubro.manoObra + resumenRubro.ivaMat + resumenRubro.ivaMO)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-outline-variant pt-2">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant">En el cómputo</span>
            <span className="font-label-sm">{lineas.length} línea(s)</span>
          </div>

          {lineas.length === 0 ? (
            <p className="font-body-sm text-on-surface-variant py-1">Sumá rubros para armar un cómputo rápido.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {lineas.map((l) => (
                <div key={l.rubro.id} className="flex items-center gap-2 rounded-sm border border-outline-variant bg-surface-container-low px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-body-sm">{l.rubro.nombre}</span>
                  <Texto
                    inputMode="decimal"
                    type="number"
                    min={0}
                    className="w-20"
                    value={String(l.cantidad)}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setLineas((previo) => previo.map((x) => (x.rubro.id === l.rubro.id ? { ...x, cantidad: v } : x)));
                    }}
                  />
                  <button
                    onClick={() => setLineas((previo) => previo.filter((x) => x.rubro.id !== l.rubro.id))}
                    className="text-on-surface-variant hover:text-error cursor-pointer"
                    aria-label="Quitar del cómputo"
                  >
                    <Icono nombre="close" tamaño={16} />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-1 font-label-sm pt-1">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="text-right">{fmt(subtotalLineas)}</span>
                <span className="text-on-surface-variant">IVA partido</span>
                <span className="text-right">{fmt(ivaLineas)}</span>
                <span className="text-on-surface font-medium">Total estimado</span>
                <span className="text-right font-medium text-primary">{fmt(subtotalLineas + ivaLineas)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Boton
              variante="primario"
              icono="save"
              disabled={lineas.length === 0}
              onClick={cargarAlPresupuesto}
              tamano="sm"
            >
              Cargar al presupuesto
            </Boton>
            {lineas.length > 0 && (
              <Boton variante="fantasma" icono="delete_sweep" onClick={() => setLineas([])} tamano="sm">
                Vaciar
              </Boton>
            )}
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Se carga en la obra activa: <span className="font-medium text-on-surface">{obra.nombre}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Alta / edición de obra                                              */
/* ------------------------------------------------------------------ */

function ObraForm({
  titulo,
  obra = null,
  onCerrar,
  onGuardar,
  onActualizar,
  onEliminar,
  puedeEliminar = false,
}: {
  titulo: string;
  obra?: Obra | null;
  onCerrar: () => void;
  onGuardar?: (entrada: EntradaObra) => void;
  onActualizar?: (obra: Obra) => void;
  onEliminar?: (id: string) => void;
  puedeEliminar?: boolean;
}) {
  const [nombre, setNombre] = useState(obra?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoObra>(obra?.tipo ?? "RESIDENCIAL");
  const [comitente, setComitente] = useState(obra?.comitente ?? "");
  const [empresa, setEmpresa] = useState(obra?.empConstructora ?? "");
  const [ubicacion, setUbicacion] = useState(obra?.ubicacion ?? "");
  const [superficie, setSuperficie] = useState(obra?.superficie ? String(obra.superficie) : "");
  const [estado, setEstado] = useState<EstadoObra>(obra?.estado ?? "PLANIFICACION");
  const [fase, setFase] = useState<FaseObra>(obra?.fase ?? "PREPARACION");
  const [resumen, setResumen] = useState(obra?.resumen ?? "");
  const [inicio, setInicio] = useState(obra?.inicio ?? hoyIso());
  const [fin, setFin] = useState(obra?.finEstimado ?? sumarDias(hoyIso(), 180));

  const guardar = () => {
    if (obra && onActualizar) {
      onActualizar({
        ...obra,
        nombre: nombre.trim(),
        tipo,
        comitente: comitente.trim(),
        empConstructora: empresa.trim(),
        ubicacion: ubicacion.trim(),
        superficie: Number(superficie) || 0,
        estado,
        fase,
        resumen,
        inicio,
        finEstimado: fin,
      });
    } else if (onGuardar) {
      onGuardar({
        nombre,
        tipo,
        comitente,
        empConstructora: empresa,
        ubicacion,
        superficie: Number(superficie) || 0,
        inicio,
        finEstimado: fin,
      });
    }
    onCerrar();
  };

  return (
    <Modal abierto titulo={titulo} icono={obra ? "edit" : "add_home"} onClose={onCerrar} tamano="md">
      <div className="flex flex-col gap-3">
        {obra && (
          <div className="rounded-sm border border-outline-variant bg-surface-container-low p-2 font-label-sm text-on-surface-variant">
            {obra.codigo} · datos guardados en este dispositivo
          </div>
        )}

        <Campo etiqueta="Nombre del proyecto">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Residencial Mbocayaty" />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoObra)}>
              {TIPO_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Superficie (m²)">
            <Texto inputMode="decimal" type="number" min={0} value={superficie} onChange={(e) => setSuperficie(e.target.value)} />
          </Campo>
        </div>

        <Campo etiqueta="Comitente">
          <Texto value={comitente} onChange={(e) => setComitente(e.target.value)} placeholder="Inmobiliaria / familia" />
        </Campo>
        <Campo etiqueta="Constructora">
          <Texto value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </Campo>
        <Campo etiqueta="Ubicación">
          <Texto value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ciudad, distrito, referencia…" />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Inicio">
            <Texto type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Entrega estimada">
            <Texto type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </Campo>
        </div>

        {obra && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Estado">
                <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoObra)}>
                  {ESTADO_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Etapa">
                <Select value={fase} onChange={(e) => setFase(e.target.value as FaseObra)}>
                  {FASE_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
            <Campo etiqueta="Resumen">
              <textarea
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                className="min-h-16 bg-surface-container-low border border-outline-variant rounded-sm px-2.5 py-1.5 font-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-tertiary outline-none w-full"
                placeholder="Nota breve sobre el proyecto…"
              />
            </Campo>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
          <Boton icono="save" disabled={!nombre.trim()} onClick={guardar}>
            {obra ? "Guardar cambios" : "Crear obra"}
          </Boton>

          {obra && puedeEliminar && onEliminar && (
            <Boton
              variante="peligro"
              icono="delete"
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar "${obra.nombre}"? Se borran sus colecciones de este dispositivo (presupuesto, finanzas, cronograma, gente) y de los respaldos.`,
                  )
                ) {
                  onEliminar(obra.id);
                  onCerrar();
                }
              }}
            >
              Eliminar obra
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  );
}