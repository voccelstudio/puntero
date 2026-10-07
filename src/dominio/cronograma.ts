import { diasEntre, sumarDias } from "@/dominio/formato";
import type { EstadoTarea, TareaCronograma } from "@/dominio/tipos";

export interface Rango {
  inicio: string;
  fin: string;
  dias: number;
}

/** Rango global que cubre todas las tareas; hoy si no hay ninguna. */
export function rangoGlobal(tareas: TareaCronograma[]): Rango {
  if (tareas.length === 0) {
    const hoy = new Date().toISOString().slice(0, 10);
    return { inicio: hoy, fin: hoy, dias: 1 };
  }
  const inicios = tareas.map((t) => t.inicio).sort();
  const fines = tareas.map((t) => t.fin).sort((a, b) => b.localeCompare(a));
  const inicio = inicios[0]!;
  const fin = fines[0]!;
  return { inicio, fin, dias: diasEntre(inicio, fin) + 1 };
}

export function duracion(tarea: TareaCronograma): number {
  return Math.max(1, diasEntre(tarea.inicio, tarea.fin) + 1);
}

export function diasDesde(tarea: TareaCronograma, desde: string): number {
  return Math.max(0, diasEntre(desde, tarea.inicio));
}

/** Avance físico sugerido a partir de las fechas (si el avance declarado es 0). */
export function avancePorFechas(tarea: TareaCronograma, hoy: string): number {
  if (tarea.avance > 0) return tarea.avance;
  const total = duracion(tarea);
  const transcurridos = diasEntre(tarea.inicio, hoy) + 1;
  if (transcurridos <= 0) return 0;
  if (transcurridos >= total) return 1;
  return transcurridos / total;
}

export const ESTADO_NOMBRE: Record<EstadoTarea, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  BLOQUEADA: "Bloqueada",
};

/** Estado que correspondería según las fechas, respetando bloqueos manuales. */
export function estadoSugerido(tarea: TareaCronograma, hoy: string): EstadoTarea {
  if (tarea.estado === "BLOQUEADA") return "BLOQUEADA";
  if (tarea.estado === "FINALIZADA") return "FINALIZADA";
  if (hoy > tarea.fin) return "FINALIZADA";
  if (hoy >= tarea.inicio) return "EN_CURSO";
  return "PENDIENTE";
}

/**
 * Ruta crítica por CPM (Critical Path Method) sobre el DAG de dependencias.
 * Con las fechas fijadas de cada tarea, la holgura es la diferencia entre el
 * plan y las restricciones de precedencia; las tareas con holgura cero son
 * críticas.
 */
export function rutaCritica(tareas: TareaCronograma[]): Set<string> {
  if (tareas.length === 0) return new Set();
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const dur = new Map(tareas.map((t) => [t.id, duracion(t)]));
  const inicio = rangoGlobal(tareas).inicio;

  // Desplazamiento planificado de cada tarea respecto al inicio del proyecto.
  const planInicio = new Map(tareas.map((t) => [t.id, diasDesde(t, inicio)]));
  const planFin = new Map(tareas.map((t) => [t.id, planInicio.get(t.id)! + dur.get(t.id)!]));
  const proyectoFin = Math.max(...[...planFin.values()]);

  // Forward pass.
  const es = new Map<string, number>();
  const visitar = new Map<string, string>(); // visita guard para ciclos
  const orden: string[] = [];
  const resolver = (id: string): number => {
    if (es.has(id)) return es.get(id)!;
    if (visitar.has(id)) return planInicio.get(id)!; // ciclo: se ignora la dependencia
    visitar.set(id, "en curso");
    const t = porId.get(id)!;
    const maxPred = t.dependeDe.reduce((max, p) => {
      if (!porId.has(p)) return max;
      const v = resolver(p) + dur.get(p)!;
      return Math.max(max, v);
    }, 0);
    const valor = Math.max(planInicio.get(id)!, maxPred);
    es.set(id, valor);
    orden.push(id);
    return valor;
  };
  for (const t of tareas) resolver(t.id);

  // Backward pass.
  const ls = new Map<string, number>();
  const resolverLs = (id: string): number => {
    if (ls.has(id)) return ls.get(id)!;
    if (visitar.has(id)) return planFin.get(id)!;
    visitar.set(id, "en curso");
    const minSucesor = tareas.reduce((min, otra) => {
      if (!otra.dependeDe.includes(id)) return min;
      return Math.min(min, resolverLs(otra.id) - dur.get(id)!);
    }, proyectoFin - dur.get(id)!);
    const valor = Math.min(planFin.get(id)!, minSucesor);
    ls.set(id, valor);
    return valor;
  };
  for (let i = orden.length - 1; i >= 0; i--) resolverLs(orden[i]!);

  const criticas = new Set<string>();
  for (const t of tareas) {
    const holgura = Math.abs(es.get(t.id)! - ls.get(t.id)!);
    if (holgura < 0.5) criticas.add(t.id);
  }
  return criticas;
}

/** Avance físico global ponderado por duración de cada tarea. */
export function avanceGlobal(tareas: TareaCronograma[]): number {
  const totalDur = tareas.reduce((a, t) => a + duracion(t), 0);
  if (totalDur === 0) return 0;
  const hoy = new Date().toISOString().slice(0, 10);
  return tareas.reduce((a, t) => a + avancePorFechas(t, hoy) * duracion(t), 0) / totalDur;
}

/** Fin de la última tarea del proyecto (hito de entrega). */
export function finProyecto(tareas: TareaCronograma[]): string | null {
  if (tareas.length === 0) return null;
  return tareas.map((t) => t.fin).sort((a, b) => b.localeCompare(a))[0]!;
}

export function inicioProyecto(tareas: TareaCronograma[]): string | null {
  if (tareas.length === 0) return null;
  return tareas.map((t) => t.inicio).sort()[0]!;
}

/** Tarea mínima para el formulario "nueva tarea". */
export function nuevaTarea(opciones: {
  nombre: string;
  faseId: string;
  inicio: string;
  fin: string;
  responsable: string;
  dependeDe: string[];
}): TareaCronograma {
  return {
    id: `tarea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ...opciones,
    avance: 0,
    estado: "PENDIENTE",
    itemIds: [],
    critica: false,
  };
}

export { sumarDias };