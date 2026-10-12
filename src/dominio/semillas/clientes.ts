import type { Cliente } from "@/dominio/tipos";

/** Referencia estable: evita recrear el array en cada render. */
const VACIO: Cliente[] = [];

/** Clientes del dispositivo. El registro arranca vacío (no hay datos dummy). */
export function semillaClientes(): Cliente[] {
  return VACIO;
}
