import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { OBRAS, semillaDe } from "@/dominio/semillas/obras";
import type { Obra } from "@/dominio/tipos";

/**
 * Obra activa.
 *
 * La selección se resuelve con esta precedencia:
 * 1. Parámetro `?obra=` en la URL (compartir enlaces entre módulos).
 * 2. `localStorage.puntero.ultimaObra` (la última que abrió el usuario).
 * 3. La primera obra semilla.
 */

interface ContextoObra {
  obra: Obra;
  obras: Obra[];
  cambiar: (id: string) => void;
}

const Ctx = createContext<ContextoObra | null>(null);

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

  const activa = useMemo(() => {
    const deUrl = searchParams.get("obra");
    if (deUrl && semillaDe(deUrl)) return deUrl;
    const deLocal = ultimaGuardada();
    if (deLocal && semillaDe(deLocal)) return deLocal;
    return OBRAS[0]!.id;
  }, [searchParams]);

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

  const obra = semillaDe(activa) ?? OBRAS[0]!;

  return <Ctx.Provider value={{ obra, obras: OBRAS, cambiar }}>{children}</Ctx.Provider>;
}

export function useObra(): ContextoObra {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useObra fuera del <ObraProvider>");
  return ctx;
}