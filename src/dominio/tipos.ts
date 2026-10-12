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

export type EstadoObra = "PLANIFICACION" | "APROBADA" | "EN_CURSO" | "FINALIZADA" | "SUSPENDIDA";

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
  /** Id del cliente en el registro global de clientes del dispositivo. */
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
  /** Contrato de la obra al que se imputa el pago o el cobro. */
  contratoId?: string;
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

/**
 * Gente de la obra. Los contratistas son propios de cada obra; los clientes,
 * en cambio, viven en un registro global del dispositivo (una persona puede
 * ser comitente de varias obras), por eso no forman parte de esta colección.
 */
export interface DatosGente {
  contratistas: Contratista[];
}

/* ------------------------------------------------------------------ */
/* Recursos: materiales, pedidos y biblioteca                          */
/* ------------------------------------------------------------------ */

/** Insumo del catálogo propio, con su stock y su precio de referencia. */
export interface Material {
  id: string;
  /** Código visible de obra, p. ej. "MET-ADN-10". */
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: Unidad;
  /** Proveedor habitual del insumo. */
  proveedorHabitual: string;
  /** Precio de referencia unitario en Gs. */
  precioReferencia: number;
  /** Stock actual en obra, en la unidad del insumo. */
  stock: number;
  /** Stock mínimo a partir del cual se alerta reposición. */
  stockMinimo: number;
  /** Rubro de presupuesto al que se imputa (opcional). */
  itemPresupuestoId?: string;
}

export type EstadoPedido =
  | "BORRADOR"
  | "ENVIADO"
  | "EN_TRANSITO"
  | "RECIBIDO_PARCIAL"
  | "RECIBIDO"
  | "CANCELADO";

/** Línea de un pedido a proveedor. */
export interface ItemPedido {
  id: string;
  /** Insumo del catálogo, si el pedido sale de él. */
  materialId?: string;
  descripcion: string;
  unidad: Unidad;
  cantidad: number;
  /** Precio unitario pactado en Gs. */
  precioUnitario: number;
  /** Cantidad efectivamente recibida (remito). */
  cantidadRecibida: number;
}

/** Pedido / orden de compra a un proveedor. */
export interface Pedido {
  id: string;
  /** Número visible, p. ej. "OC-2026-001". */
  numero: string;
  fecha: string;
  proveedor: string;
  /** Destino del material dentro de la obra (fase, acopio, etc.). */
  destino: string;
  /** Fecha estimada de entrega ISO. */
  fechaEntrega: string;
  estado: EstadoPedido;
  items: ItemPedido[];
  nota?: string;
}

export type TipoDocumento =
  | "CONTRATO"
  | "PLIEGO"
  | "PLANO"
  | "FICHA_TECNICA"
  | "SEGURO"
  | "NORMA"
  | "OTRO";

export type EstadoDocumento = "VIGENTE" | "VENCIDO" | "EN_REVISION";

/** Documento del repositorio técnico y legal de la obra. */
export interface DocumentoBiblioteca {
  id: string;
  titulo: string;
  tipo: TipoDocumento;
  descripcion: string;
  categoria: string;
  /** Enlace o referencia externa (ruta, código, URL). */
  referencia?: string;
  /** Fecha de vencimiento ISO, si aplica (seguros, contratos). */
  vence?: string;
  fecha: string;
  estado: EstadoDocumento;
}

export interface DatosMateriales {
  materiales: Material[];
}

export interface DatosPedidos {
  pedidos: Pedido[];
}

export interface DatosBiblioteca {
  documentos: DocumentoBiblioteca[];
}

/* ------------------------------------------------------------------ */
/* Bitácora de obra                                                    */
/* ------------------------------------------------------------------ */

export type ClimaObra =
  | "SOLEADO"
  | "NUBLADO"
  | "LLUVIA"
  | "TORMENTA"
  | "VIENTO"
  | "CALOR_EXTREMO";

/**
 * Parte diario de obra. Registra lo que pasó en el día: clima, personal,
 * actividades, incidencias y visitas. Es el respaldo documental de la
 * ejecución y la base para reclamar adicionales.
 */
export interface EntradaBitacora {
  id: string;
  fecha: string;
  clima: ClimaObra;
  /** Temperatura en °C, opcional. */
  temperatura?: number;
  /** Personas presentes en obra ese día. */
  personalPresente: number;
  /** Horas trabajadas en la jornada. */
  horasTrabajadas: number;
  /** Actividades / órdenes de trabajo ejecutadas. */
  actividades: string;
  /** Incidencias, atrasos o notas de reclamo. */
  incidencias?: string;
  /** Visitas recibidas (inspección, comitente, etc.). */
  visita?: string;
  /** Responsable técnico que firma la entrada. */
  responsable: string;
  /** Avance declarado del día, 0..1. */
  avance: number;
}

export interface DatosBitacora {
  entradas: EntradaBitacora[];
}

/* ------------------------------------------------------------------ */
/* Contratos                                                           */
/* ------------------------------------------------------------------ */

export type TipoContrato = "CLIENTE" | "SUBCONTRATO" | "PROVEEDOR" | "SERVICIOS" | "ALQUILER";

export type EstadoContrato = "BORRADOR" | "ACTIVO" | "SUSPENDIDO" | "FINALIZADO" | "RESCINDIDO";

/**
 * Contrato de obra: el del comitente, los subcontratos y los acuerdos con
 * proveedores o servicios. Es la pieza legal que respalda los certificados y
 * los pagos registrados en Finanzas.
 */
export interface Contrato {
  id: string;
  /** Número visible, p. ej. "CT-2026-001". */
  numero: string;
  titulo: string;
  tipo: TipoContrato;
  /** Contraparte: comitente, subcontratista, proveedor… */
  contraparte: string;
  /** Monto del contrato, en Gs. */
  monto: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoContrato;
  /** Fondo de garantía o retención, fracción (0.05 = 5%). */
  retencion: number;
  nota?: string;
}

export interface DatosContratos {
  contratos: Contrato[];
}

/* ------------------------------------------------------------------ */
/* Colecciones editables                                                */
/* ------------------------------------------------------------------ */

export type Coleccion =
  | "presupuesto"
  | "cronograma"
  | "finanzas"
  | "gente"
  | "materiales"
  | "pedidos"
  | "biblioteca"
  | "bitacora"
  | "contratos";

export const COLECCIONES: Coleccion[] = [
  "presupuesto",
  "cronograma",
  "finanzas",
  "gente",
  "materiales",
  "pedidos",
  "biblioteca",
  "bitacora",
  "contratos",
];
