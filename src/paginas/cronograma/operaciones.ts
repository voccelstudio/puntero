/**
 * Operaciones puras sobre `DatosCronograma`.
 */

import type { DatosCronograma, TareaCronograma } from "@/dominio/tipos";

export function addTarea(datos: DatosCronograma, tarea: TareaCronograma): DatosCronograma {
  return { ...datos, tareas: [...datos.tareas, tarea] };
}

export function patchTarea(
  datos: DatosCronograma,
  id: string,
  patch: Partial<TareaCronograma>,
): DatosCronograma {
  return {
    ...datos,
    tareas: datos.tareas.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

export function removeTarea(datos: DatosCronograma, id: string): DatosCronograma {
  return {
    ...datos,
    tareas: datos.tareas
      .filter((t) => t.id !== id)
      .map((t) =>
        t.dependeDe.includes(id)
          ? { ...t, dependeDe: t.dependeDe.filter((d) => d !== id) }
          : t,
      ),
  };
}

/** Marca una dependencia hacia adelante: `tareaId` pasa a depender de `deQuien`. */
export function agregarDependencia(
  datos: DatosCronograma,
  tareaId: string,
  deQuien: string,
): DatosCronograma {
  return patchTarea(datos, tareaId, {
    dependeDe: Array.from(new Set([...tareaActual(datos, tareaId).dependeDe, deQuien])),
  });
}

function tareaActual(datos: DatosCronograma, id: string): TareaCronograma {
  const t = datos.tareas.find((x) => x.id === id);
  if (!t) throw new Error(`Tarea ${id} no encontrada`);
  return t;
}