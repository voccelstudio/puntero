/**
 * Persistencia en el navegador.
 *
 * La app es un estático sin servidor: todo lo que el usuario cargue o edite
 * vive en `localStorage`, en su propio navegador. Consecuencias asumidas:
 *
 * 1. Los datos NO se comparten entre dispositivos. Por eso existe
 *    `exportarRespaldo` / `importarRespaldo`.
 * 2. Las colecciones están versionadas (`puntero.v1.<obra>.<coleccion>`). Si
 *    un día cambia la forma de un dato se sube `VERSION` y se migra desde la
 *    anterior en lugar de romper lo guardado.
 *
 * El acceso va por `useSyncExternalStore`: los datos son un almacén externo,
 * no estado de React. Un caché en memoria evita re-parsear en cada render y
 * hace que `getSnapshot` devuelva siempre la misma referencia.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Coleccion } from "@/dominio/tipos";

export const VERSION = 1;

const RAIZ = "puntero";

function clave(obraId: string, coleccion: Coleccion): string {
  return `${RAIZ}.v${VERSION}.${obraId}.${coleccion}`;
}

function claveIndice(): string {
  return `${RAIZ}.v${VERSION}.__obras__`;
}

const cache = new Map<string, unknown>();
const fallos = new Set<string>();
const suscriptores = new Set<() => void>();

function notificar(): void {
  cache.clear();
  for (const fn of suscriptores) fn();
}

function suscribir(fn: () => void): () => void {
  suscriptores.add(fn);
  return () => {
    suscriptores.delete(fn);
  };
}

let disponibilidad: boolean | null = null;

function disponible(): boolean {
  if (disponibilidad !== null) return disponibilidad;
  if (typeof window === "undefined") return (disponibilidad = false);
  try {
    const k = "__puntero_prueba__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    disponibilidad = true;
  } catch {
    disponibilidad = false;
  }
  return disponibilidad;
}

interface Envoltura<T> {
  version: number;
  datos: T;
}

function leer<T>(obraId: string, coleccion: Coleccion, semilla: T): T {
  if (!disponible()) return semilla;
  try {
    const crudo = window.localStorage.getItem(clave(obraId, coleccion));
    if (!crudo) return semilla;
    const envoltura = JSON.parse(crudo) as Envoltura<T>;
    if (envoltura?.version !== VERSION) return semilla;
    return envoltura.datos as T;
  } catch {
    // JSON inválido: se vuelve a la semilla antes que dejar la pantalla en blanco.
    return semilla;
  }
}

function escribir<T>(obraId: string, coleccion: Coleccion, datos: T): boolean {
  const k = clave(obraId, coleccion);
  if (!disponible()) return false;
  try {
    const envoltura: Envoltura<T> = { version: VERSION, datos };
    window.localStorage.setItem(k, JSON.stringify(envoltura));
    fallos.delete(k);
    return true;
  } catch {
    fallos.add(k);
    return false;
  }
}

export interface EstadoColeccion<T> {
  datos: T;
  listo: boolean;
  sinEspacio: boolean;
  guardar: (actualizar: T | ((previo: T) => T)) => void;
  restablecer: () => void;
  editado: boolean;
}

/** Colección editable de una obra, sincronizada con `localStorage`. */
export function useColeccion<T>(obraId: string, coleccion: Coleccion, semilla: T): EstadoColeccion<T> {
  const k = clave(obraId, coleccion);

  const leerCache = useCallback(() => {
    const guardado = cache.get(k);
    if (guardado !== undefined) return guardado as T;
    const valor = leer<T>(obraId, coleccion, semilla);
    cache.set(k, valor);
    return valor;
  }, [k, obraId, coleccion, semilla]);

  const datos = useSyncExternalStore(suscribir, leerCache);

  const sinEspacio = useSyncExternalStore(suscribir, () => fallos.has(k));

  const guardar = useCallback(
    (actualizar: T | ((previo: T) => T)) => {
      const previo = (cache.get(k) as T | undefined) ?? leer<T>(obraId, coleccion, semilla);
      const siguiente =
        typeof actualizar === "function"
          ? (actualizar as (p: T) => T)(previo)
          : actualizar;
      cache.set(k, siguiente);
      escribir(obraId, coleccion, siguiente);
      notificar();
    },
    [k, obraId, coleccion, semilla],
  );

  const restablecer = useCallback(() => {
    cache.set(k, semilla);
    fallos.delete(k);
    if (disponible()) window.localStorage.removeItem(k);
    notificar();
  }, [k, semilla]);

  const editado = useMemo(
    () => JSON.stringify(datos) !== JSON.stringify(semilla),
    [datos, semilla],
  );

  // Marca la colección como tocada apenas monta el componente que la consume,
  // matando el estado "editado" heredado de la semilla.
  useEffect(() => {
    if (disponible()) notificar();
  }, []);

  return { datos, listo: true, sinEspacio, guardar, restablecer, editado };
}

/* ------------------------------------------------------------------ */
/* Índice de obras                                                      */
/* ------------------------------------------------------------------ */

export function useIndiceObras(semilla: string[]): {
  ids: string[];
  agregar: (id: string) => void;
  quitar: (id: string) => void;
} {
  const leerCache = useCallback(() => {
    const guardado = cache.get(claveIndice());
    if (guardado !== undefined) return guardado as string[];
    let ids = semilla;
    if (disponible()) {
      try {
        const crudo = window.localStorage.getItem(claveIndice());
        if (crudo) {
          const leido = JSON.parse(crudo);
          if (Array.isArray(leido) && leido.length > 0) ids = leido;
        }
      } catch {
        // Índice corrupto: se usa la semilla.
      }
    }
    cache.set(claveIndice(), ids);
    return ids;
  }, [semilla]);

  const ids = useSyncExternalStore(suscribir, leerCache);

  const persistir = useCallback((siguiente: string[]) => {
    cache.set(claveIndice(), siguiente);
    if (disponible()) window.localStorage.setItem(claveIndice(), JSON.stringify(siguiente));
    notificar();
  }, []);

  return {
    ids,
    agregar: useCallback((id: string) => {
      const actual = (cache.get(claveIndice()) as string[] | undefined) ?? semilla;
      if (!actual.includes(id)) persistir([...actual, id]);
    }, [persistir, semilla]),
    quitar: useCallback(
      (id: string) => {
        const actual = (cache.get(claveIndice()) as string[] | undefined) ?? semilla;
        persistir(actual.filter((x) => x !== id));
      },
      [persistir, semilla],
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Respaldo en archivo                                                  */
/* ------------------------------------------------------------------ */

export interface Respaldo {
  version: number;
  exportado: string;
  obras: Record<string, Partial<Record<Coleccion, unknown>>>;
}

/** Baja todo a JSON. Es la única forma de respaldar, dado que todo vive local. */
export function exportarRespaldo(): string {
  const respaldo: Respaldo = { version: VERSION, exportado: new Date().toISOString(), obras: {} };
  if (!disponible()) return JSON.stringify(respaldo, null, 2);

  const leido = JSON.parse(window.localStorage.getItem(claveIndice()) ?? "[]") as string[];
  for (const id of leido) {
    const porColeccion: Partial<Record<Coleccion, unknown>> = {};
    for (const coleccion of ["presupuesto", "cronograma", "finanzas", "gente"] as Coleccion[]) {
      const crudo = window.localStorage.getItem(clave(id, coleccion));
      if (crudo) porColeccion[coleccion] = JSON.parse(crudo);
    }
    respaldo.obras[id] = porColeccion;
  }
  return JSON.stringify(respaldo, null, 2);
}

export function importarRespaldo(
  texto: string,
): { ok: true; obras: number } | { ok: false; error: string } {
  let respaldo: Respaldo;
  try {
    respaldo = JSON.parse(texto);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (respaldo?.version !== VERSION) {
    return {
      ok: false,
      error: `El respaldo es de la versión ${respaldo?.version} y esta app usa la ${VERSION}.`,
    };
  }
  if (!respaldo.obras || typeof respaldo.obras !== "object") {
    return { ok: false, error: "El respaldo no tiene obras." };
  }
  if (!disponible()) return { ok: false, error: "El navegador no permite guardar." };

  const ids: string[] = [];
  for (const [id, porColeccion] of Object.entries(respaldo.obras)) {
    for (const [coleccion, envoltura] of Object.entries(porColeccion)) {
      if (!["presupuesto", "cronograma", "finanzas", "gente"].includes(coleccion)) continue;
      window.localStorage.setItem(
        clave(id, coleccion as Coleccion),
        JSON.stringify(envoltura),
      );
    }
    ids.push(id);
  }
  window.localStorage.setItem(claveIndice(), JSON.stringify(ids));
  return { ok: true, obras: ids.length };
}

/** Borra todo lo guardado y vuelve al estado de fábrica. */
export function borrarTodo(): void {
  if (!disponible()) return;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(`${RAIZ}.`)) window.localStorage.removeItem(k);
  }
  notificar();
}