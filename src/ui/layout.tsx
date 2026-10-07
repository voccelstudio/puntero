import { useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useObra } from "@/contexto/obra";
import { useMoneda } from "@/contexto/moneda";
import { TEMAS, useTema } from "@/contexto/tema";
import { GRUPOS_NOMBRE, MODULOS } from "@/dominio/modulos";
import { borrarTodo, exportarRespaldo, importarRespaldo } from "@/dominio/almacen";
import { diasEntre, formatFecha } from "@/dominio/formato";
import { Boton, Chip, Icono, Modal } from "@/ui/base";

const ETIQUETA_FASE: Record<string, string> = {
  PREPARACION: "Preparación",
  ESTRUCTURA: "Estructura",
  INSTALACIONES: "Instalaciones",
  TERMINACIONES: "Terminaciones",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICACION: "Planificación",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  SUSPENDIDA: "Suspendida",
};

export function Shell() {
  return (
    <div className="min-h-screen bg-background">
      <Cabecera />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}

function Cabecera() {
  const { obra, obras, cambiar } = useObra();
  const { moneda, setMoneda, cotizacionEstimada } = useMoneda();
  const { tema, setTema } = useTema();
  const [ajustes, setAjustes] = useState(false);

  const dias = diasEntre(new Date().toISOString().slice(0, 10), obra.finEstimado);

  const modulosPorGrupo = GRUPOS_NOMBRE.map((grupo) => ({
    grupo,
    modulos: MODULOS.filter((m) => m.grupo === grupo),
  })).filter((g) => g.modulos.length > 0);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/95 backdrop-blur no-print">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-on-primary">
                <Icono nombre="edit_square" tamaño={20} lleno />
              </span>
              <span className="leading-none">
                <span className="block font-headline-md tracking-wide">PUNTERO</span>
                <span className="block font-label-sm tracking-[0.2em] text-on-surface-variant">
                  GESTIÓN DE OBRA
                </span>
              </span>
            </NavLink>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setMoneda(moneda === "PYG" ? "USD" : "PYG")}
                className="flex items-center gap-1 rounded-sm border border-outline-variant bg-surface-container-low px-2 py-1.5 font-label-sm hover:bg-surface-container cursor-pointer"
                title={
                  cotizacionEstimada
                    ? "Cotización de referencia (respaldo local) — no oficial"
                    : "Cotización del día — referencia, no oficial"
                }
              >
                <Icono nombre="currency_exchange" tamaño={16} />
                {moneda === "PYG" ? "Gs." : "US$"}
              </button>

              <select
                value={obra.id}
                onChange={(e) => cambiar(e.target.value)}
                className="hidden sm:block max-w-52 bg-surface-container-low border border-outline-variant rounded-sm px-2 py-1.5 font-label-sm cursor-pointer"
                aria-label="Obra activa"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} — {o.nombre}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const actual = TEMAS.findIndex((t) => t.id === tema.id);
                  setTema(TEMAS[(actual + 1) % TEMAS.length]!.id);
                }}
                className="flex items-center gap-1 rounded-sm border border-outline-variant bg-surface-container-low px-2 py-1.5 font-label-sm hover:bg-surface-container cursor-pointer"
                title="Cambiar tema"
              >
                <Icono nombre={tema.icono} tamaño={16} />
                <span className="hidden sm:inline">{tema.nombre}</span>
              </button>

              <button
                onClick={() => setAjustes(true)}
                className="flex items-center rounded-sm border border-outline-variant bg-surface-container-low px-2 py-1.5 hover:bg-surface-container cursor-pointer"
                aria-label="Más opciones"
              >
                <Icono nombre="more_vert" tamaño={18} />
              </button>
            </div>
          </div>

          {/* Fila de contexto de obra */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline-variant py-2">
            <span className="font-label-sm font-medium">{obra.codigo}</span>
            <span className="font-headline-sm truncate">{obra.nombre}</span>
            <span className="hidden md:inline font-body-sm text-on-surface-variant truncate">
              {obra.ubicacion}
            </span>
            <Chip tono="primario">{ETIQUETA_FASE[obra.fase]}</Chip>
            <Chip>{ETIQUETA_ESTADO[obra.estado]}</Chip>
            <span className="hidden lg:inline font-body-sm text-on-surface-variant">
              {formatFecha(obra.inicio)} → {formatFecha(obra.finEstimado)}
            </span>
            {dias >= 0 && (
              <span
                className={`font-body-sm ${dias <= 30 ? "text-error" : "text-on-surface-variant"}`}
              >
                {dias} días restantes
              </span>
            )}
          </div>

          {/* Navegación */}
          <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mb-px" aria-label="Módulos">
            {modulosPorGrupo.map(({ grupo, modulos }) => (
              <div key={grupo} className="flex items-center gap-0.5">
                <span className="px-2 font-label-sm uppercase tracking-wider text-on-surface-variant">
                  {grupo}
                </span>
                {modulos.map((m) => (
                  <NavLink
                    key={m.ruta}
                    to={m.ruta}
                    end={m.ruta === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1.5 font-label-md ${
                        isActive
                          ? "bg-primary text-on-primary"
                          : "hover:bg-surface-container text-on-surface"
                      }`
                    }
                  >
                    <Icono nombre={m.icono} tamaño={16} />
                    {m.etiqueta}
                    {!m.disponible && (
                      <span className="opacity-60" title="En construcción">
                        ·
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </header>

      {ajustes && <AjustesModal alCerrar={() => setAjustes(false)} />}
    </>
  );
}

function AjustesModal({ alCerrar }: { alCerrar: () => void }) {
  const { obra } = useObra();
  const { moneda, pygPorUsd, fuenteCotizacion } = useMoneda();
  const { tema, setTema } = useTema();
  const archivoRef = useRef<HTMLInputElement>(null);

  const descargarRespaldo = () => {
    const blob = new Blob([exportarRespaldo()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `puntero-respaldo-${obra.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal abierto titulo="Ajustes" icono="settings" onClose={alCerrar} tamano="sm">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-label-sm mb-2">Tema visual</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTema(t.id)}
                className={`flex items-center gap-2 rounded-sm border px-2.5 py-2 font-label-md cursor-pointer ${
                  tema.id === t.id
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <Icono nombre={t.icono} tamaño={16} />
                {t.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-outline-variant bg-surface-container-low p-3">
          <p className="font-label-sm">
            Cotización: 1 USD = Gs. {Math.round(pygPorUsd).toLocaleString("es-PY")}
          </p>
          <p className="font-body-sm text-on-surface-variant mt-1">{fuenteCotizacion} · {moneda}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Boton variante="secundario" icono="download" onClick={descargarRespaldo}>
            Descargar respaldo JSON
          </Boton>
          <Boton variante="secundario" icono="upload" onClick={() => archivoRef.current?.click()}>
            Importar respaldo
          </Boton>
          <div className="flex flex-col gap-2 border-t border-outline-variant pt-2">
            <Boton
              variante="peligro"
              icono="restart_alt"
              onClick={() => {
                if (
                  confirm("¿Restablecer todos los datos a fábrica? Se pierden los cambios locales.")
                ) {
                  borrarTodo();
                  alCerrar();
                }
              }}
            >
              Restablecer a fábrica
            </Boton>
          </div>
        </div>
      </div>

      <input
        ref={archivoRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          file.text().then((texto) => {
            const resultado = importarRespaldo(texto);
            alert(
              resultado.ok
                ? `Respaldo restaurado: ${resultado.obras} obra(s).`
                : `No se pudo restaurar: ${resultado.error}`,
            );
            alCerrar();
          });
          e.target.value = "";
        }}
      />
    </Modal>
  );
}