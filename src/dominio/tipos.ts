/**
 * Modelo de dominio de Puntero 5.0.
 *
 * Convención monetaria: TODOS los montos se almacenan en guaraníes paraguayos
 * (Gs), la moneda de curso legal en Paraguay y la que se mueve en obra. La
 * conversión a USD es derivada y se calcula contra la cotización del día
 * (ver `dominio/cotizacion.ts`), así el IVA, la caja chica y los pagos quedan
 * siempre en la moneda en la que efectivamente se transacciona.
 *
 * Toda colección editable vive en `localStorage` versionado
 * (ver `dominio/almacen.ts`): no hay backend y los datos no se comparten
 * entre dispositivos.
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

export type FaseObra = "PREPARACION" | "ESTRUCTURA" | "INSTALACIONES" | "TERMINACIONES";

export type EstadoObra = "PLANIFICACION" | "EN_CURSO" | "FINALIZADA" | "SUSPENDIDA";

export type TipoObra =
  | "RESIDENCIAL"
  | "COMERCIAL"
  | "INDUSTRIAL"
  | "REFORMA"
  | "INFRAESTRUCTURA";

export interface Obra {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoObra;
  estado: EstadoObra;
  /** Etapa de obra en la que está, para el chip en la navegación. */
  fase: FaseObra;
  empConstructora: string;
  comitente: string;
  /** Id del cliente en la colección `gente`, si está cargado. */
  clienteId?: string;
  ubicacion: string;
  latitud: number;
  longitud: number;
  inicio: string;
  finEstimado: string;
  superficie: number;
  monedaContrato: Moneda;
  resumen: string;
}

/* ------------------------------------------------------------------ */
/* Presupuesto                                                         */
/* ------------------------------------------------------------------ */

export type EstadoItem = "PENDIENTE" | "EN_EJECUCION" | "EJECUTADO" | "APROBADO";

export interface ItemPresupuesto {
  id: string;
  /** Código jerárquico visible: "1.1", "1.2", ... Se recalcula al ordenar. */
  codigo: string;
  descripcion: string;
  /** Nota técnica o condiciones de ejecución del ítem. */
  nota?: string;
  unidad: Unidad;
  cantidad: number;
  /** Precio unitario de materiales, en Gs. */
  precioMaterial: number;
  /** Precio unitario de mano de obra, en Gs. */
  precioManoObra: number;
  /**
   * Rubro de la base de precios del que sale este ítem, en formato
   * `"CATEGORIA::Nombre"`. Ausente en los ítems cargados a mano.
   */
  rubroId?: string;
  rubroCategoria?: string;
  rendimiento?: number | null;
  /** Referencia a `Adenda.codigo` cuando el ítem pertenece a una adenda. */
  adenda?: string;
  estado: EstadoItem;
  /** Volumen realmente ejecutado, para avance y desvío de costo. */
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

/**
 * Coeficientes que alimentan el motor financiero.
 *
 * El orden de aplicación está definido en `dominio/calculo.ts` y es una
 * decisión de negocio: los gastos generales se calculan sobre el costo
 * directo, nunca sobre el costo ya cargado con beneficio, para no duplicar la
 * base.
 */
export interface ParametrosFinancieros {
  /** Gastos generales e imprevistos, fracción (0.08 = 8%). */
  gastosGenerales: number;
  /** Beneficio del constructor, fracción (0.15 = 15%). */
  beneficio: number;
  /** Honorarios del profesional, fracción sobre costo directo (0.07 = 7%). */
  honorarios: number;
  /** Descuento comercial, fracción sobre el subtotal bruto (0.03 = 3%). */
  descuento: number;
  /**
   * IVA sobre materiales, fracción (0.10 = 10%).
   *
   * Paraguay grava los servicios de carácter personal —la mano de obra— al 5%
   * y el resto al 10%, así que el impuesto se calcula partido y no como un
   * porcentaje único sobre el total.
   */
  ivaMateriales: number;
  /** IVA sobre mano de obra, fracción (0.05 = 5%). */
  ivaManoObra: number;
  /** Aplica IVA al total (toggle "IVA facturable"). */
  facturaIva: boolean;
}

/** Instantánea de un presupuesto guardado en el historial. */
export interface VersionPresupuesto {
  id: string;
  fecha: string;
  etiqueta: string;
  fases: FasePresupuesto[];
  parametros: ParametrosFinancieros;
  adendas: Adenda[];
}

export interface DatosPresupuesto {
  fases: FasePresupuesto[];
  adendas: Adenda[];
  parametros: ParametrosFinancieros;
  monedaContrato: Moneda;
  versiones: VersionPresupuesto[];
}

/* ------------------------------------------------------------------ */
/* Cronograma                                                          */
/* ------------------------------------------------------------------ */

export type EstadoTarea = "PENDIENTE" | "EN_CURSO" | "FINALIZADA" | "BLOQUEADA";

export interface TareaCronograma {
  id: string;
  /** Fase a la que pertenece; coincide con `FasePresupuesto.id`. */
  faseId: string;
  nombre: string;
  /** Fecha ISO `YYYY-MM-DD`. */
  inicio: string;
  /** Fecha ISO `YYYY-MM-DD`, inclusive. */
  fin: string;
  /** Avance declarado 0..1. Si no se carga, se deriva de las fechas. */
  avance: number;
  estado: EstadoTarea;
  responsable: string;
  /** Id del contratista asignado, si corresponde. */
  contratistaId?: string;
  /** Ítems de presupuesto que ejecuta esta tarea, para el cómputo acoplado. */
  itemIds: string[];
  /** Ids de tareas que deben terminar antes de que esta empiece. */
  dependeDe: string[];
  critica: boolean;
  notas?: string;
}

export interface DatosCronograma {
  tareas: TareaCronograma[];
}

/* ------------------------------------------------------------------ */
/* Finanzas                                                            */
/* ------------------------------------------------------------------ */

export type CategoriaMovimiento =
  | "MATERIALES"
  | "MANO_DE_OBRA"
  | "SUBCONTRATOS"
  | "MAQUINARIAS"
  | "SERVICIOS"
  | "TRAMITES"
  | "VIATICOS"
  | "ALMACEN"
  | "HONORARIOS"
  | "INGRESOS"
  | "OTROS";

export type FuenteFondo = "CAJA_CHICA" | "CUENTA" | "ANTICIPO" | "CERTIFICADO" | "OTRO";

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "TARJETA" | "DEPOSITO";

/**
 * Movimiento de caja único.
 *
 * `monto` en Gs con signo: positivo = ingreso, negativo = egreso. Los campos de
 * comprobante (RUC, factura) son los que exige la normativa paraguaya para
 * poder deducir el gasto.
 */
export interface MovimientoCaja {
  id: string;
  fecha: string;
  concepto: string;
  categoria: CategoriaMovimiento;
  fuente: FuenteFondo;
  metodo: MetodoPago;
  responsable: string;
  monto: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  /** RUC del emisor, para egresos con factura. */
  ruc?: string;
  /** Número de factura o recibo. */
  factura?: string;
  proveedor?: string;
  /** Rubro de presupuesto al que se imputa el gasto. */
  itemPresupuestoId?: string;
}

export type RolJornalero = "AYUDANTE" | "OFICIAL" | "PUNTERO" | "ESPECIALISTA";

export interface Jornalero {
  id: string;
  nombre: string;
  ci: string;
  rol: RolJornalero;
  oficio: string;
  /** Jornal diario base en Gs. */
  jornalDiario: number;
  telefono?: string;
  alta: string;
  activo: boolean;
}

/** Jornada trabajada por un jornalero, en un día dado. */
export interface Jornada {
  id: string;
  jornaleroId: string;
  fecha: string;
  horasNormales: number;
  horasExtra: number;
  /** Paga la jornada. Se replica en `MovimientoCaja` al aprobar. */
  pagada: boolean;
  movimientoId?: string;
}

export interface LiquidacionJornal {
  id: string;
  nombre: string;
  ci: string;
  oficio: string;
  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtra: number;
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
}

export interface CertificadoObra {
  id: string;
  numero: number;
  periodo: string;
  monto: number;
  montoCobrado: number;
  estado: "PENDIENTE" | "COBRADO" | "EN_AUDITORIA";
}

export interface DatosFinanzas {
  movimientos: MovimientoCaja[];
  /** Fondo fijo de caja chica en Gs. */
  fondoFijo: number;
  jornaleros: Jornalero[];
  jornadas: Jornada[];
  liquidaciones: LiquidacionJornal[];
  subcontratos: Subcontrato[];
  certificados: CertificadoObra[];
}

/* ------------------------------------------------------------------ */
/* Gente: contratistas, clientes                                       */
/* ------------------------------------------------------------------ */

export interface Contratista {
  id: string;
  nombre: string;
  empresa: string;
  especialidad: string;
  telefono: string;
  /** Registro IPS del contratista, si está afiliado. */
  ips?: string;
  /** Categoría de riesgo del IPS. */
  categoriaIps?: string;
  ruc?: string;
  /** 0..5, promedio de las calificaciones cargadas. */
  rating: number;
  comentarios: RatingComentario[];
  enListaNegra: boolean;
  motivoListaNegra?: string;
  personal: PersonalAsignado[];
}

export interface RatingComentario {
  id: string;
  fecha: string;
  estrellas: number;
  texto: string;
}

export interface PersonalAsignado {
  id: string;
  nombre: string;
  ci: string;
  oficio: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  direccion: string;
  ruc?: string;
  nota?: string;
}

export interface DatosGente {
  contratistas: Contratista[];
  clientes: Cliente[];
}

/* ------------------------------------------------------------------ */
/* Colecciones editables                                                */
/* ------------------------------------------------------------------ */

export type Coleccion = "presupuesto" | "cronograma" | "finanzas" | "gente";

export const COLECCIONES: Coleccion[] = ["presupuesto", "cronograma", "finanzas", "gente"];
