import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Temas visuales (doce): definidos por bloques `data-tema` en `src/index.css`.
 * El tema activo se aplica como `data-tema` en el <html> y se persiste local.
 */

export interface Tema {
  id: string;
  nombre: string;
  icono: string;
}

export const TEMAS: Tema[] = [
  { id: "constructor-dark", nombre: "Constructor Dark", icono: "dark_mode" },
  { id: "obra-de-dia", nombre: "Obra de Día", icono: "wb_sunny" },
  { id: "cemento", nombre: "Cemento", icono: "apartment" },
  { id: "ladrillo", nombre: "Ladrillo", icono: "brick" },
  { id: "yacare", nombre: "Yacaré", icono: "eco" },
  { id: "boveda", nombre: "Bóveda", icono: "auto_awesome" },
  { id: "ipa", nombre: "IPA", icono: "flare" },
  { id: "papel-de-obra", nombre: "Papel de Obra", icono: "description" },
  { id: "acero", nombre: "Acero", icono: "construction" },
  { id: "arena", nombre: "Arena", icono: "beach_access" },
  { id: "yerba", nombre: "Yerba", icono: "grass" },
  { id: "blanca-plano", nombre: "Blanca Plano", icono: "architecture" },
];

interface ContextoTema {
  tema: Tema;
  setTema: (id: string) => void;
}

const Ctx = createContext<ContextoTema | null>(null);

const CLAVE_TEMA = "puntero.v1.tema";

function temaGuardado(): string {
  try {
    return window.localStorage.getItem(CLAVE_TEMA) ?? "constructor-dark";
  } catch {
    return "constructor-dark";
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [temaId, setTemaId] = useState<string>(temaGuardado);

  useEffect(() => {
    document.documentElement.dataset.tema = temaId;
    const nombre = TEMAS.find((t) => t.id === temaId)?.nombre ?? temaId;
    document.title = `${nombre} — Puntero 5.0`;
    try {
      window.localStorage.setItem(CLAVE_TEMA, temaId);
    } catch {
      // Sin almacenamiento: el tema rige solo esta sesión.
    }
  }, [temaId]);

  const tema = TEMAS.find((t) => t.id === temaId) ?? TEMAS[0]!;

  return <Ctx.Provider value={{ tema, setTema: setTemaId }}>{children}</Ctx.Provider>;
}

export function useTema(): ContextoTema {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTema fuera del <TemaProvider>");
  return ctx;
}