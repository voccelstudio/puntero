import type { DatosGente } from "@/dominio/tipos";

/** Contratistas y clientes semilla. En producción estos nacen de la base de
 *  clientes del usuario, pero arrancar con dos cada uno hace visible el flujo. */
export const SEMILLA_GENTE: DatosGente = {
  contratistas: [
    {
      id: "con-1",
      nombre: "Mario Ortiz",
      empresa: "Constructora Ortiz",
      especialidad: "Albañilería y terminaciones",
      telefono: "+595 981 234 567",
      ips: "12345678-9",
      categoriaIps: "Riesgo 3",
      ruc: "80034567-1",
      rating: 4.5,
      comentarios: [
        {
          id: "c-1",
          fecha: "2026-08-22",
          estrellas: 5,
          texto: "Entrega en plazo y orden en obra. Muy buena mano de obra.",
        },
        {
          id: "c-2",
          fecha: "2026-06-14",
          estrellas: 4,
          texto: "Detalle menor de terminación, corregido en el día.",
        },
      ],
      enListaNegra: false,
      personal: [
        { id: "p-1", nombre: "Félix Cantero", ci: "5.555.555", oficio: "Albañil" },
        { id: "p-2", nombre: "José Irala", ci: "6.666.666", oficio: "Media caña" },
      ],
    },
    {
      id: "con-2",
      nombre: "Electropar Ltda.",
      empresa: "Electropar Ltda.",
      especialidad: "Instalaciones eléctricas",
      telefono: "+595 21 445 566",
      ips: "87654321-0",
      categoriaIps: "Riesgo 4",
      ruc: "80045678-2",
      rating: 3,
      comentarios: [],
      enListaNegra: false,
      personal: [],
    },
  ],
  clientes: [
    {
      id: "cli-1",
      nombre: "Inmobiliaria Guaraní S.A.",
      telefono: "+595 21 200 300",
      email: "obras@guarani.com.py",
      direccion: "Av. Mariscal López 1270, Asunción",
      ruc: "80012345-6",
      nota: "Comitente de Los Álamos Torre B.",
    },
    {
      id: "cli-2",
      nombre: "Familia Benítez Sosa",
      telefono: "+595 981 100 200",
      direccion: "San Bernardino, Ruta 2 km 32",
      nota: "Casa Ypacaraí, ya entregada.",
    },
  ],
};

export function semillaGente(_obraId: string): DatosGente {
  return SEMILLA_GENTE;
}