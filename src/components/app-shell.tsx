"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMoneda } from "@/components/moneda-provider";
import { useObra } from "@/components/obra-provider";
import { SelectorObra } from "@/components/selector-obra";
import { Icono } from "@/components/icono";
import { modulosPorGrupo } from "@/lib/modulos";
import { formatGs } from "@/lib/format";

function SelectorMoneda() {
  const { moneda, setMoneda, tipoCambio, estimada, fuente } = useMoneda();

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center rounded bg-surface-container p-0.5"
        role="group"
        aria-label="Moneda de presentación"
      >
        {(["PYG", "USD"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMoneda(m)}
            aria-pressed={moneda === m}
            className={`rounded px-space-sm py-1 font-label-sm text-label-sm transition-colors ${
              moneda === m
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-secondary hover:text-on-surface"
            }`}
          >
            {m === "PYG" ? "Gs." : "US$"}
          </button>
        ))}
      </div>
      <span className="px-1 font-label-sm text-label-sm text-secondary" title={fuente}>
        {estimada ? "~" : ""}
        {formatGs(tipoCambio)} / US$
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { obra } = useObra();

  const grupos = modulosPorGrupo();
  const avance =
    obra.semanasTotales > 0
      ? Math.round((obra.semanaActual / obra.semanasTotales) * 100)
      : 0;

  return (
    <div className="min-h-dvh">
      {/* Barra superior */}
      <header className="border-b-2 border-outline bg-surface-container-low">
        <div className="flex flex-wrap items-center justify-between gap-space-sm bg-inverse-surface px-gutter-desktop py-space-sm text-inverse-on-surface">
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-md text-primary-fixed">PUNTERO</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-surface-dim">
              Gestión de obra
            </span>
          </div>
          <div className="no-print">
            <SelectorMoneda />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-space-sm px-gutter-desktop py-space-sm">
          <div className="min-w-0 flex-1">
            <SelectorObra />
            <p className="mt-1 truncate font-body-sm text-body-sm text-secondary">
              {obra.ubicacion} · {obra.empConstructora}
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-secondary">
              Semana {obra.semanaActual} / {obra.semanasTotales}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary" style={{ width: `${avance}%` }} />
            </div>
            <span className="font-label-md text-label-md font-semibold text-primary">
              {avance}%
            </span>
          </div>
        </div>
      </header>

      {/* Navegación horizontal, agrupada */}
      <nav
        className="no-print sticky top-0 z-20 border-b border-outline-variant bg-surface-container-low"
        aria-label="Módulos"
      >
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 px-gutter-desktop py-1">
          {grupos.map(({ grupo, modulos }, indice) => (
            <li key={grupo} className="flex items-center gap-1">
              <span className="px-1 font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                {grupo}
              </span>
              {modulos.map((item) => {
                const activo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?obra=${obra.id}`}
                    aria-current={activo ? "page" : undefined}
                    title={item.etiqueta}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded px-space-sm py-1.5 transition-colors ${
                      activo
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    }`}
                  >
                    <Icono name={item.icono} tamano="sm" />
                    <span className="font-headline-sm text-headline-sm">{item.corto}</span>
                  </Link>
                );
              })}
              {indice < grupos.length - 1 ? (
                <span aria-hidden className="ml-1 text-outline">
                  |
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>

      <main className="px-gutter-desktop py-space-lg">{children}</main>
    </div>
  );
}
