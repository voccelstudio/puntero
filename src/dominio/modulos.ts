/**
 * Registro de módulos de la app. Cada módulo vive en su ruta y pertenece a un
 * grupo del menú. `disponible` indica si ya está construido o es placeholder.
 */

export interface Modulo {
  ruta: string;
  etiqueta: string;
  icono: string;
  grupo: "Resumen" | "Contratación" | "Ejecución" | "Recursos";
  disponible: boolean;
}

export const MODULOS: Modulo[] = [
  { ruta: "/", etiqueta: "Comando", icono: "pace", grupo: "Resumen", disponible: false },
  { ruta: "/presupuesto", etiqueta: "Presupuesto", icono: "receipt_long", grupo: "Contratación", disponible: true },
  { ruta: "/finanzas", etiqueta: "Finanzas", icono: "account_balance", grupo: "Contratación", disponible: true },
  { ruta: "/cronograma", etiqueta: "Cronograma", icono: "calendar_month", grupo: "Ejecución", disponible: true },
  { ruta: "/gente", etiqueta: "Gente", icono: "groups", grupo: "Ejecución", disponible: true },
];

export const GRUPOS_NOMBRE: Modulo["grupo"][] = ["Resumen", "Contratación", "Ejecución", "Recursos"];