"use client";

import { useEffect, useRef, useState } from "react";
import { useObra } from "@/components/obra-provider";
import { Icono } from "@/components/icono";
import { Chip } from "@/components/ui";
import type { EstadoObra, TipoObra } from "@/lib/types";

const ETIQUETA_ESTADO: Record<EstadoObra, { texto: string; tono: "exito" | "primario" | "neutro" | "error" }> = {
  EN_CURSO: { texto: "En curso", tono: "primario" },
  FINALIZADA: { texto: "Terminada", tono: "exito" },
  PLANIFICACION: { texto: "Planificada", tono: "neutro" },
  SUSPENDIDA: { texto: "Suspendida", tono: "error" },
};

const ETIQUETA_TIPO: Record<TipoObra, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
  REFORMA: "Reforma",
  INFRAESTRUCTURA: "Infraestructura",
};

export function SelectorObra() {
  const { obra, obras, cambiar, ids } = useObra();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cierra el menú al clickear afuera o al presionar Escape.
  useEffect(() => {
    if (!abierto) return;
    const click = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const estado = ETIQUETA_ESTADO[obra.estado];

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className="flex min-w-0 items-center gap-space-sm rounded border border-outline-variant bg-surface-container-lowest px-space-md py-1.5 text-left transition-colors hover:bg-surface-container"
      >
        <div className="min-w-0">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
            {obra.codigo} · {ETIQUETA_TIPO[obra.tipo]}
          </span>
          <span className="block truncate font-headline-sm text-headline-sm text-on-surface">
            {obra.nombre}
          </span>
        </div>
        <Chip tono={estado.tono}>{estado.texto}</Chip>
        <Icono name="expand_more" tamano="sm" className={abierto ? "rotate-180" : ""} />
      </button>

      {abierto ? (
        <div
          role="listbox"
          aria-label="Cambiar de obra"
          className="absolute left-0 z-30 mt-1 w-96 max-w-[90vw] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg"
        >
          <ul className="max-h-80 overflow-y-auto divide-y divide-surface-container-low">
            {obras.map((o) => {
              const e = ETIQUETA_ESTADO[o.estado];
              const activa = o.id === obra.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => {
                      cambiar(o.id);
                      setAbierto(false);
                    }}
                    className={`flex w-full flex-col gap-1 px-space-md py-3 text-left transition-colors ${
                      activa ? "bg-primary-container" : "hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-space-sm">
                      <span className="truncate font-headline-sm text-headline-sm text-on-surface">
                        {o.nombre}
                      </span>
                      <Chip tono={e.tono}>{e.texto}</Chip>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary">
                      {o.codigo} · {ETIQUETA_TIPO[o.tipo]} · {o.superficie.toLocaleString("es-PY")} m² ·
                      semana {o.semanaActual}/{o.semanasTotales}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {o.resumen}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {ids.length > obras.length ? (
            <p className="border-t border-surface-container-low bg-surface-container px-space-md py-2 font-label-sm text-label-sm text-secondary">
              {ids.length - obras.length} obra(s) guardada(s) sin datos semilla. Van a aparecer
              cuando tengan contenido.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
