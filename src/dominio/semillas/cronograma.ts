import { FASES_PRESUPUESTO, ITEM_ADENDA } from "@/dominio/semillas/presupuesto";
import { sumarDias } from "@/dominio/formato";
import type { DatosCronograma, TareaCronograma } from "@/dominio/tipos";

/**
 * Cronograma semilla derivado del presupuesto base: una tarea por fase, con
 * fechas encadenadas y avance coherente con el `cantidadEjecutada` de los
 * ítems. Sirve de punto de partida para el Gantt.
 */

const INICIO = "2026-02-16";

const POR_FASE: { faseId: string; nombre: string; duracionDias: number; avance: number; responsable: string }[] = [
  { faseId: "fase-1", nombre: "Demolición y movimiento de suelos", duracionDias: 25, avance: 1, responsable: "Cuadrilla A" },
  { faseId: "fase-2", nombre: "Fundaciones", duracionDias: 30, avance: 1, responsable: "Cuadrilla A" },
  { faseId: "fase-3", nombre: "Estructura de hormigón armado", duracionDias: 75, avance: 0.68, responsable: "Cuadrilla B" },
  { faseId: "fase-4", nombre: "Mampostería y tabiquería", duracionDias: 55, avance: 0.34, responsable: "Cuadrilla A" },
  { faseId: "fase-5", nombre: "Instalaciones eléctricas, sanitarias y de agua", duracionDias: 60, avance: 0.2, responsable: "Electropar Ltda." },
  { faseId: "fase-6", nombre: "Terminaciones", duracionDias: 80, avance: 0.05, responsable: "Cuadrilla C" },
];

function tareasDesdeFases(): TareaCronograma[] {
  let cursor = INICIO;
  const porNombre = new Map<string, string[]>(); // faseId -> itemIds

  const faseDe = new Map<string, string>();
  for (const fase of FASES_PRESUPUESTO) {
    faseDe.set(fase.id, fase.id);
    porNombre.set(fase.id, fase.items.map((i) => i.id));
  }
  // Ítem de adenda cae en la fase de estructura.
  porNombre.set("fase-3", [...(porNombre.get("fase-3") ?? []), ITEM_ADENDA.id]);

  return POR_FASE.map((def, i) => {
    const inicio = cursor;
    const fin = sumarDias(inicio, def.duracionDias - 1);
    cursor = sumarDias(fin, 1);
    const tarea: TareaCronograma = {
      id: `tarea-${i + 1}`,
      faseId: def.faseId,
      nombre: def.nombre,
      inicio,
      fin,
      avance: def.avance,
      estado: def.avance >= 1 ? "FINALIZADA" : def.avance > 0 ? "EN_CURSO" : "PENDIENTE",
      responsable: def.responsable,
      itemIds: porNombre.get(def.faseId) ?? [],
      dependeDe: i > 0 ? [`tarea-${i}`] : [],
      critica: def.avance < 1,
    };
    return tarea;
  });
}

export const SEMILLA_CRONOGRAMA: DatosCronograma = {
  tareas: tareasDesdeFases(),
};

export function semillaCronograma(_obraId: string): DatosCronograma {
  return SEMILLA_CRONOGRAMA;
}