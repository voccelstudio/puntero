"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMoneda } from "@/components/moneda-provider";
import { Icono } from "@/components/icono";
import { formatGs } from "@/lib/format";

const NAVEGACION = [
  {
    href: "/",
    label: "Centro de comando",
    corto: "Comando",
    icon: "dashboard",
  },
  {
    href: "/presupuesto",
    label: "Constructor de presupuestos",
    corto: "Presupuesto",
    icon: "functions",
  },
  {
    href: "/finanzas",
    label: "Finanzas, caja y jornales",
    corto: "Finanzas",
    icon: "account_balance",
  },
  {
    href: "/materiales",
    label: "Materiales y pedidos",
    corto: "Materiales",
    icon: "inventory",
  },
] as const;

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
      <span
        className="px-1 font-label-sm text-label-sm text-secondary"
        title={fuente}
      >
        {estimada ? "~" : ""}
        {formatGs(tipoCambio)} / US$
      </span>
    </div>
  );
}

export function AppShell({
  children,
  obraNombre,
  obraCodigo,
  semana,
  semanasTotales,
}: {
  children: React.ReactNode;
  obraNombre: string;
  obraCodigo: string;
  semana: number;
  semanasTotales: number;
}) {
  const pathname = usePathname();
  const avance = Math.round((semana / semanasTotales) * 100);

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
          <div className="min-w-0">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
              {obraCodigo}
            </span>
            <h1 className="truncate font-headline-sm text-on-surface">{obraNombre}</h1>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-secondary">
              Semana {semana} / {semanasTotales}
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

      {/* Navegación */}
      <nav
        className="no-print sticky top-0 z-20 border-b border-outline-variant bg-surface-container-low px-gutter-desktop"
        aria-label="Módulos"
      >
        <ul className="-mx-1 flex gap-1 overflow-x-auto py-1">
          {NAVEGACION.map((item) => {
            const activo = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={activo ? "page" : undefined}
                  className={`flex items-center gap-2 rounded px-space-md py-2 whitespace-nowrap transition-colors ${
                    activo
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <Icono name={item.icon} tamano="sm" />
                  <span className="hidden font-headline-sm text-headline-sm sm:inline">
                    {item.label}
                  </span>
                  <span className="font-label-sm text-label-sm sm:hidden">{item.corto}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="px-gutter-desktop py-space-lg">{children}</main>
    </div>
  );
}
