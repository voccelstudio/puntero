import { itemDesdeRubro, numerarItems } from "@/dominio/calculo";
import { obtenerRubro, type Rubro } from "@/dominio/precios";
import type {
  Adenda,
  DatosPresupuesto,
  FasePresupuesto,
  ItemPresupuesto,
  VersionPresupuesto,
} from "@/dominio/tipos";

/**
 * Semilla de presupuesto armada sobre la base de precios real.
 *
 * Las cantidades y el avance son ficticios —la base no tiene datos de
 * ejecución— pero TODOS los precios salen de `precios.ts`, que viene de las
 * guías oficiales. Al cambiar la base, estos totales cambian solos.
 *
 * Cada rubro se referencia por su id `"CATEGORIA::Nombre"`; `rubroDe` falla
 * ruidosamente si el nombre no existe, para que un rename no deje partidas en
 * cero en silencio.
 */

function rubroDe(id: string): Rubro {
  const r = obtenerRubro(id);
  if (!r) throw new Error(`Rubro inexistente en la base de precios: ${id}`);
  return r;
}

interface Partida {
  cantidad: number;
  cantidadEjecutada?: number;
  nota?: string;
  proveedor?: string;
  estado?: ItemPresupuesto["estado"];
  adenda?: string;
}

function partida(id: string, p: Partida): ItemPresupuesto {
  return {
    ...itemDesdeRubro(rubroDe(id), p.cantidad, {
      cantidadEjecutada: p.cantidadEjecutada,
      nota: p.nota,
      estado: p.estado,
    }),
    id,
    proveedor: p.proveedor,
    adenda: p.adenda,
  };
}

interface Definicion {
  nombre: string;
  partidas: [string, Partida][];
}

const DEFINICIONES: Definicion[] = [
  {
    nombre: "Demolición y movimiento de suelos",
    partidas: [
      [
        "DEMOLICIONES::Demolición muro 0.15m con recuperación",
        {
          cantidad: 180,
          cantidadEjecutada: 180,
          nota: "Ladrillo recuperado apilado en obra para reuso en cercos",
          estado: "EJECUTADO",
        },
      ],
      [
        "DEMOLICIONES::Demolición piso-revoques-revestimientos",
        { cantidad: 145, cantidadEjecutada: 145, estado: "EJECUTADO" },
      ],
      [
        "MOVIMIENTO DE SUELO::Excavación a máquina (m³)",
        {
          cantidad: 185,
          cantidadEjecutada: 185,
          nota: "Profundidad media 1,80 m en cimientos corridos",
          estado: "EJECUTADO",
        },
      ],
      [
        "MOVIMIENTO DE SUELO::Relleno con suelo seleccionado compactado",
        { cantidad: 62, cantidadEjecutada: 62, estado: "EJECUTADO" },
      ],
      [
        "MOVIMIENTO DE SUELO::Subbase de ripio compactado",
        { cantidad: 38, cantidadEjecutada: 22, estado: "EN_EJECUCION" },
      ],
    ],
  },
  {
    nombre: "Fundaciones",
    partidas: [
      ["FUNDACIONES::Cimiento H° Cascotes - Tierra Gorda", { cantidad: 96, cantidadEjecutada: 96, estado: "EJECUTADO" }],
      [
        "FUNDACIONES::Hormigón Ciclópeo (1:3:6)",
        { cantidad: 42, cantidadEjecutada: 42, nota: "Cimiento de superficie, piedra de río bolada", estado: "EJECUTADO" },
      ],
      ["ESTRUCTURAS::Encadenado 30x30 cm", { cantidad: 74, cantidadEjecutada: 74, estado: "EJECUTADO" }],
    ],
  },
  {
    nombre: "Estructura de hormigón armado",
    partidas: [
      ["ESTRUCTURAS::Zapata fck=18 MPa", { cantidad: 28, cantidadEjecutada: 28, estado: "EJECUTADO" }],
      ["ESTRUCTURAS::Columna fck=21 MPa", { cantidad: 19, cantidadEjecutada: 19, estado: "EJECUTADO" }],
      ["ESTRUCTURAS::Viga fck=21 MPa", { cantidad: 54, cantidadEjecutada: 41, estado: "EN_EJECUCION" }],
      [
        "ESTRUCTURAS::Losa fck=21MPa",
        { cantidad: 86, cantidadEjecutada: 58, nota: "Losa de piso intermedio y cubierta", estado: "EN_EJECUCION" },
      ],
    ],
  },
  {
    nombre: "Mampostería y tabiquería",
    partidas: [
      ["MAMPOSTERÍA::Elevación 0.15m ladrillo común", { cantidad: 310, cantidadEjecutada: 126, estado: "EN_EJECUCION" }],
      ["MAMPOSTERÍA::Sardinel ladrillo común", { cantidad: 88, cantidadEjecutada: 34, estado: "EN_EJECUCION" }],
      ["MAMPOSTERÍA::Nivelación 0.30m ladrillo común", { cantidad: 96, estado: "PENDIENTE" }],
    ],
  },
  {
    nombre: "Instalaciones eléctricas, sanitarias y de agua",
    partidas: [
      ["INSTALACIÓN ELÉCTRICA::Tablero principal 6 llaves TM", { cantidad: 1, cantidadEjecutada: 1, estado: "EJECUTADO" }],
      ["INSTALACIÓN ELÉCTRICA::Lámpara con interruptor", { cantidad: 34, cantidadEjecutada: 12, estado: "EN_EJECUCION" }],
      ["DESAGÜE CLOACAL::Caño PVC 100mm (desagüe)", { cantidad: 72, cantidadEjecutada: 28, estado: "EN_EJECUCION" }],
      [
        "DESAGÜE CLOACAL::Cámara séptica 1.00x1.60x1.20m",
        { cantidad: 1, nota: "Ubicación según plano aprobado por el comitente", estado: "PENDIENTE" },
      ],
      ["AGUA CORRIENTE::Tanque cisterna fibra de vidrio 1000lt", { cantidad: 1, cantidadEjecutada: 1, estado: "EJECUTADO" }],
      ["AGUA CORRIENTE::Instalación agua fría - baño completo", { cantidad: 2, estado: "PENDIENTE" }],
    ],
  },
  {
    nombre: "Terminaciones",
    partidas: [
      ["PINTURAS::Látex interior con enduido", { cantidad: 420, estado: "PENDIENTE" }],
      ["PINTURAS::Látex exterior sin enduido", { cantidad: 185, estado: "PENDIENTE" }],
      ["CIELO RASOS::Cielo raso durlock estándar 9.5mm", { cantidad: 240, cantidadEjecutada: 18, estado: "EN_EJECUCION" }],
    ],
  },
];

const FASE_ESTRUCTURA = 2;

/** Ítem de adenda: los cambios de contrato no salen de la base, se cargan a mano. */
export const ITEM_ADENDA: ItemPresupuesto = {
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

export const FASES_PRESUPUESTO: FasePresupuesto[] = DEFINICIONES.map((f, i) => ({
  id: `fase-${i + 1}`,
  numero: i + 1,
  nombre: f.nombre,
  items: f.partidas.map(([id, p]) => partida(id, p)),
})).map((fase, i) =>
  i === FASE_ESTRUCTURA ? { ...fase, items: [...fase.items, ITEM_ADENDA] } : fase,
);

const VERSION_INICIAL: Omit<VersionPresupuesto, "id" | "fecha" | "etiqueta"> = {
  fases: FASES_PRESUPUESTO,
  adendas: [],
  parametros: {
    gastosGenerales: 0.08,
    beneficio: 0.15,
    honorarios: 0.07,
    descuento: 0,
    ivaMateriales: 0.1,
    ivaManoObra: 0.05,
    facturaIva: true,
  },
};

function versionInicial(etiqueta: string): VersionPresupuesto {
  return { id: "v0", fecha: new Date().toISOString(), etiqueta, ...VERSION_INICIAL };
}

const ADENDA_APROBADA: Adenda = {
  codigo: "AD-001",
  titulo: "Refuerzo de losa para sala de máquinas",
  descripcion: "Mayor sobrecarga por grupo electrógeno. Precio pactado con el comitente.",
  monto: 5_600_000,
  fecha: "2026-03-15",
  estado: "APROBADA",
  autorizadaPor: "Ing. R. Benítez",
};

export const SEMILLA_PRESUPUESTO_LOS_ALAMOS: DatosPresupuesto = {
  fases: FASES_PRESUPUESTO,
  adendas: [ADENDA_APROBADA],
  parametros: {
    gastosGenerales: 0.08,
    beneficio: 0.15,
    honorarios: 0.07,
    descuento: 0,
    ivaMateriales: 0.1,
    ivaManoObra: 0.05,
    facturaIva: true,
  },
  monedaContrato: "PYG",
  versiones: [
    versionInicial("Versión 0 — presupuesto base"),
    {
      id: "v1",
      fecha: "2026-03-20",
      etiqueta: "Versión 1 — aprobada + adenda 01",
      fases: FASES_PRESUPUESTO,
      adendas: [ADENDA_APROBADA],
      parametros: {
        gastosGenerales: 0.08,
        beneficio: 0.15,
        honorarios: 0.07,
        descuento: 0,
        ivaMateriales: 0.1,
        ivaManoObra: 0.05,
        facturaIva: true,
      },
    },
  ],
  // Se numera la versión visible de la semilla; las versiones guardadas se
  // preservan tal cual se capturaron.
};

export function semillaPresupuesto(obraId: string): DatosPresupuesto {
  if (obraId === "los-alamos") {
    return {
      ...SEMILLA_PRESUPUESTO_LOS_ALAMOS,
      fases: numerarItems(SEMILLA_PRESUPUESTO_LOS_ALAMOS.fases),
    };
  }
  if (obraId === "sajonia") {
    return {
      ...SEMILLA_PRESUPUESTO_LOS_ALAMOS,
      fases: numerarItems(SEMILLA_PRESUPUESTO_LOS_ALAMOS.fases),
    };
  }
  return {
    ...SEMILLA_PRESUPUESTO_LOS_ALAMOS,
    fases: numerarItems(SEMILLA_PRESUPUESTO_LOS_ALAMOS.fases),
  };
}

export const SEMILLA_PRESUPUESTO: DatosPresupuesto = semillaPresupuesto("los-alamos");