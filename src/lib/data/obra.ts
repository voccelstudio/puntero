import type {
  Adenda,
  CertificadoObra,
  Cuadrilla,
  EntradaBitacora,
  FasePresupuesto,
  Hito,
  ItemComputo,
  Obra,
  OrdenTrabajo,
  ParametrosFinancieros,
  ControlEPP,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Parámetros financieros Paraguay                                       */
/* ------------------------------------------------------------------ */

export const PARAMETROS_FINANCIEROS: ParametrosFinancieros = {
  gastosGenerales: 0.08,
  beneficio: 0.15,
  iva: 0.1,
};

/* ------------------------------------------------------------------ */
/* Obra                                                                */
/* ------------------------------------------------------------------ */

export const OBRA: Obra = {
  id: "obra-1",
  codigo: "OBR-2024-0007",
  nombre: "Residencial Los Álamos — Torre B",
  empConstructora: "Inversiones Urbanas S.A.",
  comitente: "Fideicomiso Los Álamos",
  ubicacion: "Av. Eusebio Ayala km 4, Asunción",
  latitud: -25.2964,
  longitud: -57.6359,
  inicio: "2024-01-15",
  finEstimado: "2024-11-28",
  superficie: 8420,
  monedaContrato: "PYG",
  semanaActual: 18,
  semanasTotales: 45,
};

/* ------------------------------------------------------------------ */
/* Centro de comando                                                   */
/* ------------------------------------------------------------------ */

export const HITOS: Hito[] = [
  {
    id: "hito-1",
    titulo: "Hormigonado Losa Piso 4 (Sector A-B)",
    descripcion:
      "Volumen requerido: 42 m3 de hormigón H-21 con bomba pluma. Verificación de armaduras completada al 90%.",
    criticidad: "CRITICO",
    fecha: "Vence en 3 días (viernes)",
    responsable: "Ing. S. Valenzuela",
    icono: "warning",
    accion: "Liberar encofrado",
  },
  {
    id: "hito-2",
    titulo: "Montaje de cañerías sanitarias columna 2",
    descripcion:
      "Prueba hidráulica previa aprobada en pisos 1 al 3. Empalme con colector troncal.",
    criticidad: "EN_CURSO",
    fecha: "Mañana 17:00",
    responsable: "Cuadrilla 4 — Sanitarios",
    avance: 0.8,
    icono: "plumbing",
  },
  {
    id: "hito-3",
    titulo: "Inspección estructural municipal (MOPC)",
    descripcion:
      "Revisión de planos conforme a obra, fase subsuelo y niveles 1-3. Carpeta técnica en orden.",
    criticidad: "PROGRAMADO",
    fecha: "18 de octubre",
    responsable: "Arq. Díaz",
    icono: "policy",
    accion: "Ver carpeta",
  },
];

export const ORDENES_TRABAJO: OrdenTrabajo[] = [
  {
    id: "ot-142",
    titulo: "Colado de hormigón en vigas de encadenado eje C-D",
    estado: "EN_PROCESO",
    responsable: "Capataz Ramón Gómez",
    cuadrilla: "6 operarios hormigón",
    horario: "08:00 - 15:30",
    descripcion:
      "Se realiza el vertido y vibrado de la mezcla con dos agujas mecánicas de 38 mm. Se toman 3 probetas cilíndricas testigo para ensayo a 7 y 28 días.",
    norma: "ASTM C31/C39",
  },
  {
    id: "ot-141",
    titulo: "Armado y estribado de columnas nivel 4",
    estado: "FINALIZADA",
    responsable: "Capataz Ramón Gómez",
    cuadrilla: "8 armadores",
    horario: "07:30 - 16:00",
    descripcion:
      "Conformado de estribos Ø8 y colocación de barras longitudinales ADN 420 según plano de armaduras.",
  },
];

export const ENTRADAS_BITACORA: EntradaBitacora[] = [
  {
    id: "bit-1",
    fecha: "2024-10-16",
    hora: "10:15",
    autor: "Arq. Díaz",
    titulo: "Registro fotográfico de verificación estructural",
    cuerpo:
      "Inspección de armaduras de hierro en vigas antes del colado. Se controlaron los separadores de recubrimiento (mínimo 2.5 cm reglamentario) y la limpieza del fondo de encofrados. Aprobado para hormigonar a las 11:30 hs.",
    condicion: "APROBADA",
    clima: {
      temperatura: 22,
      condicion: "Despejado",
      viento: 12,
      lluvia: false,
    },
    adjuntos: 3,
    firmaValidada: true,
  },
];

export const CUADRILLAS: Cuadrilla[] = [
  {
    id: "c-1",
    nombre: "Estructura",
    oficial: "Ing. S. Valenzuela",
    rendimientoPct: 94.2,
    horasImproductivas: 1.2,
    oficio: "Hormigón armado",
  },
  {
    id: "c-2",
    nombre: "Mampostería",
    oficial: "Sr. Alcides Rojas",
    rendimientoPct: 88.5,
    horasImproductivas: 2.4,
    oficio: "Albañilería",
  },
  {
    id: "c-3",
    nombre: "Instalaciones",
    oficial: "Ing. Fátima Cardozo",
    rendimientoPct: 91.7,
    horasImproductivas: 1.8,
    oficio: "Eléctricas y sanitarias",
  },
];

export const COMPUTO: ItemComputo[] = [
  {
    id: "cmp-1",
    rubro: "Hormigón estructural H-21",
    unidad: "m3",
    ejecutado: 54,
    presupuestado: 92,
    nota: "-1.2% (óptimo)",
    tono: "primario",
  },
  {
    id: "cmp-2",
    rubro: "Acero conformado ADN 420",
    unidad: "kg",
    ejecutado: 5120,
    presupuestado: 8400,
    nota: "240 kg/día",
    tono: "tertiary",
  },
  {
    id: "cmp-3",
    rubro: "Mampostería hueca 18x18x33",
    unidad: "m2",
    ejecutado: 410,
    presupuestado: 1200,
    nota: "Piso 1-2",
    tono: "secondary",
  },
];

export const CONTROLES_EPP: ControlEPP[] = [
  {
    id: "epp-1",
    concepto: "Uso obligatorio de casco y calzado",
    detalle: "100% (34/34)",
  },
  {
    id: "epp-2",
    concepto: "Líneas de vida y arnés (piso 4)",
    detalle: "100% verificado",
  },
  {
    id: "epp-3",
    concepto: "Charla de 5 minutos de seguridad",
    detalle: "",
    hora: "07:45",
  },
];

/* ------------------------------------------------------------------ */
/* Presupuesto                                                         */
/* ------------------------------------------------------------------ */

export const FASES_PRESUPUESTO: FasePresupuesto[] = [
  {
    id: "fase-1",
    numero: 1,
    nombre: "Demolición y movimiento de suelos",
    items: [
      {
        id: "it-1",
        codigo: "RUB-SUEL-01",
        descripcion: "Limpieza y descapote manual de terreno",
        nota: "Retiro de raíces con cuadrilla de 3 operarios",
        unidad: "m2",
        cantidad: 450,
        cantidadEjecutada: 450,
        precioMaterial: 0,
        precioManoObra: 3200,
        estado: "EJECUTADO",
      },
      {
        id: "it-2",
        codigo: "RUB-SUEL-04",
        descripcion: "Excavación para cimientos corridos y zapatas",
        nota: "Profundidad media 1.80 m",
        unidad: "m3",
        cantidad: 185,
        cantidadEjecutada: 185,
        precioMaterial: 1500,
        precioManoObra: 8500,
        estado: "EJECUTADO",
      },
    ],
  },
  {
    id: "fase-2",
    numero: 2,
    nombre: "Estructura de hormigón armado",
    items: [
      {
        id: "it-3",
        codigo: "RUB-EST-01",
        descripcion: "Hormigón elaborado H-21 para bases y vigas",
        nota: "Proveedor asignado: Cemento Guaraní, planta Villeta",
        unidad: "m3",
        cantidad: 92,
        cantidadEjecutada: 54,
        precioMaterial: 125000,
        precioManoObra: 45000,
        estado: "EN_EJECUCION",
        proveedor: "Cemento Guaraní",
      },
      {
        id: "it-4",
        codigo: "RUB-EST-06",
        descripcion: "Armadura de acero aletado ADN 420 cortado y doblado",
        nota: "Barros Ø8 a Ø25 mm según plano de armaduras",
        unidad: "kg",
        cantidad: 8400,
        cantidadEjecutada: 5120,
        precioMaterial: 1450,
        precioManoObra: 620,
        estado: "EN_EJECUCION",
      },
      {
        id: "it-5",
        codigo: "RUB-EST-12",
        descripcion: "Encofrado de madera fenólica para columnas y losas",
        nota: "Placas de 18 mm con 3 amortizaciones calculadas",
        unidad: "m2",
        cantidad: 620,
        cantidadEjecutada: 388,
        precioMaterial: 8200,
        precioManoObra: 11500,
        estado: "EN_EJECUCION",
      },
      {
        id: "it-6",
        codigo: "AD-001",
        descripcion: "[Adenda 01] Refuerzo losa sala de máquinas",
        nota: "Solicitud de cambio AD-001 — mayor sobrecarga por grupo electrógeno",
        unidad: "gl",
        cantidad: 1,
        cantidadEjecutada: 1,
        precioMaterial: 3500000,
        precioManoObra: 2100000,
        adenda: "AD-001",
        estado: "APROBADO",
      },
    ],
  },
  {
    id: "fase-3",
    numero: 3,
    nombre: "Albañilería e instalaciones eléctricas y sanitarias",
    items: [],
  },
];

export const ADENDAS: Adenda[] = [
  {
    codigo: "AD-001",
    titulo: "Refuerzo losa sala de máquinas",
    descripcion: "Mayor sobrecarga por grupo electrógeno en sala de máquinas.",
    monto: 5600000,
    fecha: "2024-09-28",
    estado: "APROBADA",
    autorizadaPor: "Comitente — OS N° 14",
  },
  {
    codigo: "AD-002",
    titulo: "Redireccionamiento de pluviales",
    descripcion: "Reubicación de 4 bajantes por interferencia con parking subterráneo.",
    monto: 0,
    fecha: "2024-10-12",
    estado: "BORRADOR",
    autorizadaPor: "En estudio",
  },
];

/* ------------------------------------------------------------------ */
/* Finanzas                                                            */
/* ------------------------------------------------------------------ */

export const CERTIFICADOS: CertificadoObra[] = [
  {
    id: "cert-8",
    numero: 8,
    periodo: "Setiembre 2024",
    monto: 0,
    montoCobrado: 0,
    estado: "EN_AUDITORIA",
  },
];

export const FONDOS: { fijo: number; saldo: number; reposicionSugerida: number } = {
  fijo: 15000000,
  saldo: 0,
  reposicionSugerida: 0,
};
