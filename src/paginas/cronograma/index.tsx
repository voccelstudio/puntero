import { useState } from "react";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import {
  ESTADO_NOMBRE,
  avanceGlobal,
  avancePorFechas,
  diasDesde,
  duracion,
  estadoSugerido,
  finProyecto,
  inicioProyecto,
  rangoGlobal,
  rutaCritica,
} from "@/dominio/cronograma";
import { formatFecha, formatPct, hoyIso } from "@/dominio/formato";
import { semillaCronograma } from "@/dominio/semillas/cronograma";
import { semillaPresupuesto } from "@/dominio/semillas/presupuesto";
import type { EstadoTarea, TareaCronograma } from "@/dominio/tipos";
import { Boton, Campo, Card, Chip, EmptyState, Icono, Kpi, Modal, Progress, Select, Td, Texto, Th, Tabla } from "@/ui/base";
import { addTarea, patchTarea, removeTarea } from "@/paginas/cronograma/operaciones";

const PX_DIA = 22;

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function PaginaCronograma() {
  const { obra } = useObra();
  const { datos, guardar } = useColeccion(
    obra.id,
    "cronograma",
    semillaCronograma(obra.id),
  );
  const presupuesto = useColeccion(
    obra.id,
    "presupuesto",
    semillaPresupuesto(obra.id),
  );
  const [abrirNueva, setAbrirNueva] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [soloCriticas, setSoloCriticas] = useState(false);

  const criticas = rutaCritica(datos.tareas);
  const global = rangoGlobal(datos.tareas);
  const hoy = hoyIso();
  const tareasVisibles = soloCriticas
    ? datos.tareas.filter((t) => criticas.has(t.id))
    : datos.tareas;

  const faseNombre = (faseId: string): string => {
    const f = presupuesto.datos.fases.find((x) => x.id === faseId);
    return f ? f.nombre : "—";
  };

  const editar = editarId ? datos.tareas.find((t) => t.id === editarId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Ejecución · Cronograma</p>
          <h1 className="font-headline-xl">Cronograma y Gantt</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} ·
            {inicioProyecto(datos.tareas) ? `${formatFecha(inicioProyecto(datos.tareas)!)} → ${formatFecha(finProyecto(datos.tareas)!)}` : "Sin tareas"} ·
            {datos.tareas.length} tareas · {críticasCount(criticas)} en ruta crítica
          </p>
        </div>
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            icono="update"
            onClick={() => {
              guardar({
                ...datos,
                tareas: datos.tareas.map((t) => ({
                  ...t,
                  estado: estadoSugerido(t, hoy),
                })),
              });
            }}
          >
            Ajustar estados
          </Boton>
          <Boton variante="primario" icono="add" onClick={() => setAbrirNueva(true)}>
            Nueva tarea
          </Boton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi etiqueta="Duración total" valor={`${global.dias} días`} icono="calendar_month" />
        <Kpi etiqueta="Tareas" valor={datos.tareas.length} icono="task" />
        <Kpi etiqueta="Finalizadas" valor={datos.tareas.filter((t) => t.estado === "FINALIZADA").length} icono="task_alt" />
        <Kpi etiqueta="Críticas" valor={críticasCount(criticas)} pie="no tienen holgura" icono="warning" alerta={críticasCount(criticas) > 0} />
        <Kpi etiqueta="Avance global" valor={formatPct(avanceGlobal(datos.tareas), 0)} icono="trending_up" />
      </div>

      <label className="flex items-center gap-2 font-label-sm cursor-pointer">
        <input type="checkbox" checked={soloCriticas} onChange={(e) => setSoloCriticas(e.target.checked)} />
        Mostrar solo la ruta crítica
      </label>

      {datos.tareas.length === 0 ? (
        <EmptyState
          icono="calendar_month"
          titulo="Sin tareas"
          descripcion="Cargá la primera tarea del cronograma para ver el Gantt."
          accion={
            <Boton variante="primario" icono="add" onClick={() => setAbrirNueva(true)}>
              Nueva tarea
            </Boton>
          }
        />
      ) : (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-outline-variant px-3 py-2">
              <p className="font-headline-md">Diagrama de Gantt</p>
            </div>
            <Gantt tareas={tareasVisibles} global={global} hoy={hoy} criticas={criticas} faseNombre={faseNombre} />
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-outline-variant px-3 py-2">
              <p className="font-headline-md">Detalle de tareas</p>
            </div>
            <Tabla>
              <thead>
                <tr>
                  <Th>Fase</Th>
                  <Th>Tarea</Th>
                  <Th>Responsable</Th>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th derecha>Días</Th>
                  <Th derecha>Avance</Th>
                  <Th>Estado</Th>
                  <Th>Dependencias</Th>
                  <Th>Crítica</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {tareasVisibles.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    <Td className="text-on-surface-variant">{faseNombre(t.faseId)}</Td>
                    <Td>
                      <span className="font-body-md">{t.nombre}</span>
                      {t.itemIds.length > 0 && (
                        <span className="block font-body-sm text-on-surface-variant">{t.itemIds.length} ítem(s) de presupuesto</span>
                      )}
                    </Td>
                    <Td className="text-on-surface-variant">{t.responsable}</Td>
                    <Td>{formatFecha(t.inicio)}</Td>
                    <Td>{formatFecha(t.fin)}</Td>
                    <Td derecha>{duracion(t)}</Td>
                    <Td derecha>
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          className="w-16 bg-surface-container-low border border-transparent rounded-sm px-1.5 py-0.5 text-right text-xs outline-none focus:border-tertiary hover:border-outline-variant"
                          value={Math.round(avancePorFechas(t, hoy) * 100)}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100;
                            guardar(patchTarea(datos, t.id, { avance: v }));
                          }}
                        />
                        <Progress valor={avancePorFechas(t, hoy)} className="w-16" />
                      </div>
                    </Td>
                    <Td>
                      <select
                        value={t.estado}
                        onChange={(e) => guardar(patchTarea(datos, t.id, { estado: e.target.value as EstadoTarea }))}
                        className="bg-surface-container-low border border-outline-variant rounded-sm px-1.5 py-1 text-xs cursor-pointer"
                      >
                        {(Object.keys(ESTADO_NOMBRE) as EstadoTarea[]).map((s) => (
                          <option key={s} value={s}>{ESTADO_NOMBRE[s]}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {t.dependeDe.length === 0 ? (
                        <span className="font-body-sm text-on-surface-variant">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.dependeDe.map((d) => (
                            <Chip key={d} tono="tertiary">
                              {datos.tareas.find((x) => x.id === d)?.nombre.slice(0, 18) ?? d}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td>{criticas.has(t.id) ? <Icono nombre="warning" tamaño={18} className="text-error" /> : null}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => setEditarId(t.id)} />
                        <Boton
                          tamano="sm"
                          variante="fantasma"
                          icono="delete"
                          onClick={() => confirm(`¿Eliminar "${t.nombre}"?`) && guardar(removeTarea(datos, t.id))}
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </Card>
        </>
      )}

      {abrirNueva && (
        <ModalTarea
          titulo="Nueva tarea"
          faseInicial={presupuesto.datos.fases[0]?.id ?? ""}
          fases={presupuesto.datos.fases.map((f) => ({ id: f.id, nombre: `${f.numero}. ${f.nombre}` }))}
          tareas={datos.tareas}
          onCerrar={() => setAbrirNueva(false)}
          onGuardar={(t) => {
            guardar(
              addTarea(datos, {
                ...t,
                id: `tarea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                critica: false,
              }),
            );
            setAbrirNueva(false);
          }}
        />
      )}

      {editar && (
        <ModalTarea
          titulo="Editar tarea"
          faseInicial={editar.faseId}
          fases={presupuesto.datos.fases.map((f) => ({ id: f.id, nombre: `${f.numero}. ${f.nombre}` }))}
          tareas={datos.tareas}
          inicial={editar}
          onCerrar={() => setEditarId(null)}
          onGuardar={(t) => {
            guardar(patchTarea(datos, editar.id, { ...t }));
            setEditarId(null);
          }}
        />
      )}
    </div>
  );
}

function críticasCount(set: Set<string>): number {
  return set.size;
}

/* ------------------------------------------------------------------ */
/* Gantt                                                               */
/* ------------------------------------------------------------------ */

function Gantt({
  tareas,
  global,
  hoy,
  criticas,
  faseNombre,
}: {
  tareas: TareaCronograma[];
  global: { inicio: string; fin: string; dias: number };
  hoy: string;
  criticas: Set<string>;
  faseNombre: (faseId: string) => string;
}) {
  const ancho = global.dias * PX_DIA;
  const diasDeHoy = Math.max(0, indiceDia(global.inicio, hoy));

  const meses: { etiqueta: string; desde: number; dias: number }[] = [];
  for (let i = 0; i < global.dias; i++) {
    const fecha = sumarDiasIso(global.inicio, i);
    const clave = fecha.slice(0, 7);
    const ultimo = meses[meses.length - 1];
    if (!ultimo || ultimo.etiqueta.split(" ")[1] !== clave) {
      meses.push({ etiqueta: `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(0, 4)}`, desde: i, dias: 1 });
    } else {
      ultimo.dias++;
    }
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ width: ancho + 240 }} className="relative">
        {/* Encabezado de meses */}
        <div className="sticky top-0 z-20 bg-surface border-b border-outline-variant">
          <div className="flex">
            <div className="sticky left-0 z-30 w-60 shrink-0 bg-surface border-r border-outline-variant px-3 py-1.5 font-label-sm text-on-surface-variant">
              Fase · Tarea
            </div>
            <div className="relative" style={{ width: ancho }}>
              {meses.map((m) => (
                <div
                  key={`${m.etiqueta}-${m.desde}`}
                  className="absolute top-0 border-l border-outline-variant pl-2 py-1.5 font-label-md text-on-surface-variant truncate"
                  style={{ left: m.desde * PX_DIA, width: m.dias * PX_DIA }}
                >
                  {m.etiqueta}
                </div>
              ))}

              {/* Línea de hoy */}
              {diasDeHoy >= 0 && diasDeHoy <= global.dias && (
                <div
                  className="absolute top-0 bottom-0 z-10 border-l-2 border-error pointer-events-none"
                  style={{ left: 240 + diasDeHoy * PX_DIA - 1 }}
                />
              )}
              <div className="absolute top-1 right-2 z-10 font-label-sm text-on-surface-variant">
                Hoy {formatFecha(hoy)}
              </div>
            </div>
          </div>

          {/* Ticks semanales */}
          <div className="flex">
            <div className="sticky left-0 z-30 w-60 shrink-0 bg-surface border-r border-outline-variant" />
            <div className="relative" style={{ width: ancho }}>
              {Array.from({ length: global.dias }, (_, i) => {
                const fecha = sumarDiasIso(global.inicio, i);
                const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
                if (i !== 0 && dow !== 1) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-0 font-label-sm text-on-surface-variant/70 border-l border-outline-variant/40 px-1"
                    style={{ left: i * PX_DIA }}
                  >
                    {String(Number(fecha.slice(8, 10))).padStart(2, "0")}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rows */}
        {tareas.map((t) => {
          const desde = diasDesde(t, global.inicio);
          const dur = duracion(t);
          const avance = avancePorFechas(t, hoy);
          const color =
            t.estado === "FINALIZADA"
              ? "bg-ok"
              : t.estado === "BLOQUEADA"
                ? "bg-error"
                : t.estado === "EN_CURSO"
                  ? "bg-tertiary"
                  : "bg-outline";
          const critica = criticas.has(t.id);
          return (
            <div
              key={t.id}
              className="flex border-b border-surface-variant last:border-0 hover:bg-surface-container-low"
            >
              <div className="sticky left-0 z-20 w-60 shrink-0 bg-surface px-3 py-1.5 border-r border-outline-variant">
                <span className={`block font-body-md truncate ${critica ? "text-error" : ""}`}>
                  {t.nombre}
                </span>
                <span className="block font-body-sm text-on-surface-variant truncate">
                  {faseNombre(t.faseId)} · {t.responsable} · {formatPct(avance, 0)}
                </span>
              </div>
              <div className="relative" style={{ width: ancho }}>
                {/* grilla fina por semana */}
                {Array.from({ length: global.dias }, (_, i) =>
                  i !== 0 && new Date(`${sumarDiasIso(global.inicio, i)}T00:00:00Z`).getUTCDay() === 1 ? (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-outline-variant/40" style={{ left: i * PX_DIA }} />
                  ) : null,
                )}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-sm ${color} ${
                    critica ? "ring-2 ring-error" : ""
                  } overflow-hidden`}
                  style={{ left: desde * PX_DIA + 1, width: Math.max(dur * PX_DIA - 2, 8) }}
                  title={`${t.nombre} · ${formatFecha(t.inicio)} → ${formatFecha(t.fin)}`}
                >
                  <div
                    className="h-full bg-black/25"
                    style={{ width: `${Math.round(avance * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {tareas.length === 0 && (
          <div className="p-6 text-center font-body-sm text-on-surface-variant">
            Sin tareas en el filtro actual.
          </div>
        )}
      </div>
    </div>
  );
}

function indiceDia(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  );
}

function sumarDiasIso(iso: string, dias: number): string {
  const f = new Date(`${iso}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Modal tarea                                                         */
/* ------------------------------------------------------------------ */

function ModalTarea({
  titulo,
  inicial,
  faseInicial,
  fases,
  tareas,
  onCerrar,
  onGuardar,
}: {
  titulo: string;
  inicial?: TareaCronograma;
  faseInicial: string;
  fases: { id: string; nombre: string }[];
  tareas: TareaCronograma[];
  onCerrar: () => void;
  onGuardar: (t: Omit<TareaCronograma, "id" | "critica">) => void;
}) {
  const hoy = hoyIso();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [faseId, setFaseId] = useState(inicial?.faseId ?? faseInicial);
  const [inicio, setInicio] = useState(inicial?.inicio ?? hoy);
  const [fin, setFin] = useState(inicial?.fin ?? hoy);
  const [responsable, setResponsable] = useState(inicial?.responsable ?? "");
  const [dependeDe, setDependeDe] = useState<string[]>(inicial?.dependeDe ?? []);

  const diaSel = diasEntre(inicio, fin) + 1;

  return (
    <Modal abierto titulo={titulo} icono="task" onClose={onCerrar} tamano="lg">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Tarea">
            <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Colado de entrepiso 2° nivel" />
          </Campo>
          <Campo etiqueta="Fase">
            <Select value={faseId} onChange={(e) => setFaseId(e.target.value)}>
              {fases.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Responsable">
            <Texto value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Cuadrilla A / contratista…" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Inicio">
              <Texto type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo etiqueta="Fin">
              <Texto type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </Campo>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Duración: <span className="font-label-md">{diaSel}</span> día(s)
          </p>
        </div>

        <div>
          <p className="font-label-sm mb-2">Depende de (deben terminar antes)</p>
          <div className="max-h-80 overflow-y-auto border border-outline-variant rounded-sm divide-y divide-outline-variant">
            {tareas.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low cursor-pointer disabled:opacity-40"
              >
                <input
                  type="checkbox"
                  disabled={inicial?.id === t.id}
                  checked={dependeDe.includes(t.id)}
                  onChange={(e) =>
                    setDependeDe((prev) =>
                      e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                    )
                  }
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-body-md truncate">{t.nombre}</span>
                  <span className="block font-body-sm text-on-surface-variant">
                    {formatFecha(t.inicio)} → {formatFecha(t.fin)}
                  </span>
                </span>
                <Chip tono={t.estado === "FINALIZADA" ? "exito" : "neutro"}>{ESTADO_NOMBRE[t.estado]}</Chip>
              </label>
            ))}
            {tareas.length === 0 && (
              <p className="p-3 font-body-sm text-on-surface-variant">Todavía no hay tareas para enlazar.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-outline-variant pt-4">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          variante="primario"
          icono="check"
          disabled={nombre.trim().length === 0 || !inicio || !fin}
          onClick={() =>
            onGuardar({
              faseId,
              nombre: nombre.trim(),
              inicio,
              fin,
              avance: 0,
              estado: "PENDIENTE",
              responsable: responsable.trim() || "—",
              itemIds: [],
              dependeDe,
            })
          }
        >
          Guardar
        </Boton>
      </div>
    </Modal>
  );
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}