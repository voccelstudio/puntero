/**
 * Las obras de la app y sus datos de arranque.
 *
 * Los precios NO están escritos acá: las partidas se arman llamando a la base
 * de 399 rubros con `presupuestoDesdeRubros`, así que un cambio de precio en
 * la base se refleja solo en las tres obras. Solo se escriben las cantidades,
 * que son propias de cada obra.
 *
 * `rubroDe` falla ruidosamente si un nombre no existe en la base. Es a
 * propósito: si alguien renombra un rubro, queremos que se rompa el build y
 * no que aparezca una partida en cero sin avisar.
 */

import { obtenerRubro, type Rubro } from "@/lib/data/precios";
import { itemDesdeRubro } from "@/lib/calculo";
import type {
  DatosComando,
  DatosFinanzas,
  DatosMateriales,
  DatosPresupuesto,
  FasePresupuesto,
  ItemPresupuesto,
  Obra,
  ParametrosFinancieros,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

export function rubroDe(nombre: string): Rubro {
  const r = obtenerRubro(nombre);
  if (!r) {
    throw new Error(
      `El rubro "${nombre}" no existe en la base de precios. Si se renombró, actualizá la semilla de obras.`,
    );
  }
  return r;
}

interface Seleccion {
  rubro: string;
  cantidad: number;
  estado?: ItemPresupuesto["estado"];
  ejecutado?: number;
  nota?: string;
}

function fasesDesde(grupos: { nombre: string; items: Seleccion[] }[]): FasePresupuesto[] {
  return grupos.map((g, i) => ({
    id: `f-${i + 1}`,
    numero: i + 1,
    nombre: g.nombre,
    items: g.items.map((s) =>
      itemDesdeRubro(rubroDe(s.rubro), s.cantidad, {
        estado: s.estado,
        cantidadEjecutada: s.ejecutado,
        nota: s.nota,
      }),
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Las tres obras                                                       */
/* ------------------------------------------------------------------ */

export const OBRAS: Obra[] = [
  {
    id: "los-alamos",
    codigo: "OBR-2024-017",
    nombre: "Residencial Los Álamos — Torre B",
    tipo: "RESIDENCIAL",
    estado: "EN_CURSO",
    fase: "ESTRUCTURA",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Inmobiliaria Guaraní S.A.",
    ubicacion: "Av. Eusebio Ayala km 4, Asunción",
    latitud: -25.2637,
    longitud: -57.5759,
    inicio: "2026-02-16",
    finEstimado: "2026-11-27",
    superficie: 1840,
    monedaContrato: "PYG",
    semanaActual: 27,
    semanasTotales: 41,
    resumen: "Torre de 8 niveles, estructura terminada y passing a instalaciones.",
  },
  {
    id: "ypacarai",
    codigo: "OBR-2023-004",
    nombre: "Casa Ypacaraí",
    tipo: "RESIDENCIAL",
    estado: "FINALIZADA",
    fase: "TERMINACIONES",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Familia Benítez Sosa",
    ubicacion: "San Bernardino, Ruta 2 km 32",
    latitud: -25.2833,
    longitud: -57.6333,
    inicio: "2023-06-05",
    finEstimado: "2023-12-15",
    superficie: 120,
    monedaContrato: "PYG",
    semanaActual: 28,
    semanasTotales: 28,
    resumen: "Casa de una planta, entregada y habitada. Cerrada a costo real.",
  },
  {
    id: "sajonia",
    codigo: "OBR-2026-002",
    nombre: "Reforma Comercial Sajonia",
    tipo: "REFORMA",
    estado: "EN_CURSO",
    fase: "PREPARACION",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Cámara de Comercio de Asunción",
    ubicacion: "Calle Sajonia 1234, Asunción",
    latitud: -25.2841,
    longitud: -57.6119,
    inicio: "2026-08-03",
    finEstimado: "2026-10-30",
    superficie: 85,
    monedaContrato: "PYG",
    semanaActual: 5,
    semanasTotales: 13,
    resumen: "Reconversión de galpón en local gastronómico. En demolición y obra gruesa.",
  },
];

export const OBRA_POR_DEFECTO = OBRAS[0];

/* ------------------------------------------------------------------ */
/* Colecciones por obra                                                  */
/* ------------------------------------------------------------------ */

/** Los datos semilla de una obra tienen la misma forma que lo que se guarda. */
export interface SemillaObra {
  presupuesto: DatosPresupuesto;
  materiales: DatosMateriales;
  finanzas: DatosFinanzas;
  comando: DatosComando;
}

/* Los datos ricos de Los Álamos ya existen como módulos y se reutilizan tal
 * cual, para no duplicar 600 líneas ni tener dos fuentes de la verdad. */
import {
  ADENDAS,
  CERTIFICADOS,
  COMPUTO,
  CONTROLES_EPP,
  CUADRILLAS,
  ENTRADAS_BITACORA,
  HITOS,
  ORDENES_TRABAJO,
  PARAMETROS_FINANCIEROS,
} from "@/lib/data/obra";
import { FASES_PRESUPUESTO } from "@/lib/data/presupuesto-base";
import { ACOPIOS, DOCUMENTOS, PEDIDOS, PRECIOS_REFERENCIA } from "@/lib/data/materiales";
import {
  FLUJO_SEMANAL,
  LIQUIDACIONES_JORNAL,
  MOVIMIENTOS_CAJA,
  SUBCONTRATOS,
} from "@/lib/data/finanzas";

const PARAMETROS_PLANTA: ParametrosFinancieros = {
  gastosGenerales: 0.08,
  beneficio: 0.15,
  ivaMateriales: 0.1,
  ivaManoObra: 0.05,
};

/* ------------------------------------------------------------------ */
/* Los Álamos — se reutilizan los módulos existentes                   */
/* ------------------------------------------------------------------ */

const losAlamos: SemillaObra = {
  presupuesto: {
    fases: FASES_PRESUPUESTO,
    adendas: ADENDAS,
    parametros: PARAMETROS_FINANCIEROS,
    monedaContrato: "PYG",
  },
  materiales: {
    pedidos: PEDIDOS,
    preciosReferencia: PRECIOS_REFERENCIA,
    documentos: DOCUMENTOS,
    acopios: ACOPIOS,
  },
  finanzas: {
    movimientos: MOVIMIENTOS_CAJA,
    jornaleros: LIQUIDACIONES_JORNAL,
    subcontratos: SUBCONTRATOS,
    flujo: FLUJO_SEMANAL,
    certificados: CERTIFICADOS,
  },
  comando: {
    hitos: HITOS,
    ordenesTrabajo: ORDENES_TRABAJO,
    bitacora: ENTRADAS_BITACORA,
    cuadrillas: CUADRILLAS,
    computo: COMPUTO,
    controlesEPP: CONTROLES_EPP,
  },
};

/* ------------------------------------------------------------------ */
/* Casa Ypacaraí — una planta, terminada                               */
/* ------------------------------------------------------------------ */

const TERMINADO = "EJECUTADO" as const;

const ypacaraiPresupuesto: DatosPresupuesto = {
  monedaContrato: "PYG",
  parametros: PARAMETROS_PLANTA,
  adendas: [],
  fases: fasesDesde([
    {
      nombre: "Obra gruesa",
      items: [
        { rubro: "MOVIMIENTO DE SUELO::Excavación manual (m³)", cantidad: 38, estado: TERMINADO, ejecutado: 38 },
        { rubro: "MOVIMIENTO DE SUELO::Relleno con suelo seleccionado compactado", cantidad: 30, estado: TERMINADO, ejecutado: 30 },
        { rubro: "MAMPOSTERÍA::Nivelación 0.30m ladrillo común", cantidad: 120, estado: TERMINADO, ejecutado: 120 },
        { rubro: "MAMPOSTERÍA::Elevación 0.15m ladrillo común", cantidad: 268, estado: TERMINADO, ejecutado: 268 },
        { rubro: "CERCOS PERIMETRALES::Muro ladrillo común 0.15m h=2.00m revocado", cantidad: 42, estado: TERMINADO, ejecutado: 42 },
      ],
    },
    {
      nombre: "Pisos y revestimientos",
      items: [
        { rubro: "CONTRAPISOS::Contrapiso 7cm cascotes (1/4:1:4:6)", cantidad: 120, estado: TERMINADO, ejecutado: 120 },
        { rubro: "PISOS::Porcelanato 60x60cm", cantidad: 120, estado: TERMINADO, ejecutado: 120 },
        { rubro: "VEREDAS Y ACCESOS::Vereda hormigón alisado 7cm s/ malla", cantidad: 64, estado: TERMINADO, ejecutado: 64 },
      ],
    },
    {
      nombre: "Cubierta y cielos",
      items: [
        { rubro: "TECHOS::Chapa fibrocemento ondulada 6mm", cantidad: 104, estado: TERMINADO, ejecutado: 104 },
        { rubro: "CIELO RASOS::Cielo raso durlock estándar 9.5mm", cantidad: 96, estado: TERMINADO, ejecutado: 96 },
        { rubro: "TABIQUES DURLOCK::Tabique durlock 9.5mm estándar (sin aislante)", cantidad: 44, estado: TERMINADO, ejecutado: 44 },
      ],
    },
    {
      nombre: "Revoques y pinturas",
      items: [
        { rubro: "REVOQUES::Revoque 1 capa 1.5cm hidrófugo (1:4:16)", cantidad: 262, estado: TERMINADO, ejecutado: 262 },
        { rubro: "PINTURAS::Látex interior con enduido", cantidad: 262, estado: TERMINADO, ejecutado: 262 },
        { rubro: "PINTURAS::Látex exterior con enduido", cantidad: 184, estado: TERMINADO, ejecutado: 184 },
      ],
    },
    {
      nombre: "Artefactos e instalaciones",
      items: [
        { rubro: "ARTEFACTOS SANITARIOS::Baño completo frío y caliente (sin bañera)", cantidad: 1, estado: TERMINADO, ejecutado: 1 },
        { rubro: "ARTEFACTOS SANITARIOS::Baño social standard", cantidad: 1, estado: TERMINADO, ejecutado: 1 },
        { rubro: "AGUA CORRIENTE::Instalación agua fría - baño completo", cantidad: 2, estado: TERMINADO, ejecutado: 2 },
        { rubro: "INSTALACIÓN ELÉCTRICA::Tablero principal 6 llaves TM", cantidad: 1, estado: TERMINADO, ejecutado: 1 },
        { rubro: "INSTALACIÓN ELÉCTRICA::Circuito calefón / AA / ducha eléctrica", cantidad: 1, estado: TERMINADO, ejecutado: 1 },
        { rubro: "ARTEFACTOS SANITARIOS::Mesada granito para cocina", cantidad: 1, estado: TERMINADO, ejecutado: 1 },
        { rubro: "CARPINTERÍA MADERA::Puerta tablero eucalipto 0.80x2.10m", cantidad: 3, estado: TERMINADO, ejecutado: 3 },
        { rubro: "VIDRIOS::Ventana corrediza aluminio L20 + vidrio dulce 4mm", cantidad: 24, estado: TERMINADO, ejecutado: 24 },
      ],
    },
  ]),
};

const ypacaraiFinanzas: DatosFinanzas = {
  movimientos: [
    { id: "mo-1", fecha: "2023-07-04", concepto: "Anticipo 30% contrato", categoria: "Anticipos", responsable: "Ing. Andrés Villalba", monto: 84_500_000, estado: "APROBADO", comprobante: "REC-0012" },
    { id: "mo-2", fecha: "2023-09-18", concepto: "Certificado 3 — avance estructura", categoria: "Certificados", responsable: "Ing. Andrés Villalba", monto: 62_000_000, estado: "APROBADO", comprobante: "REC-0031" },
    { id: "mo-3", fecha: "2023-11-27", concepto: "Certificado 5 — avance terminaciones", categoria: "Certificados", responsable: "Ing. Andrés Villalba", monto: 71_000_000, estado: "APROBADO", comprobante: "REC-0044" },
    { id: "mo-4", fecha: "2023-12-20", concepto: "Retención fondo de garantía 5%", categoria: "Retenciones", responsable: "Lic. Mirta Villagesi", monto: -10_875_000, estado: "APROBADO" },
  ],
  jornaleros: [
    { id: "jo-1", nombre: "Crispín Cáceres", ci: "3.908.112", oficio: "Albañil", diasTrabajados: 6, horasOrdinarias: 46, horasExtra: 4, jornalDiario: 130_000, total: 808_000, estado: "PAGADO" },
    { id: "jo-2", nombre: "Fulgencio Espínola", ci: "4.201.663", oficio: "Ayudante", diasTrabajados: 6, horasOrdinarias: 48, horasExtra: 0, jornalDiario: 110_000, total: 660_000, estado: "PAGADO" },
  ],
  subcontratos: [
    { id: "sub-1", empresa: "Electricidad San Cristóbal S.R.L.", especialidad: "Instalación eléctrica", contratoNro: "SC-2023-11", montoContratado: 38_000_000, montoCertificado: 38_000_000, avance: 1, estado: "FINALIZADO", icono: "bolt" },
    { id: "sub-2", empresa: "Sanitarios del Paraná", especialidad: "Artefactos sanitarios", contratoNro: "SC-2023-14", montoContratado: 21_500_000, montoCertificado: 21_500_000, avance: 1, estado: "FINALIZADO", icono: "plumbing" },
  ],
  flujo: [
    { semana: 1, neto: 84_500_000, etiqueta: "Anticipo" },
    { semana: 8, neto: -22_000_000, etiqueta: "Obra gruesa" },
    { semana: 16, neto: -31_000_000, etiqueta: "Cubierta" },
    { semana: 22, neto: 62_000_000, etiqueta: "Certificado 3" },
    { semana: 26, neto: -18_000_000, etiqueta: "Terminaciones" },
    { semana: 28, neto: 71_000_000, etiqueta: "Certificado 5" },
  ],
  certificados: [
    { id: "cert-1", numero: 3, periodo: "Agosto 2023", monto: 62_000_000, montoCobrado: 62_000_000, estado: "COBRADO" },
    { id: "cert-2", numero: 5, periodo: "Noviembre 2023", monto: 71_000_000, montoCobrado: 71_000_000, estado: "COBRADO" },
  ],
};

const ypacaraiMateriales: DatosMateriales = {
  preciosReferencia: PRECIOS_REFERENCIA.slice(0, 4),
  pedidos: [],
  documentos: [
    { id: "doc-1", nombre: "Contrato de construcción", categoria: "CONTRATO", numero: "CTR-2023-004", fecha: "2023-05-20", vigente: true, descripcion: "Contrato de obra con precio fijo y plazo de 28 semanas.", icono: "gavel", archivo: "contrato-ypacarai.pdf" },
    { id: "doc-2", nombre: "Pliego de especificaciones", categoria: "PLIEGO", numero: "PL-2023-004", fecha: "2023-05-20", vigente: true, descripcion: "Alcance de acabados, materiales aceptados y tolerancias.", icono: "menu_book", archivo: "pliego-ypacarai.pdf" },
    { id: "doc-3", nombre: "Póliza de responsabilidad civil", categoria: "SEGUROS", numero: "SEG-2023-118", fecha: "2023-06-01", vigente: false, descripcion: "Vencida. Renovar antes de cerrar el fondo de garantía.", icono: "verified", archivo: "poliza-rc.pdf" },
  ],
  acopios: [],
};

const ypacaraiComando: DatosComando = {
  hitos: [
    { id: "h-1", titulo: "Obra terminada y habilitada", descripcion: "Vivienda entregada al comitente con acta de recepción.", criticidad: "EN_CURSO", avance: 1, fecha: "2023-12-15", responsable: "Ing. Andrés Villalba", icono: "verified" },
    { id: "h-2", titulo: "Fondo de garantía en custodia", descripcion: "5% retenido por 12 meses, se libera en diciembre 2024.", criticidad: "EN_CURSO", fecha: "2024-12-20", responsable: "Lic. Mirta Villagesi", avance: 0.5, icono: "gavel" },
  ],
  ordenesTrabajo: [],
  bitacora: [],
  cuadrillas: [
    { id: "c-1", nombre: "Cuadrilla 1 — Albañilería", oficial: "Crispín Cáceres", rendimientoPct: 96, horasImproductivas: 2, oficio: "Mampostería" },
  ],
  computo: [],
  controlesEPP: [],
};

const ypacarai: SemillaObra = {
  presupuesto: ypacaraiPresupuesto,
  materiales: ypacaraiMateriales,
  finanzas: ypacaraiFinanzas,
  comando: ypacaraiComando,
};

/* ------------------------------------------------------------------ */
/* Reforma Comercial Sajonia — en demolición y obra gruesa             */
/* ------------------------------------------------------------------ */

const EN_CURSO = "EN_EJECUCION" as const;
const PENDIENTE = "PENDIENTE" as const;

const sajoniaPresupuesto: DatosPresupuesto = {
  monedaContrato: "PYG",
  parametros: { ...PARAMETROS_PLANTA, gastosGenerales: 0.1, beneficio: 0.12 },
  adendas: [
    {
      codigo: "AD-01",
      titulo: "Refuerzo de piso para cámara frigorífica",
      descripcion:
        "El comitente implantó una cámara frigorífica de 18 m² que excede la carga prevista. Se refuerza el piso con losa de 12 cm y se reubica una descarga.",
      monto: 18_400_000,
      fecha: "2026-09-14",
      estado: "APROBADA",
      autorizadaPor: "Ing. Fernando Coronel (Cámara de Comercio)",
    },
  ],
  fases: fasesDesde([
    {
      nombre: "Demolición",
      items: [
        { rubro: "DEMOLICIONES::Demolición piso-revoques-revestimientos", cantidad: 85, estado: EN_CURSO, ejecutado: 85 },
        { rubro: "DEMOLICIONES::Demolición muro 0.15m con recuperación", cantidad: 62, estado: EN_CURSO, ejecutado: 48 },
        { rubro: "DEMOLICIONES::Demolición cielorrasos armados", cantidad: 45, estado: "EJECUTADO", ejecutado: 45 },
      ],
    },
    {
      nombre: "Obra gruesa",
      items: [
        { rubro: "MOVIMIENTO DE SUELO::Excavación manual (m³)", cantidad: 16, estado: PENDIENTE },
        { rubro: "MOVIMIENTO DE SUELO::Relleno con suelo seleccionado compactado", cantidad: 14, estado: PENDIENTE },
        { rubro: "MOVIMIENTO DE SUELO::Subbase de ripio compactado", cantidad: 9, estado: PENDIENTE },
        { rubro: "MAMPOSTERÍA::Nivelación 0.30m ladrillo común", cantidad: 42, estado: PENDIENTE },
        { rubro: "MAMPOSTERÍA::Elevación 0.15m ladrillo común", cantidad: 74, estado: PENDIENTE },
        { rubro: "CONTRAPISOS::Contrapiso 10cm cascotes (1/4:1:4:6)", cantidad: 85, estado: PENDIENTE },
      ],
    },
    {
      nombre: "Terminaciones",
      items: [
        { rubro: "PISOS::Porcelanato 60x60cm", cantidad: 85, estado: PENDIENTE },
        { rubro: "REVOQUES::Revoque 1 capa 1.5cm hidrófugo (1:4:16)", cantidad: 158, estado: PENDIENTE },
        { rubro: "CIELO RASOS::Cielo raso durlock estándar 9.5mm", cantidad: 85, estado: PENDIENTE },
        { rubro: "TABIQUES DURLOCK::Tabique durlock 9.5mm estándar (sin aislante)", cantidad: 58, estado: PENDIENTE },
        { rubro: "PINTURAS::Látex interior con enduido", cantidad: 176, estado: PENDIENTE },
        { rubro: "PINTURAS::Pintura a la cal", cantidad: 34, estado: PENDIENTE, nota: "Muro de acento de la barra." },
      ],
    },
    {
      nombre: "Artefactos e instalaciones",
      items: [
        { rubro: "ARTEFACTOS SANITARIOS::Baño social standard", cantidad: 2, estado: PENDIENTE },
        { rubro: "AGUA CORRIENTE::Instalación agua fría - baño completo", cantidad: 2, estado: PENDIENTE },
        { rubro: "INSTALACIÓN ELÉCTRICA::Tablero principal 6 llaves TM", cantidad: 1, estado: PENDIENTE },
        { rubro: "ARTEFACTOS SANITARIOS::Mesada granito para cocina", cantidad: 1, estado: PENDIENTE },
        { rubro: "CARPINTERÍA MADERA::Puerta tablero eucalipto 0.80x2.10m", cantidad: 2, estado: PENDIENTE },
        { rubro: "VIDRIOS::Ventana corrediza aluminio L20 + vidrio dulce 4mm", cantidad: 18, estado: PENDIENTE },
        { rubro: "VEREDAS Y ACCESOS::Piso adoquín hormigón 6cm (peatonal)", cantidad: 42, estado: PENDIENTE },
      ],
    },
  ]),
};

const sajoniaFinanzas: DatosFinanzas = {
  movimientos: [
    { id: "mo-1", fecha: "2026-08-10", concepto: "Anticipo 40% contrato", categoria: "Anticipos", responsable: "Ing. Fernando Coronel", monto: 61_300_000, estado: "APROBADO", comprobante: "REC-0204" },
    { id: "mo-2", fecha: "2026-08-28", concepto: "Compra de materiales para demolición (escombro)", categoria: "Materiales", responsable: "Lic. Mirta Villagesi", monto: -4_200_000, estado: "APROBADO", comprobante: "FAC-B-3391" },
    { id: "mo-3", fecha: "2026-09-14", concepto: "Adenda 01 — refuerzo de piso", categoria: "Adendas", responsable: "Ing. Fernando Coronel", monto: 18_400_000, estado: "APROBADO", comprobante: "AD-01" },
  ],
  jornaleros: [
    { id: "jo-1", nombre: "Donato Villalba", ci: "4.771.930", oficio: "Albañil", diasTrabajados: 3, horasOrdinarias: 24, horasExtra: 0, jornalDiario: 135_000, total: 405_000, estado: "PAGADO" },
    { id: "jo-2", nombre: "Silvero Bareiro", ci: "5.044.281", oficio: "Peón", diasTrabajados: 3, horasOrdinarias: 24, horasExtra: 0, jornalDiario: 112_000, total: 336_000, estado: "PENDIENTE" },
  ],
  subcontratos: [
    { id: "sub-1", empresa: "Demolizaciones El Yacaré", especialidad: "Demolición y retiro de escombros", contratoNro: "SC-2026-02", montoContratado: 9_800_000, montoCertificado: 6_900_000, avance: 0.7, estado: "EN_EJECUCION", icono: "construction" },
  ],
  flujo: [
    { semana: 1, neto: 61_300_000, etiqueta: "Anticipo" },
    { semana: 2, neto: -8_400_000, etiqueta: "Demolición" },
    { semana: 4, neto: 18_400_000, etiqueta: "Adenda 01" },
    { semana: 5, neto: -3_100_000, etiqueta: "Jornales" },
  ],
  certificados: [
    { id: "cert-1", numero: 1, periodo: "Septiembre 2026", monto: 24_600_000, montoCobrado: 0, estado: "PENDIENTE" },
  ],
};

const sajoniaMateriales: DatosMateriales = {
  preciosReferencia: PRECIOS_REFERENCIA.slice(0, 3),
  pedidos: [
    { id: "ped-1", codigoOC: "OC-2026-041", proveedor: "Ladrillos del Paraná", material: "Ladrillo común", especificacion: "Ladrillo cerámico 12x25x8 cm, primera calidad", cantidad: 12400, unidad: "u", fechaPedido: "2026-09-16", fechaEntregaPrevista: "2026-09-30", estado: "EN_CAMINO", avance: 0.55, icono: "local_shipping", destino: "Muro de separación del bathroom", responsableRecepcion: "Donato Villalba" },
  ],
  documentos: [
    { id: "doc-1", nombre: "Contrato de reforma", categoria: "CONTRATO", numero: "CTR-2026-002", fecha: "2026-07-28", vigente: true, descripcion: "Conversión de galpón a local gastronómico, 13 semanas de plazo.", icono: "gavel", archivo: "contrato-sajonia.pdf" },
    { id: "doc-2", nombre: "Permiso de reformulación municipal", categoria: "LICITACION", numero: "MUN-2026-7741", fecha: "2026-07-30", vigente: true, descripcion: "Permiso de reformulación de local comercial para uso gastronómico.", icono: "policy", archivo: "permiso-sajonia.pdf" },
    { id: "doc-3", nombre: "Certificado de inspección eléctrica", categoria: "NORMATIVA", numero: "ANDE-2026-2210", fecha: "2026-06-11", vigente: true, descripcion: "Certificado vigente de la instalación eléctrica preexistente.", icono: "bolt", archivo: "ande-2210.pdf" },
  ],
  acopios: [],
};

const sajoniaComando: DatosComando = {
  hitos: [
    { id: "h-1", titulo: "Cerrar permisos de sanitacion", descripcion: "Sin este permiso no se puede habilitar el local para inspeccion sanitaria.", criticidad: "CRITICO", fecha: "2026-10-05", responsable: "Lic. Mirta Villagesi", icono: "policy", accion: "Ver estado" },
    { id: "h-2", titulo: "Definir el layout de cocina", descripcion: "El comitente cambió la ubicación de la cocina dos veces. Falta aprobar el plano.", criticidad: "EN_CURSO", fecha: "2026-09-28", responsable: "Ing. Fernando Coronel", avance: 0.6, icono: "pending_actions", accion: "Enviar propuesta" },    { id: "h-3", titulo: "Entrega de la cámara frigorífica", descripcion: "Equipo provisto por el comitente. Coordiar descarga y conexión.", criticidad: "PROGRAMADO", fecha: "2026-10-12", responsable: "Ing. Fernando Coronel", icono: "local_shipping" },
  ],
  ordenesTrabajo: [
    { id: "ot-1", titulo: "Retiro de cielorraso armado", estado: "FINALIZADA", responsable: "Donato Villalba", cuadrilla: "Cuadrilla 1", horario: "07:00 – 15:00", descripcion: "Demolición de cielorraso de 45 m² y retiro de escombros a contenedor." },
  ],
  bitacora: [
    { id: "bit-1", fecha: "2026-09-16", hora: "08:15", autor: "Ing. Fernando Coronel", titulo: "Recepción de ladrillo en obra", cuerpo: "Se recibieron 6.000 unidades de ladrillo común. Se controló cantidad y estado de las piezas en el volcado.", condicion: "APROBADA", clima: { temperatura: 31, condicion: "Despejado", viento: 8, lluvia: false }, adjuntos: 2, firmaValidada: true },
    { id: "bit-2", fecha: "2026-09-15", hora: "16:40", autor: "Lic. Mirta Villagesi", titulo: "Adenda 01 aprobada", cuerpo: "La Cámara de Comercio aprobó el refuerzo de piso para la cámara frigorífica. Se adjusts el cronograma en 4 días hábiles.", condicion: "APROBADA", clima: { temperatura: 27, condicion: "Nublado", viento: 12, lluvia: false }, adjuntos: 1, firmaValidada: true },
  ],
  cuadrillas: [
    { id: "c-1", nombre: "Cuadrilla 1 — Demolición", oficial: "Donato Villalba", rendimientoPct: 88, horasImproductivas: 6, oficio: "Demolición" },
    { id: "c-2", nombre: "Cuadrilla 2 — Albañilería", oficial: "Silvero Bareiro", rendimientoPct: 100, horasImproductivas: 0, oficio: "Mampostería" },
  ],
  computo: [
    { id: "cmp-1", rubro: "Demolición piso-revoques-revestimientos", unidad: "m2", ejecutado: 85, presupuestado: 85, nota: "Completo", tono: "tertiary" },
    { id: "cmp-2", rubro: "Demolición muro 0.15m con recuperación", unidad: "m2", ejecutado: 48, presupuestado: 62, nota: "Atrasado 1 día", tono: "primario" },
    { id: "cmp-3", rubro: "Demolición cielorrasos armados", unidad: "m2", ejecutado: 45, presupuestado: 45, nota: "Completo", tono: "tertiary" },
  ],
  controlesEPP: [
    { id: "epp-1", concepto: "Casco de seguridad", detalle: "Verificado en 6 de 6 operarios al ingreso", hora: "07:15" },
    { id: "epp-2", concepto: "Guantes y gafas de corte", detalle: "Proviso obligatorio en tarea de escombro", hora: "07:15" },
  ],
};

const sajonia: SemillaObra = {
  presupuesto: sajoniaPresupuesto,
  materiales: sajoniaMateriales,
  finanzas: sajoniaFinanzas,
  comando: sajoniaComando,
};

/* ------------------------------------------------------------------ */

export const SEMILLAS: Record<string, SemillaObra> = {
  "los-alamos": losAlamos,
  ypacarai,
  sajonia,
};

export const IDS_SEMILLA = OBRAS.map((o) => o.id);

export function obraPorId(id: string): Obra {
  return OBRAS.find((o) => o.id === id) ?? OBRA_POR_DEFECTO;
}

export function semillaDe(id: string): SemillaObra {
  return SEMILLAS[id] ?? losAlamos;
}
