import { numerarItems } from "@/dominio/calculo";
import type { DatosPresupuesto, ItemPresupuesto } from "@/dominio/tipos";

/**
 * Incorpora ítems (computados rápido o del catálogo) al presupuesto de una
 * obra. Si ya existe una fase con la categoría del rubro, los inserta ahí;
 * si no, crea la fase. Devuelve un presupuesto nuevo con códigos renumerados.
 */
export function agregarItemsAlPresupuesto(
  datos: DatosPresupuesto,
  nuevos: ItemPresupuesto[],
): DatosPresupuesto {
  const fases = datos.fases.map((f) => ({
    ...f,
    items: f.items.map((i) => ({ ...i })),
  }));

  for (const item of nuevos) {
    const categoria = item.rubroCategoria ?? "Personalizados";
    const nombre = categoria.charAt(0) + categoria.slice(1).toLowerCase();
    let fase = fases.find((f) => f.id === categoria);
    if (!fase) {
      fase = { id: categoria, numero: fases.length + 1, nombre, items: [] };
      fases.push(fase);
    }
    fase.items.push({ ...item, codigo: "" });
  }

  return { ...datos, fases: numerarItems(fases) };
}