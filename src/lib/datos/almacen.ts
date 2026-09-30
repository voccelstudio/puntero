/**
 * Persistencia en el navegador.
 *
 * La app se sirve como estático desde GitHub Pages: no hay servidor. Todo lo
 * que el usuario cargue o edite vive en `localStorage`, en su propio
 * navegador. Eso tiene dos consecuencias que la app asume de entrada:
 *
 * 1. Los datos NO se comparten entre dispositivos. Un celular y una compu
 *    tienen copias distintas. Por eso existe `exportarRespaldo`.
 * 2. El servidor de estáticos no puede leer nada: la primera pintura siempre
 *    sale con los datos semilla, y recién después del montaje en el cliente
 *    se reemplaza por lo guardado. Si se leyera `localStorage` durante el
 *    render, React se quejaría de que el HTML del servidor y el del cliente
 *    no coinciden (error de hidratación).
 *
 * La clave se versiona: `puntero.v1.<obra>.<coleccion>`. Si un día cambia la
 * forma de un dato, se sube la versión a `v2` y se migra desde la anterior, en
 * vez de romperle los datos guardados a alguien.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Súbelo cuando cambie la forma de un dato guardado. Ver `migrar`. */
export const VERSION = 1;

const RAIZ = "puntero";

/** Colecciones editables, una por módulo de la app. */
export type Coleccion = "comando" | "presupuesto" | "finanzas" | "materiales";

export const COLECCIONES: Coleccion[] = ["comando", "presupuesto", "finanzas", "materiales"];

function clave(obraId: string, coleccion: Coleccion): string {
  return `${RAIZ}.v${VERSION}.${obraId}.${coleccion}`;
}

function claveIndice(): string {
  return `${RAIZ}.v${VERSION}.__obras__`;
}

/**
 * `localStorage` es un almacén externo, no estado de React. Por eso la lectura
 * va con `useSyncExternalStore`: React se suscribe a los cambios y vuelve a
 * pintar solo, y además la primera pintura usa la semilla, así que el HTML del
 * servidor y el del cliente coinciden y no se rompe la hidratación.
 *
 * Un caché en memoria evita volver a hacer `JSON.parse` en cada render, y hace
 * que `getSnapshot` devuelva siempre la misma referencia: sin eso React
 * detectaría un cambio en cada lectura y entraría en un ciclo.
 */
const cache = new Map<string, unknown>();
const fallos = new Map<string, boolean>();
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

/** Suscripción vacía: sirve para leer un valor que nunca cambia en el cliente. */
function noSuscribir(): () => void {
  return () => {};
}

function siempreCierto(): boolean {
  return true;
}

/** El navegador es lo único que tiene los datos: en el servidor no existe. */
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
    // Modo privado sin cuota, o almacenamiento deshabilitado por el navegador.
    disponibilidad = false;
  }
  return disponibilidad;
}

interface Envoltura<T> {
  version: number;
  datos: T;
}

/**
 * Lee una colección. Devuelve la semilla si no hay nada guardado, si el
 * contenido está corrupto, o si el navegador no deja escribir.
 */
function leer<T>(obraId: string, coleccion: Coleccion, semilla: T): T {
  if (!disponible()) return semilla;
  try {
    const crudo = window.localStorage.getItem(clave(obraId, coleccion));
    if (!crudo) return semilla;
    const envoltura = JSON.parse(crudo) as Envoltura<T>;
    if (envoltura?.version !== VERSION) return migrar(envoltura, semilla);
    return envoltura.datos;
  } catch {
    // JSON inválido: se descarta en silencio y se vuelve a la semilla. Perder
    // la colección es preferible a dejar la pantalla en blanco.
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
    // Cuota llena. Se avisa desde la UI; acá no hay dónde propagar el error.
    fallos.set(k, true);
    return false;
  }
}

/**
 * Punto de enganche para futuras migraciones. Hoy no hay nada que migrar
 * porque la versión 1 es la primera, pero el lugar queda para que subir de
 * versión no rompa los datos de nadie.
 */
function migrar<T>(envoltura: Envoltura<T>, semilla: T): T {
  return semilla;
}

export interface EstadoColeccion<T> {
  /** Datos guardados, o la semilla hasta que se lee el almacenamiento. */
  datos: T;
  /** true cuando ya se leyó `localStorage`. Antes de eso, `datos` es la semilla. */
  listo: boolean;
  /** true si el almacenamiento rechazo la escritura (cuota, modo privado). */
  sinEspacio: boolean;
  /** Reemplaza el contenido. Acepta un valor o una función sobre el anterior. */
  guardar: (actualizar: T | ((previo: T) => T)) => void;
  /** Vuelve a los datos semilla y borra lo guardado de esta colección. */
  restablecer: () => void;
  /** Hay cambios del usuario sobre la semilla. */
  editado: boolean;
}

/**
 * Colección editable de una obra.
 *
 * Mientras `listo` es false, `datos` es la semilla, así que la primera
 * pintura -que Next.js genera en el servidor- coincide con lo que el cliente
 * va a renderizar. Recién después del montaje se reemplaza por lo guardado.
 */
export function useColeccion<T>(
  obraId: string,
  coleccion: Coleccion,
  semilla: T,
): EstadoColeccion<T> {
  const k = clave(obraId, coleccion);

  const leerCache = useCallback(() => {
    const guardado = cache.get(k);
    if (guardado !== undefined) return guardado as T;
    const valor = leer<T>(obraId, coleccion, semilla);
    cache.set(k, valor);
    return valor;
  }, [k, obraId, coleccion, semilla]);

  // En el servidor siempre la semilla: es lo único que existe ahí.
  const datosServidor = useCallback(() => semilla, [semilla]);

  const datos = useSyncExternalStore(suscribir, leerCache, datosServidor);
  // `listo` es false durante la hidratación y true apenas monta el cliente.
  const listo = useSyncExternalStore(
    noSuscribir,
    siempreCierto,
    () => false,
  );
  const sinEspacio = useSyncExternalStore(
    suscribir,
    () => fallos.get(k) ?? false,
    () => false,
  );

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

  return { datos, listo, sinEspacio, guardar, restablecer, editado };
}

/* ------------------------------------------------------------------ */
/* Índice de obras                                                      */
/* ------------------------------------------------------------------ */

/**
 * Las obras que el usuario tiene guardadas. Se guarda el índice aparte de las
 * colecciones para poder listarlas sin abrir cada obra.
 */
export function useIndiceObras(semilla: string[]): {
  ids: string[];
  listo: boolean;
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
          // Índice corrupto o vacío: se usa la semilla.
          if (Array.isArray(leido) && leido.length > 0) ids = leido;
        }
      } catch {
        // Índice corrupto: se usa la semilla.
      }
    }
    cache.set(claveIndice(), ids);
    return ids;
  }, [semilla]);

  const ids = useSyncExternalStore(
    suscribir,
    leerCache,
    useCallback(() => semilla, [semilla]),
  );
  const listo = useSyncExternalStore(noSuscribir, siempreCierto, () => false);

  const persistir = useCallback((siguiente: string[]) => {
    cache.set(claveIndice(), siguiente);
    if (disponible()) window.localStorage.setItem(claveIndice(), JSON.stringify(siguiente));
    notificar();
  }, []);

  return {
    ids,
    listo,
    agregar: useCallback(
      (id: string) => {
        if (!ids.includes(id)) persistir([...ids, id]);
      },
      [ids, persistir],
    ),
    quitar: useCallback(
      (id: string) => persistir(ids.filter((x) => x !== id)),
      [ids, persistir],
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

/**
 * Baja todo a un archivo JSON. Es la única forma de respaldar los datos, dado
 * que viven solo en este navegador.
 */
export function exportarRespaldo(): string {
  const respaldo: Respaldo = { version: VERSION, exportado: new Date().toISOString(), obras: {} };
  if (!disponible()) return JSON.stringify(respaldo, null, 2);

  for (const id of JSON.parse(window.localStorage.getItem(claveIndice()) ?? "[]") as string[]) {
    const porColeccion: Partial<Record<Coleccion, unknown>> = {};
    for (const coleccion of COLECCIONES) {
      const crudo = window.localStorage.getItem(clave(id, coleccion));
      if (crudo) porColeccion[coleccion] = JSON.parse(crudo);
    }
    respaldo.obras[id] = porColeccion;
  }
  return JSON.stringify(respaldo, null, 2);
}

export function importarRespaldo(texto: string): { ok: true; obras: number } | { ok: false; error: string } {
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
  if (!disponible()) {
    return { ok: false, error: "El navegador no permite guardar." };
  }

  const ids: string[] = [];
  for (const [id, porColeccion] of Object.entries(respaldo.obras)) {
    for (const [coleccion, envoltura] of Object.entries(porColeccion)) {
      if (!COLECCIONES.includes(coleccion as Coleccion)) continue;
      window.localStorage.setItem(clave(id, coleccion as Coleccion), JSON.stringify(envoltura));
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
}
