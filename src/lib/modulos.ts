/**
 * Los módulos de la app, en un solo lugar.
 *
 * La navegación y cualquier chequeo de "módulo existente" leen de acá, para
 * que agregar una pantalla sea agregar una entrada y nada más. Los módulos
 * que todavía no existen no se listan: un link que da 404 es peor que un
 * módulo ausente.
 */

export type GrupoModulo = "Resumen" | "Contratación" | "Ejecución" | "Recursos";

export interface Modulo {
  href: string;
  etiqueta: string;
  corto: string;
  icono: string;
  grupo: GrupoModulo;
}

export const MODULOS: Modulo[] = [
  {
    href: "/",
    etiqueta: "Centro de comando",
    corto: "Comando",
    icono: "dashboard",
    grupo: "Resumen",
  },
  {
    href: "/presupuesto",
    etiqueta: "Presupuesto",
    corto: "Presupuesto",
    icono: "functions",
    grupo: "Contratación",
  },
  {
    href: "/finanzas",
    etiqueta: "Finanzas y jornales",
    corto: "Finanzas",
    icono: "account_balance",
    grupo: "Contratación",
  },
  {
    href: "/materiales",
    etiqueta: "Materiales y pedidos",
    corto: "Materiales",
    icono: "inventory",
    grupo: "Ejecución",
  },
];

export const GRUPOS: GrupoModulo[] = ["Resumen", "Contratación", "Ejecución", "Recursos"];

export function modulosPorGrupo() {
  return GRUPOS.map((grupo) => ({
    grupo,
    modulos: MODULOS.filter((m) => m.grupo === grupo),
  })).filter((g) => g.modulos.length > 0);
}
