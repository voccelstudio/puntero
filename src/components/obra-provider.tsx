"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { IDS_SEMILLA, OBRAS, obraPorId, semillaDe, type SemillaObra } from "@/lib/data/obras";
import { useIndiceObras } from "@/lib/datos/almacen";
import type { Obra } from "@/lib/types";

const CLAVE_ULTIMA = "puntero.ultimaObra";

/* ------------------------------------------------------------------ */
/* La obra elegida, como almacén externo                               */
/* ------------------------------------------------------------------ */

/**
 * La obra activa sale de tres lugares, en este orden: lo que el usuario acabá
 * de elegir en esta sesión, el parámetro `?obra=` de la URL y la última obra
 * guardada. Vive en un almacén externo -y no en `useState`- porque el valor
 * inicial depende de `window`: leerlo en el estado inicial haría que el HTML
 * del servidor y el del cliente no coincidan y la hidratación fallara.
 * `useSyncExternalStore` resuelve justo eso: en el servidor devuelve `null`, y
 * recién en el cliente devuelve la preferencia real.
 *
 * Acá no se usa `useSearchParams` a propósito:Next.js vuelve a renderizar en el
 * cliente toda la rama que cuelgue de él, y como el provider envuelve todo el
 * dashboard, las cuatro páginas dejarían de pre-renderizarse y el HTML
 * estático de GitHub Pages vendría vacío. Leyendo `window.location` y
 * escribiendo con `history.replaceState` -que el router de Next intercepta-
 * se conserva el prerender y el enlace compartible.
 */
let eleccion: string | null = null;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const fn of oyentes) fn();
}

function oir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

function noOir(): () => void {
  return () => {};
}

function leerPreferencia(): string | null {
  if (eleccion) return eleccion;
  if (typeof window === "undefined") return null;
  const deUrl = new URLSearchParams(window.location.search).get("obra");
  if (deUrl) return deUrl;
  try {
    return window.localStorage.getItem(CLAVE_ULTIMA);
  } catch {
    // Modo privado: la selección dura lo que dura la URL.
    return null;
  }
}

/* ------------------------------------------------------------------ */

interface ContextoObra {
  obra: Obra;
  obras: Obra[];
  /** Cambia la obra activa y la deja reflejada en la URL. */
  cambiar: (id: string) => void;
  /** Datos semilla de la obra activa, para sembrar las colecciones. */
  semilla: SemillaObra;
  /** Índice de obras guardado en el navegador, que puede ser mayor que `obras`. */
  ids: string[];
  agregar: (obra: Obra) => void;
  quitar: (id: string) => void;
  /** false hasta que se leyó la URL y el almacenamiento. */
  listo: boolean;
}

const Contexto = createContext<ContextoObra | null>(null);

export function useObra(): ContextoObra {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useObra() se usa fuera de <ObraProvider>");
  return ctx;
}

export function ObraProvider({ children }: { children: React.ReactNode }) {
  const { ids, agregar: agregarId, quitar: quitarId } = useIndiceObras(IDS_SEMILLA);

  const preferencia = useSyncExternalStore(oir, leerPreferencia, () => null);
  const listo = useSyncExternalStore(
    noOir,
    () => true,
    () => false,
  );

  // La preferencia manda, pero solo si es una obra que existe: un enlace con un
  // id viejo o inventado cae en la primera disponible en vez de romper.
  const obraId = useMemo(() => {
    const valida = (id: string | null | undefined): id is string =>
      !!id && (ids.includes(id) || OBRAS.some((o) => o.id === id));
    if (valida(preferencia)) return preferencia;
    return ids[0] ?? OBRAS[0].id;
  }, [preferencia, ids]);

  const cambiar = useCallback((id: string) => {
    eleccion = id;
    avisar();
    try {
      window.localStorage.setItem(CLAVE_ULTIMA, id);
    } catch {
      // Sin almacenamiento la selección dura lo que la sesión.
    }
    // La obra viaja en la URL para que el enlace se pueda compartir. Se usa
    // `replace` y no `push` para no llenar el historial de la misma obra.
    const url = new URL(window.location.href);
    url.searchParams.set("obra", id);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const agregar = useCallback(
    (nueva: Obra) => {
      if (!ids.includes(nueva.id)) agregarId(nueva.id);
    },
    [ids, agregarId],
  );

  const valor = useMemo<ContextoObra>(
    () => ({
      obra: obraPorId(obraId),
      obras: OBRAS.filter((o) => ids.includes(o.id)),
      cambiar,
      semilla: semillaDe(obraId),
      ids,
      agregar,
      quitar: quitarId,
      listo,
    }),
    [obraId, ids, cambiar, agregar, quitarId, listo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
