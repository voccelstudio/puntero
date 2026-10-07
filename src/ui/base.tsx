import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Kit de UI de Puntero. Componentes pequeños sobre los tokens de `index.css`.
 * Contrato del design system "Bauhaus / Material 3": superficies en capas,
 * acentos por roles (primario/terciario/error), radios mínimos y tipografía
 * ajustada.
 */

/* ------------------------------------------------------------------ */
/* Iconos de Material Symbols                                          */
/* ------------------------------------------------------------------ */

export function Icono({
  nombre,
  lleno = false,
  tamaño = 20,
  className = "",
}: {
  nombre: string;
  lleno?: boolean;
  tamaño?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: tamaño,
        fontVariationSettings: `'FILL' ${lleno ? 1 : 0}, 'wght' ${lleno ? 700 : 400}, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {nombre}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primario" | "secundario" | "fantasma" | "inverso" | "peligro";
  tamano?: "sm" | "md" | "lg";
  icono?: string;
}

const VARIANTES: Record<NonNullable<BotonProps["variante"]>, string> = {
  primario:
    "bg-primary text-on-primary border border-primary hover:opacity-90 font-label font-medium",
  secundario:
    "bg-primary-container text-on-primary-container border border-outline-variant hover:bg-surface-container-high font-label font-medium",
  fantasma:
    "bg-transparent text-on-surface border border-transparent hover:bg-surface-container font-label font-medium",
  inverso:
    "bg-inverse-surface text-inverse-on-surface border border-inverse-surface hover:bg-surface-container-high font-label font-medium",
  peligro:
    "bg-error-container text-on-error-container border border-error/40 hover:bg-surface-container-high font-label font-medium",
};

const TAMANOS: Record<NonNullable<BotonProps["tamano"]>, string> = {
  sm: "text-[0.75rem] px-2 py-1 gap-1 rounded-sm",
  md: "text-[0.875rem] px-3 py-2 gap-2 rounded-sm",
  lg: "text-[0.875rem] px-4 py-2.5 gap-2 rounded-md",
};

export function Boton({
  variante = "secundario",
  tamano = "md",
  icono,
  children,
  className = "",
  ...props
}: BotonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...props}
    >
      {icono && <Icono nombre={icono} tamaño={tamano === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Superficies                                                         */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const p = { none: "", sm: "p-3", md: "p-4", lg: "p-6" }[padding];
  return (
    <section
      className={`bg-surface border border-outline-variant rounded-md ${p} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardAcento({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`bg-primary-container text-on-primary-container border border-primary/40 rounded-md p-4 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  icono,
  titulo,
  descripcion,
  acciones,
}: {
  icono?: string;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {icono && (
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-sm bg-surface-container-high border border-outline-variant">
            <Icono nombre={icono} tamaño={20} />
          </span>
        )}
        <div>
          <h2 className="font-headline-md">{titulo}</h2>
          {descripcion && <p className="font-body-sm text-on-surface-variant">{descripcion}</p>}
        </div>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips y estados                                                     */
/* ------------------------------------------------------------------ */

type Tono = "neutro" | "primario" | "secundario" | "tertiary" | "exito" | "error" | "advertencia";

const TONOS: Record<Tono, string> = {
  neutro: "bg-surface-container-high text-on-surface-variant border border-outline-variant",
  primario: "bg-primary text-on-primary border border-primary",
  secundario: "bg-secondary-container text-on-secondary-container border border-secondary/30",
  tertiary: "bg-tertiary-container text-on-tertiary-container border border-tertiary/30",
  exito: "bg-ok-container text-on-surface border border-ok/40",
  error: "bg-error-container text-on-error-container border border-error/30",
  advertencia: "bg-primary-container text-on-primary-container border border-primary/50",
};

export function Chip({ tono = "neutro", children, className = "" }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-label-sm text-[0.6875rem] ${TONOS[tono]} ${className}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tablas                                                              */
/* ------------------------------------------------------------------ */

export function Tabla({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-md border border-outline-variant ${className}`}>
      <table className="w-full border-collapse bg-surface text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
  derecha = false,
}: {
  children?: ReactNode;
  className?: string;
  derecha?: boolean;
}) {
  return (
    <th
      className={`border-b border-outline-variant bg-surface-container-low px-3 py-2 font-label text-[0.6875rem] uppercase tracking-wider text-on-surface-variant ${
        derecha ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  derecha = false,
}: {
  children?: ReactNode;
  className?: string;
  derecha?: boolean;
}) {
  return (
    <td className={`border-b border-surface-variant px-3 py-2 align-top ${derecha ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Indicadores visuales                                                */
/* ------------------------------------------------------------------ */

export function Progress({ valor, className = "" }: { valor: number; className?: string }) {
  const v = Math.max(0, Math.min(1, valor));
  return (
    <div className={`h-1.5 w-full rounded-sm bg-surface-container-high overflow-hidden ${className}`}>
      <div className="h-full bg-primary rounded-sm" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Gauge({ valor, className = "" }: { valor: number; className?: string }) {
  const v = Math.max(0, Math.min(1, valor));
  const circunferencia = 2 * Math.PI * 34;
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-container-high)" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circunferencia}`}
        strokeDashoffset={circunferencia * (1 - v)}
        transform="rotate(-90 40 40)"
      />
    </svg>
  );
}

export function Kpi({
  etiqueta,
  valor,
  pie,
  icono,
  alerta = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  pie?: ReactNode;
  icono?: string;
  alerta?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden ${alerta ? "border-error/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-sm text-on-surface-variant">{etiqueta}</p>
          <p className="font-headline-lg mt-1 leading-tight">{valor}</p>
          {pie && <div className="font-body-sm text-on-surface-variant mt-1">{pie}</div>}
        </div>
        {icono && (
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-high border border-outline-variant shrink-0">
            <Icono nombre={icono} tamaño={18} />
          </span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  icono = "inbox",
  titulo,
  descripcion,
  accion,
}: {
  icono?: string;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-outline-variant p-8 text-center">
      <Icono nombre={icono} tamaño={32} className="opacity-50" />
      <p className="font-headline-sm">{titulo}</p>
      {descripcion && <p className="font-body-sm text-on-surface-variant max-w-sm">{descripcion}</p>}
      {accion}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  abierto,
  titulo,
  icono,
  children,
  tamano = "md",
  onClose,
}: {
  abierto: boolean;
  titulo: string;
  icono?: string;
  children: ReactNode;
  tamano?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alEscape);
    return () => document.removeEventListener("keydown", alEscape);
  }, [abierto, onClose]);

  if (!abierto) return null;
  const ancho = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[tamano];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8 no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className={`w-full ${ancho} rounded-md border border-outline-variant bg-surface`}>
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-4 py-3">
          <h3 className="font-headline-sm flex items-center gap-2">
            {icono && <Icono nombre={icono} tamaño={18} />}
            {titulo}
          </h3>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-surface-container cursor-pointer" aria-label="Cerrar">
            <Icono nombre="close" tamaño={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */

export function Campo({
  etiqueta,
  children,
  hint,
  className = "",
}: {
  etiqueta: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-label-sm">{etiqueta}</span>
      {children}
      {hint && <span className="font-body-sm text-on-surface-variant">{hint}</span>}
    </label>
  );
}

const INPUT_CLASE =
  "bg-surface-container-low border border-outline-variant rounded-sm px-2.5 py-1.5 font-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-tertiary outline-none w-full";

export function Texto({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={INPUT_CLASE} {...props} />;
}

export function Area({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${INPUT_CLASE} min-h-16`} {...props} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${INPUT_CLASE} cursor-pointer`} {...props}>
      {children}
    </select>
  );
}