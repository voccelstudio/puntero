/**
 * Operaciones de edición sobre `DatosPresupuesto`. Cada función es pura:
 * devuelve un nuevo `DatosPresupuesto` que el hook `guardar` persiste.
 * Todas las mutaciones de fases pasan por `numerarItems`, así los códigos
 * jerárquicos (1, 1.1, 1.2, ...) nunca quedan desincronizados.
 */

import { numerarItems } from "@/dominio/calculo";
import type {
  Adenda,
  DatosPresupuesto,
  FasePresupuesto,
  ItemPresupuesto,
  ParametrosFinancieros,
  VersionPresupuesto,
} from "@/dominio/tipos";

export function patchItem(
  datos: DatosPresupuesto,
  faseId: string,
  itemId: string,
  patch: Partial<ItemPresupuesto>,
): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems(
      datos.fases.map((fase) =>
        fase.id === faseId
          ? {
              ...fase,
              items: fase.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : fase,
      ),
    ),
  };
}

export function addItem(
  datos: DatosPresupuesto,
  faseId: string,
  item: ItemPresupuesto,
): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems(
      datos.fases.map((fase) =>
        fase.id === faseId ? { ...fase, items: [...fase.items, item] } : fase,
      ),
    ),
  };
}

export function removeItem(
  datos: DatosPresupuesto,
  faseId: string,
  itemId: string,
): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems(
      datos.fases.map((fase) =>
        fase.id === faseId
          ? { ...fase, items: fase.items.filter((item) => item.id !== itemId) }
          : fase,
      ),
    ),
  };
}

export function patchFase(
  datos: DatosPresupuesto,
  faseId: string,
  patch: Partial<FasePresupuesto>,
): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems(
      datos.fases.map((fase) => (fase.id === faseId ? { ...fase, ...patch } : fase)),
    ),
  };
}

export function addFase(datos: DatosPresupuesto, nombre: string): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems([
      ...datos.fases,
      { id: `fase-${Date.now().toString(36)}`, numero: datos.fases.length + 1, nombre, items: [] },
    ]),
  };
}

export function removeFase(datos: DatosPresupuesto, faseId: string): DatosPresupuesto {
  return {
    ...datos,
    fases: numerarItems(datos.fases.filter((fase) => fase.id !== faseId)),
  };
}

export function patchParametros(
  datos: DatosPresupuesto,
  patch: Partial<ParametrosFinancieros>,
): DatosPresupuesto {
  return { ...datos, parametros: { ...datos.parametros, ...patch } };
}

/* ------------------------------------------------------------------ */
/* Adendas                                                             */
/* ------------------------------------------------------------------ */

export function addAdenda(
  datos: DatosPresupuesto,
  adenda: Omit<Adenda, "codigo"> & { codigo?: string },
): DatosPresupuesto {
  const numero = datos.adendas.length + 1;
  const codigo = adenda.codigo ?? `AD-${String(numero).padStart(2, "0")}`;
  return { ...datos, adendas: [...datos.adendas, { ...adenda, codigo }] };
}

export function updateAdenda(
  datos: DatosPresupuesto,
  codigo: string,
  patch: Partial<Adenda>,
): DatosPresupuesto {
  return {
    ...datos,
    adendas: datos.adendas.map((a) => (a.codigo === codigo ? { ...a, ...patch } : a)),
  };
}

export function removeAdenda(datos: DatosPresupuesto, codigo: string): DatosPresupuesto {
  return {
    ...datos,
    adendas: datos.adendas.filter((a) => a.codigo !== codigo),
    fases: numerarItems(
      datos.fases.map((fase) => ({
        ...fase,
        items: fase.items.filter((item) => item.adenda !== codigo),
      })),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Versiones                                                           */
/* ------------------------------------------------------------------ */

export function addVersion(datos: DatosPresupuesto, etiqueta: string): DatosPresupuesto {
  const version: VersionPresupuesto = {
    id: `v-${Date.now().toString(36)}`,
    fecha: new Date().toISOString(),
    etiqueta,
    fases: datos.fases,
    parametros: datos.parametros,
    adendas: datos.adendas,
  };
  return { ...datos, versiones: [...datos.versiones, version] };
}

export function restoreVersion(
  datos: DatosPresupuesto,
  version: VersionPresupuesto,
): DatosPresupuesto {
  return {
    ...datos,
    fases: version.fases,
    parametros: version.parametros,
    adendas: version.adendas,
  };
}

export function removeVersion(
  datos: DatosPresupuesto,
  versionId: string,
): DatosPresupuesto {
  return { ...datos, versiones: datos.versiones.filter((v) => v.id !== versionId) };
}