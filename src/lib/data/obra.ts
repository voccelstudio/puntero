import type {
  Adenda,
  CertificadoObra,
  ControlEPP,
  Cuadrilla,
  EntradaBitacora,
  Hito,
  ItemComputo,
  OrdenTrabajo,
  ParametrosFinancieros,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Parámetros financieros Paraguay                                       */
/* ------------------------------------------------------------------ */

import { IVA_LAB, IVA_MAT } from "@/lib/data/precios";

export const PARAMETROS_FINANCIEROS: ParametrosFinancieros = {
  gastosGenerales: 0.08,
  beneficio: 0.15,
  // El IVA va partido: materiales al 10%, mano de obra al 5%. Las tasas salen
  // de la base de precios para que no puedan desincronizarse.
  ivaMateriales: IVA_MAT,
  ivaManoObra: IVA_LAB,
};

/* ------------------------------------------------------------------ */
/* Obra                                                                */
/* ------------------------------------------------------------------ */

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
