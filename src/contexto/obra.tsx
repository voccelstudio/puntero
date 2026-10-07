import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  agregarAlIndice,
  leerObrasRegistradas,
  quitarObraLocal,
  escribirObrasRegistradas,
} from "@/dominio/almacen";
import { hoyIso, sumarDias } from "@/dominio/formato";
import { OBRAS } from "@/dominio/semillas/obras";
import type { Obra, TipoObra } from "@/dominio/tipos";

/**
 * Obra activa (y registro completo de proyectos).
 *
 * El catálogo arranca con las obras semilla y crece con las que crea el
 * usuario, persistidas en `puntero.v1.obras`. La selección de la obra activa
 * se resuelve con esta precedencia:
 * 1. Parámetro `?obra=` en la URL (compartir enlaces entre módulos).
 * 2. `localStorage.puntero.ultimaObra` (la última que abrió el usuario).
 * 3. La primera obra del catálogo.
 */

/** Campos del formulario de nueva obra. */
export interface EntradaObra {
  nombre: string;
  tipo: TipoObra;
  comitente: string;
  empConstructora: string;
  ubicacion: string;
  superficie: number;
  inicio: string;
  finEstimado: string;
}

interface ContextoObra {
  obra: Obra;
  obras: Obra[];
  cambiar: (id: string) => void;
  crearObra: (entrada: EntradaObra) => Obra;
  actualizarObra: (obra: Obra) => void;
  eliminarObra: (id: string) => void;
  esSemilla: (id: string) => boolean;
  obraPorId: (id: string) => Obra | undefined;
}

const Ctx = createContext<ContextoObra | null>(null);

const IDS_SEMILLA = ["los-alamos", "ypacarai", "sajonia"];

const CLAVE_ULTIMA = "puntero.v1.ultimaObra";

function ultimaGuardada(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_ULTIMA);
  } catch {
    return null;
  }
}

function guardarUltima(id: string): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMA, id);
  } catch {
    // Sin almacenamiento: la selección sigue viva en la URL.
  }
}

export function ObraProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [registradas, setRegistradas] = useState<Obra[]>(leerObrasRegistradas);

  // El catálogo = semillas + obras creadas, ordenando semillas primero.
  const obras = useMemo(() => {
    const mapa = new Map<string, Obra>();
    for (const o of OBRAS) mapa.set(o.id, o);
    for (const o of registradas) if (!mapa.has(o.id)) mapa.set(o.id, o);
    return [...mapa.values()];
  }, [registradas]);

  const obraPorId = useCallback(
    (id: string) => obras.find((o) => o.id === id),
    [obras],
  );

  // Restablecer a fábrica: vuelve a la semilla el registro de obras creadas.
  useEffect(() => {
    const alReset = () => setRegistradas(leerObrasRegistradas());
    window.addEventListener("puntero:reset", alReset);
    return () => window.removeEventListener("puntero:reset", alReset);
  }, []);

  const activa = useMemo(() => {
    const deUrl = searchParams.get("obra");
    if (deUrl && obraPorId(deUrl)) return deUrl;
    const deLocal = ultimaGuardada();
    if (deLocal && obraPorId(deLocal)) return deLocal;
    return obras[0]?.id ?? IDS_SEMILLA[0]!;
  }, [searchParams, obraPorId, obras]);

  // Cada vez que cambia la obra, se persiste para la próxima sesión.
  useEffect(() => {
    guardarUltima(activa);
  }, [activa]);

  const cambiar = useCallback(
    (id: string) => {
      setSearchParams({ obra: id }, { replace: true });
    },
    [setSearchParams],
  );

  const crearObra = useCallback(
    (entrada: EntradaObra): Obra => {
      const id = `obra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const anio = new Date().getFullYear();
      const nueva: Obra = {
        id,
        codigo: `OBR-${anio}-${String(obras.length + 1).padStart(3, "0")}`,
        nombre: entrada.nombre.trim() || "Obra sin nombre",
        tipo: entrada.tipo,
        estado: "PLANIFICACION",
        fase: "PREPARACION",
        empConstructora: entrada.empConstructora.trim() || "Voccel Studio Constructora",
        comitente: entrada.comitente.trim(),
        ubicacion: entrada.ubicacion.trim(),
        latitud: 0,
        longitud: 0,
        inicio: entrada.inicio || hoyIso(),
        finEstimado: entrada.finEstimado || sumarDias(hoyIso(), 180),
        superficie: entrada.superficie,
        monedaContrato: "PYG",
        resumen: "",
      };
      setRegistradas((previo) => {
        const siguiente = [...previo, nueva];
        escribirObrasRegistradas(siguiente);
        return siguiente;
      });
      agregarAlIndice(id);
      return nueva;
    },
    [obras],
  );

  const actualizarObra = useCallback((obra: Obra) => {
    setRegistradas((previo) => {
      const siguiente = previo.some((o) => o.id === obra.id)
        ? previo.map((o) => (o.id === obra.id ? obra : o))
        : [...previo, obra];
      escribirObrasRegistradas(siguiente);
      return siguiente;
    });
  }, []);

  const eliminarObra = useCallback(
    (id: string) => {
      setRegistradas((previo) => {
        const siguiente = previo.filter((o) => o.id !== id);
        escribirObrasRegistradas(siguiente);
        return siguiente;
      });
      quitarObraLocal(id);
      if (ultimaGuardada() === id) {
        try {
          window.localStorage.removeItem(CLAVE_ULTIMA);
        } catch {
          // Sin almacenamiento: nada que limpiar.
        }
      }
    },
    [],
  );

  const esSemilla = useCallback(
    (id: string) => IDS_SEMILLA.includes(id) || OBRAS.some((o) => o.id === id),
    [],
  );

  const obra = obraPorId(activa) ?? obras[0] ?? OBRAS[0]!;

  return (
    <Ctx.Provider
      value={{ obra, obras, cambiar, crearObra, actualizarObra, eliminarObra, esSemilla, obraPorId }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useObra(): ContextoObra {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useObra fuera del <ObraProvider>");
  return ctx;
}