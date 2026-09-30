import { obtenerRubro, type Rubro } from "@/lib/data/precios";
import { itemDesdeRubro } from "@/lib/calculo";
import type { FasePresupuesto, ItemPresupuesto } from "@/lib/types";

/**
 * Presupuesto de demostración armado sobre la base de precios real.
 *
 * Las cantidades y el avance son ficticios —la base de precios no tiene datos
 * de ejecución— pero **todos los precios salen de `precios.ts`**, que viene de
 * las guías oficiales. Al cambiar la base, estos totales cambian solos.
 *
 * Cada rubro se referencia por su id `"CATEGORIA::Nombre"`. `rubroDe` falla
 * ruidosamente si el nombre no existe, para que un rename en la base no deje
 * partidas en cero silenciosamente.
 */
function rubroDe(id: string): Rubro {
  const r = obtenerRubro(id);
  if (!r) throw new Error(`Rubro inexistente en la base de precios: ${id}`);
  return r;
}

interface Partida {
  id: string;
  cantidad: number;
  cantidadEjecutada?: number;
  nota?: string;
  proveedor?: string;
  estado?: ItemPresupuesto["estado"];
}

function partida(id: string, p: Partida): ItemPresupuesto {
  return itemDesdeRubro(rubroDe(id), p.cantidad, {
    cantidadEjecutada: p.cantidadEjecutada,
    nota: p.nota,
    estado: p.estado,
  });
}

const DEFINICIONES: { nombre: string; partidas: [string, Partida][] }[] = [
  {
    nombre: "Demolición y movimiento de suelos",
    partidas: [
      [
        "DEMOLICIONES::Demolición muro 0.15m con recuperación",
        {
          id: "p1",
          cantidad: 180,
          cantidadEjecutada: 180,
          nota: "Ladrillo recuperado apilado en obra para reuso en cercos",
          estado: "EJECUTADO",
        },
      ],
      [
        "DEMOLICIONES::Demolición piso-revoques-revestimientos",
        { id: "p2", cantidad: 145, cantidadEjecutada: 145, estado: "EJECUTADO" },
      ],
      [
        "MOVIMIENTO DE SUELO::Excavación a máquina (m³)",
        {
          id: "p3",
          cantidad: 185,
          cantidadEjecutada: 185,
          nota: "Profundidad media 1,80 m en cimientos corridos",
          estado: "EJECUTADO",
        },
      ],
      [
        "MOVIMIENTO DE SUELO::Relleno con suelo seleccionado compactado",
        { id: "p4", cantidad: 62, cantidadEjecutada: 62, estado: "EJECUTADO" },
      ],
      [
        "MOVIMIENTO DE SUELO::Subbase de ripio compactado",
        { id: "p5", cantidad: 38, cantidadEjecutada: 22, estado: "EN_EJECUCION" },
      ],
    ],
  },
  {
    nombre: "Fundaciones",
    partidas: [
      [
        "FUNDACIONES::Cimiento H° Cascotes - Tierra Gorda",
        { id: "p6", cantidad: 96, cantidadEjecutada: 96, estado: "EJECUTADO" },
      ],
      [
        "FUNDACIONES::Hormigón Ciclópeo (1:3:6)",
        {
          id: "p7",
          cantidad: 42,
          cantidadEjecutada: 42,
          nota: "Cimiento de surfanci, piedra de río bolada",
          estado: "EJECUTADO",
        },
      ],
      [
        "ESTRUCTURAS::Encadenado 30x30 cm",
        { id: "p8", cantidad: 74, cantidadEjecutada: 74, estado: "EJECUTADO" },
      ],
    ],
  },
  {
    nombre: "Estructura de hormigón armado",
    partidas: [
      [
        "ESTRUCTURAS::Zapata fck=18 MPa",
        { id: "p9", cantidad: 28, cantidadEjecutada: 28, estado: "EJECUTADO" },
      ],
      [
        "ESTRUCTURAS::Columna fck=21 MPa",
        { id: "p10", cantidad: 19, cantidadEjecutada: 19, estado: "EJECUTADO" },
      ],
      [
        "ESTRUCTURAS::Viga fck=21 MPa",
        { id: "p11", cantidad: 54, cantidadEjecutada: 41, estado: "EN_EJECUCION" },
      ],
      [
        "ESTRUCTURAS::Losa fck=21MPa",
        {
          id: "p12",
          cantidad: 86,
          cantidadEjecutada: 58,
          nota: "Losa de piso intermedio y cubierta",
          estado: "EN_EJECUCION",
        },
      ],
    ],
  },
  {
    nombre: "Mampostería y tabiquería",
    partidas: [
      [
        "MAMPOSTERÍA::Elevación 0.15m ladrillo común",
        { id: "p13", cantidad: 310, cantidadEjecutada: 126, estado: "EN_EJECUCION" },
      ],
      [
        "MAMPOSTERÍA::Sardinel ladrillo común",
        { id: "p14", cantidad: 88, cantidadEjecutada: 34, estado: "EN_EJECUCION" },
      ],
      [
        "MAMPOSTERÍA::Nivelación 0.30m ladrillo común",
        { id: "p15", cantidad: 96, estado: "PENDIENTE" },
      ],
    ],
  },
  {
    nombre: "Instalaciones eléctricas, sanitaryas y de agua",
    partidas: [
      [
        "INSTALACIÓN ELÉCTRICA::Tablero principal 6 llaves TM",
        { id: "p16", cantidad: 1, cantidadEjecutada: 1, estado: "EJECUTADO" },
      ],
      [
        "INSTALACIÓN ELÉCTRICA::Lámpara con interruptor",
        { id: "p17", cantidad: 34, cantidadEjecutada: 12, estado: "EN_EJECUCION" },
      ],
      [
        "DESAGÜE CLOACAL::Caño PVC 100mm (desagüe)",
        { id: "p18", cantidad: 72, cantidadEjecutada: 28, estado: "EN_EJECUCION" },
      ],
      [
        "DESAGÜE CLOACAL::Cámara séptica 1.00x1.60x1.20m",
        {
          id: "p19",
          cantidad: 1,
          nota: "Ubicación según plano aprobado por el comitente",
          estado: "PENDIENTE",
        },
      ],
      [
        "AGUA CORRIENTE::Tanque cisterna fibra de vidrio 1000lt",
        { id: "p20", cantidad: 1, cantidadEjecutada: 1, estado: "EJECUTADO" },
      ],
      [
        "AGUA CORRIENTE::Instalación agua fría - baño completo",
        { id: "p21", cantidad: 2, estado: "PENDIENTE" },
      ],
    ],
  },
  {
    nombre: "Terminaciones",
    partidas: [
      ["PINTURAS::Látex interior con enduido", { id: "p22", cantidad: 420, estado: "PENDIENTE" }],
      ["PINTURAS::Látex exterior sin enduido", { id: "p23", cantidad: 185, estado: "PENDIENTE" }],
      [
        "CIELO RASOS::Cielo raso durlock estándar 9.5mm",
        { id: "p24", cantidad: 240, cantidadEjecutada: 18, estado: "EN_EJECUCION" },
      ],
    ],
  },
];

/**
 * Partida de adenda: los cambios de contrato no salen de la base de precios,
 * se cargan a mano. Ejercita el camino de ítems sin rubro.
 */
export const PARTIDA_ADENDA: ItemPresupuesto = {
  id: "ad-001",
  codigo: "AD-001",
  descripcion: "[Adenda 01] Refuerzo de losa para sala de máquinas",
  nota: "AD-001 — mayor sobrecarga por grupo electrógeno. Precio pactado con el comitente.",
  unidad: "gl",
  cantidad: 1,
  cantidadEjecutada: 1,
  precioMaterial: 3_500_000,
  precioManoObra: 2_100_000,
  adenda: "AD-001",
  estado: "APROBADO",
};

/** Índice de la fase de estructura, donde entra el refuerzo de la adenda. */
const FASE_ESTRUCTURA = 2;

export const FASES_PRESUPUESTO: FasePresupuesto[] = DEFINICIONES.map((f, i) => ({
  id: `fase-${i + 1}`,
  numero: i + 1,
  nombre: f.nombre,
  items:
    i === FASE_ESTRUCTURA
      ? [...f.partidas.map(([id, p]) => partida(id, p)), PARTIDA_ADENDA]
      : f.partidas.map(([id, p]) => partida(id, p)),
}));
