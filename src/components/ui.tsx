import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={`rounded-lg bg-surface-container-lowest shadow-sm print-break-avoid ${className}`}
    >
      {children}
    </As>
  );
}

/** Tarjeta con franja de acento superior, el patrón de KPI del diseño. */
const FRANJA_ACENTO = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  "primary-container": "bg-primary-container",
  "on-secondary-fixed": "bg-secondary-fixed",
} as const;

export function CardAcento({
  children,
  tono = "primary",
  className = "",
}: {
  children: ReactNode;
  tono?: keyof typeof FRANJA_ACENTO;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${FRANJA_ACENTO[tono]}`} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Encabezado de sección                                               */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  titulo,
  icono,
  acciones,
  className = "",
}: {
  titulo: string;
  icono?: ReactNode;
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low p-space-md ${className}`}
    >
      <div className="flex items-center gap-space-sm">
        {icono}
        <h2 className="font-headline-md text-on-surface">{titulo}</h2>
      </div>
      {acciones ? <div className="flex items-center gap-space-xs">{acciones}</div> : null}
    </div>
  );
}

/** Encabezado de sección sin fondo, para usar dentro de un card. */
export function CardTitle({
  titulo,
  icono,
  extra,
}: {
  titulo: string;
  icono?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-space-sm">
      <div className="flex items-center gap-space-sm">
        {icono}
        <span className="font-headline-sm text-on-surface">{titulo}</span>
      </div>
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Chip                                                        */
/* ------------------------------------------------------------------ */

type TonoChip =
  | "neutro"
  | "primario"
  | "tertiary"
  | "secondary"
  | "error"
  | "inverso"
  | "exito";

const CHIPS: Record<TonoChip, string> = {
  neutro: "bg-surface-container text-on-surface-variant",
  primario: "bg-primary/10 text-primary",
  tertiary: "bg-tertiary-container/30 text-on-tertiary-container",
  secondary: "bg-secondary-container text-on-secondary-container",
  error: "bg-error-container text-on-error-container",
  inverso: "bg-surface-container/20 text-inverse-on-surface",
  exito: "bg-primary-fixed text-on-primary-fixed",
};

export function Chip({
  children,
  tono = "neutro",
  className = "",
}: {
  children: ReactNode;
  tono?: TonoChip;
  className?: string;
}) {
  return (
    <span
      className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm ${CHIPS[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

export function Button({
  children,
  variante = "primario",
  tamano = "md",
  className = "",
  type = "button",
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  variante?: "primario" | "secundario" | "contorno" | "inverso" | "fantasma";
  tamano?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const variantes: Record<string, string> = {
    primario:
      "bg-primary text-on-primary hover:bg-primary-container font-headline-sm shadow-sm",
    secundario:
      "bg-surface-container text-on-surface hover:bg-surface-container-high font-body-sm",
    contorno:
      "border border-outline bg-surface-container-lowest text-on-surface hover:bg-surface-container font-body-sm",
    inverso:
      "bg-inverse-surface text-inverse-on-surface hover:bg-secondary font-label-md",
    fantasma: "text-secondary hover:text-on-surface font-label-sm",
  };

  const tamanos: Record<string, string> = {
    sm: "px-space-sm py-1 rounded",
    md: "px-space-md py-1.5 rounded",
    lg: "px-space-md py-2.5 rounded w-full justify-center",
  };

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${tamanos[tamano]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de progreso                                                   */
/* ------------------------------------------------------------------ */

const TONOS_BARRA: Record<string, string> = {
  primary: "bg-primary",
  tertiary: "bg-tertiary",
  secondary: "bg-secondary",
  error: "bg-error",
  primaryFixed: "bg-primary-container",
};

export function Progress({
  valor,
  tono = "primary",
  alto = "md",
  className = "",
}: {
  /** Progreso en 0..1. */
  valor: number;
  tono?: "primary" | "tertiary" | "secondary" | "error" | "primaryFixed";
  alto?: "sm" | "md" | "lg";
  className?: string;
}) {
  const alturas = { sm: "h-1", md: "h-1.5", lg: "h-2" };
  const pct = Math.max(0, Math.min(1, valor)) * 100;

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-surface-container ${alturas[alto]} ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${TONOS_BARRA[tono]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gauge radial                                                        */
/* ------------------------------------------------------------------ */

export function Gauge({
  valor,
  tamano = "md",
  color = "var(--primary)",
  children,
}: {
  /** Progreso en 0..1. */
  valor: number;
  tamano?: "sm" | "md" | "lg";
  color?: string;
  children?: ReactNode;
}) {
  const tamanos = { sm: "w-14 h-14", md: "w-20 h-20", lg: "w-24 h-24" };
  const grosor = { sm: 3.5, md: 4, lg: 4 };
  const dash = Math.max(0, Math.min(1, valor)) * 100;

  return (
    <div className={`relative flex shrink-0 items-center justify-center ${tamanos[tamano]}`}>
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 36 36"
        aria-hidden="true"
      >
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="var(--surface-container-high)"
          strokeWidth={grosor[tamano]}
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeDasharray={`${dash}, 100`}
          strokeLinecap="round"
          strokeWidth={grosor[tamano]}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI                                                                 */
/* ------------------------------------------------------------------ */

export function Kpi({
  etiqueta,
  valor,
  unidad,
  pie,
  variacion,
  icono,
  progreso,
  tonoTrafilla = "primary",
}: {
  etiqueta: string;
  valor: string;
  unidad?: string;
  pie?: string;
  /** Variación relativa; el signo se agrega automáticamente. */
  variacion?: number;
  icono?: ReactNode;
  progreso?: number;
  tonoTrafilla?: keyof typeof FRANJA_ACENTO;
}) {
  const positivo = (variacion ?? 0) >= 0;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-sm print-break-avoid">
      <div className={`absolute inset-x-0 top-0 h-1 ${FRANJA_ACENTO[tonoTrafilla]}`} />
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
            {etiqueta}
          </span>
          <div className="mt-space-xs flex items-baseline gap-space-xs">
            <span className="font-headline-xl text-on-surface">{valor}</span>
            {unidad ? (
              <span className="font-label-sm text-label-sm text-secondary">{unidad}</span>
            ) : null}
          </div>
          {variacion !== undefined ? (
            <span
              className={`mt-0.5 inline-flex items-center gap-0.5 font-label-sm text-label-sm font-semibold ${
                positivo ? "text-tertiary" : "text-secondary"
              }`}
            >
              {positivo ? "▲" : "▼"} {Math.abs(variacion * 100).toFixed(1)}%
            </span>
          ) : null}
          {pie ? (
            <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">
              {pie}
            </span>
          ) : null}
        </div>
        {icono ? <div className="shrink-0">{icono}</div> : null}
      </div>
      {progreso !== undefined ? (
        <Progress
          valor={progreso}
          tono={tonoTrafilla === "primary-container" ? "primaryFixed" : (tonoTrafilla as "primary" | "tertiary" | "secondary")}
          className="mt-space-md"
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabla                                                               */
/* ------------------------------------------------------------------ */

export function Tabla({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left font-body-sm text-body-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <th
      className={`px-space-md py-2 font-label-sm text-label-sm font-medium uppercase text-secondary ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-space-md py-2.5 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Estados vacíos                                                      */
/* ------------------------------------------------------------------ */

export function EmptyState({
  titulo,
  detalle,
  icono,
}: {
  titulo: string;
  detalle?: string;
  icono?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-space-xl text-center">
      {icono ? <div className="text-secondary">{icono}</div> : null}
      <span className="font-headline-sm text-on-surface-variant">{titulo}</span>
      {detalle ? (
        <span className="max-w-md font-body-sm text-body-sm text-secondary">{detalle}</span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metadata de pantalla                                                */
/* ------------------------------------------------------------------ */

export function MetaLine({ children }: { children: ReactNode }) {
  return (
    <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
      {children}
    </span>
  );
}
