import { useState } from "react";
import type { EntradaObra } from "@/contexto/obra";
import { FormObra } from "@/paginas/inicio/form-obra";
import { Boton, Card, Icono } from "@/ui/base";

/**
 * Pantalla de arranque cuando todavía no hay ninguna obra.
 *
 * Reemplaza a la app entera (no hay obra activa que mostrar) y ofrece crear la
 * primera. Al crearla, el proveedor de obras vuelve a renderizar el shell.
 */
export function PantallaBienvenida({ onCrear }: { onCrear: (entrada: EntradaObra) => void }) {
  const [abierto, setAbierto] = useState(true);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-on-primary">
          <Icono nombre="edit_square" tamaño={28} lleno />
        </span>
        <span className="leading-none">
          <span className="block font-headline-xl tracking-wide">PUNTERO</span>
          <span className="block font-label-sm tracking-[0.2em] text-on-surface-variant">
            GESTIÓN DE OBRA
          </span>
        </span>
      </div>

      <Card className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <Icono nombre="home_work" tamaño={32} className="opacity-60" />
        <p className="font-headline-md">Creá tu primera obra</p>
        <p className="font-body-sm text-on-surface-variant">
          Todo vive en este dispositivo: presupuesto, finanzas, cronograma y gente.
          Empezá cargando los datos de tu proyecto.
        </p>
        <Boton icono="add" onClick={() => setAbierto(true)}>
          Nueva obra
        </Boton>
      </Card>

      {abierto && <FormObra titulo="Nueva obra" onCerrar={() => setAbierto(false)} onGuardar={onCrear} />}
    </div>
  );
}
