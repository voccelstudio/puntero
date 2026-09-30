/**
 * Modelo de dominio de Puntero.
 *
 * Convención monetaria: TODOS los montos se almacenan en guaraníes paraguayos
 * (Gs), la moneda de curso legal en Paraguay. La conversión a USD es derivado
 * y se calcula contra la cotización del día (ver `lib/cotizacion.ts`).
 * Esto mantiene los flujos de caja, el IVA y los pagos alineados con la moneda
 * en la que realmente se mueve el dinero en obra.
 */

export type Moneda = "PYG" | "USD";

export type Unidad =
  | "m2"
  | "m3"
  | "m"
  | "ml"
  | "kg"
  | "gl"
  | "u"
  | "dia"
  | "jornal"
  | "mes";

/* ------------------------------------------------------------------ */
/* Obra                                                                */
/* ------------------------------------------------------------------ */

export type FaseObra =
  | "PREPARACION"
  | "ESTRUCTURA"
  | "INSTALACIONES"
  | "TERMINACIONES";

export interface Obra {
  id: string;
  codigo: string;
  nombre: string;
  empConstructora: string;
  comitente: string;
  ubicacion: string;
  latitud: number;
  longitud: number;
  inicio: string;
  finEstimado: string;
  superficie: number;
  monedaContrato: Moneda;
  /** Semana actual del cronograma (1-indexada). */
  semanaActual: number;
  semanasTotales: number;
}

/* ------------------------------------------------------------------ */
/* Presupuesto y cómputo métrico                                        */
/* ------------------------------------------------------------------ */

export interface ItemPresupuesto {
  id: string;
  codigo: string;
  descripcion: string;
  /** Nota técnica o condiciones de ejecución. */
  nota?: string;
  unidad: Unidad;
  cantidad: number;
  /** Precio unitario de materiales, en Gs. */
  precioMaterial: number;
  /** Precio unitario de mano de obra, en Gs. */
  precioManoObra: number;
  /** Referencia a `Adenda.codigo` cuando el ítem proviene de una adenda. */
  adenda?: string;
  estado: "PENDIENTE" | "EN_EJECUCION" | "EJECUTADO" | "APROBADO";
  /** Volumen realmente ejecutado, para el desvío de costo. */
  cantidadEjecutada: number;
  proveedor?: string;
}

export interface FasePresupuesto {
  id: string;
  numero: number;
  nombre: string;
  items: ItemPresupuesto[];
}

export interface Adenda {
  codigo: string;
  titulo: string;
  descripcion: string;
  /** Monto del acuerdo firmado, en Gs. */
  monto: number;
  fecha: string;
  estado: "BORRADOR" | "APROBADA" | "RECHAZADA";
  autorizadaPor: string;
}

/** Coeficientes que alimentan el motor financiero. */
export interface ParametrosFinancieros {
  /** Gastos generales e imprevistos, fracción (0.08 = 8%). */
  gastosGenerales: number;
  /** Beneficio del constructor, fracción (0.15 = 15%). */
  beneficio: number;
  /** IVA Paraguay, fracción (0.10 = 10%). */
  iva: number;
}

/* ------------------------------------------------------------------ */
/* Centro de comando                                                   */
/* ------------------------------------------------------------------ */

export type CriticidadHito = "CRITICO" | "EN_CURSO" | "PROGRAMADO";

export type IconoMaterial =
  | "warning"
  | "plumbing"
  | "policy"
  | "construction"
  | "bar_chart"
  | "menu_book"
  | "photo_camera"
  | "health_and_safety"
  | "receipt_long"
  | "payments"
  | "speed"
  | "groups"
  | "pending_actions"
  | "inventory"
  | "local_shipping"
  | "point_of_sale"
  | "engineering"
  | "request_quote"
  | "trending_up"
  | "trending_down"
  | "description"
  | "verified"
  | "gavel"
  | "shield"
  | "lock"
  | "sunny"
  | "check_circle"
  | "download"
  | "videocam"
  | "attachment"
  | "add_circle"
  | "sync"
  | "tune"
  | "table_view"
  | "picture_as_pdf"
  | "bookmark_add"
  | "history_edu"
  | "functions"
  | "send"
  | "file_download"
  | "account_balance"
  | "receipt"
  | "expand_more"
  | "close"
  | "more_vert"
  | "wb_sunny"
  | "open_in_new"
  | "location_on";

export interface Hito {
  id: string;
  titulo: string;
  descripcion: string;
  criticidad: CriticidadHito;
  /** Fecha límite o de ejecución estimada. */
  fecha: string;
  responsable: string;
  /** Avance 0..1, presente en hitos en curso. */
  avance?: number;
  icono: IconoMaterial;
  /** Acción principal del hito. */
  accion?: string;
}

export interface OrdenTrabajo {
  id: string;
  titulo: string;
  estado: "EN_PROCESO" | "FINALIZADA" | "PLANIFICADA";
  responsable: string;
  cuadrilla: string;
  horario: string;
  descripcion: string;
  norma?: string;
}

export interface FotoObra {
  id: string;
  alt: string;
  src: string;
  etiqueta?: string;
}

export interface EntradaBitacora {
  id: string;
  fecha: string;
  hora: string;
  autor: string;
  titulo: string;
  cuerpo: string;
  condicion: "APROBADA" | "CON_OBSERVACIONES" | "RECHAZADA";
  clima: {
    temperatura: number;
    condicion: string;
    viento: number;
    lluvia: boolean;
  };
  adjuntos: number;
  firmaValidada: boolean;
  foto?: FotoObra;
}

export interface Cuadrilla {
  id: string;
  nombre: string;
  oficial: string;
  rendimientoPct: number;
  horasImproductivas: number;
  oficio: string;
}

export interface ItemComputo {
  id: string;
  rubro: string;
  unidad: Unidad;
  ejecutado: number;
  presupuestado: number;
  /** Etiqueta de estado: variación, rendimiento, sector, etc. */
  nota?: string;
  tono: "primario" | "tertiary" | "secondary";
}

export interface ControlEPP {
  id: string;
  concepto: string;
  detalle: string;
  hora?: string;
}

/* ------------------------------------------------------------------ */
/* Finanzas                                                            */
/* ------------------------------------------------------------------ */

export interface MovimientoCaja {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  responsable: string;
  /** Monto en Gs. Positivo = ingreso, negativo = egreso. */
  monto: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  comprobante?: string;
}

export interface LiquidacionJornal {
  id: string;
  nombre: string;
  ci: string;
  oficio: string;
  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtra: number;
  /** Jornal diario base en Gs, ya incluido el mínimo(_) de la categoría. */
  jornalDiario: number;
  total: number;
  estado: "PENDIENTE" | "PAGADO";
}

export interface Subcontrato {
  id: string;
  empresa: string;
  especialidad: string;
  contratoNro: string;
  montoContratado: number;
  montoCertificado: number;
  avance: number;
  estado: "EN_EJECUCION" | "FINALIZADO" | "PENDIENTE";
  icono: IconoMaterial;
}

export interface SemanaFlujo {
  semana: number;
  /** Monto neto en Gs. Positivo = ingreso, negativo = egreso. */
  neto: number;
  etiqueta: string;
}

export interface CertificadoObra {
  id: string;
  numero: number;
  periodo: string;
  monto: number;
  montoCobrado: number;
  estado: "PENDIENTE" | "COBRADO" | "EN_AUDITORIA";
}

/* ------------------------------------------------------------------ */
/* Materiales                                                          */
/* ------------------------------------------------------------------ */

export type EstadoPedido =
  | "EN_CAMINO"
  | "ENTREGADO_VERIFICADO"
  | "CONFIRMADO"
  | "RECEPCIONADO";

export interface Pedido {
  id: string;
  codigoOC: string;
  proveedor: string;
  material: string;
  especificacion: string;
  cantidad: number;
  unidad: Unidad;
  fechaPedido: string;
  fechaEntregaPrevista: string;
  fechaEntregaReal?: string;
  estado: EstadoPedido;
  /** Avance 0..1 del circuito logística. */
  avance: number;
  icono: IconoMaterial;
  destino: string;
  responsableRecepcion: string;
}

export type CategoriaMaterial =
  | "ESTRUCTURAL"
  | "METALICOS"
  | "MAMPOSTERIA"
  | "INSTALACIONES"
  | "TERMINACIONES";

export interface PrecioReferencia {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: CategoriaMaterial;
  unidad: Unidad;
  precioGs: number;
  /** Variación porcentual contra el precio de la competencia (0.07 = 7%). */
  variacionPct: number;
  proveedor: string;
  stockObra: number;
  stockMinimo: number;
  ultimaActualizacion: string;
}

export interface DocumentoLegal {
  id: string;
  nombre: string;
  categoria:
    | "CONTRATO"
    | "PLIEGO"
    | "SEGUROS"
    | "NORMATIVA"
    | "LICITACION";
  numero: string;
  fecha: string;
  vigente: boolean;
  descripcion: string;
  icono: IconoMaterial;
  archivo: string;
}

export interface Acopio {
  id: string;
  material: string;
  cantidad: number;
  unidad: Unidad;
  fechaIngreso: string;
  destinoRubros: string[];
}
