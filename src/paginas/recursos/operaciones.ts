/**
 * Operaciones puras sobre las colecciones de Recursos: materiales, pedidos y
 * biblioteca técnica. Igual que el resto del dominio, no mutan: devuelven
 * copias, de modo que `useColeccion` pueda comparar y persistir.
 */

import { hoyIso } from "@/dominio/formato";
import type {
  DatosBiblioteca,
  DatosMateriales,
  DatosPedidos,
  DocumentoBiblioteca,
  EstadoDocumento,
  ItemPedido,
  Material,
  Pedido,
} from "@/dominio/tipos";

/* ------------------------------------------------------------------ */
/* Materiales                                                          */
/* ------------------------------------------------------------------ */

export function addMaterial(datos: DatosMateriales, m: Material): DatosMateriales {
  return { ...datos, materiales: [...datos.materiales, m] };
}

export function patchMaterial(datos: DatosMateriales, id: string, patch: Partial<Material>): DatosMateriales {
  return {
    ...datos,
    materiales: datos.materiales.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function removeMaterial(datos: DatosMateriales, id: string): DatosMateriales {
  return { ...datos, materiales: datos.materiales.filter((m) => m.id !== id) };
}

/** Un material está crítico si su stock cayó al mínimo o por debajo. */
export function stockCritico(m: Material): boolean {
  return m.stockMinimo > 0 && m.stock <= m.stockMinimo;
}

/** Valor del inventario en acopio, en Gs. */
export function valorAcopio(datos: DatosMateriales): number {
  return datos.materiales.reduce((a, m) => a + m.stock * m.precioReferencia, 0);
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export function addPedido(datos: DatosPedidos, p: Pedido): DatosPedidos {
  return { ...datos, pedidos: [...datos.pedidos, p] };
}

export function patchPedido(datos: DatosPedidos, id: string, patch: Partial<Pedido>): DatosPedidos {
  return {
    ...datos,
    pedidos: datos.pedidos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function removePedido(datos: DatosPedidos, id: string): DatosPedidos {
  return { ...datos, pedidos: datos.pedidos.filter((p) => p.id !== id) };
}

export function totalItemPedido(item: ItemPedido): number {
  return item.cantidad * item.precioUnitario;
}

export function totalPedido(pedido: Pedido): number {
  return pedido.items.reduce((a, i) => a + totalItemPedido(i), 0);
}

/** Cantidad todavía no recibida de una línea. */
export function pendienteItem(item: ItemPedido): number {
  return Math.max(0, item.cantidad - item.cantidadRecibida);
}

/** Un pedido está abierto si todavía no se recibió ni se canceló. */
export function pedidoAbierto(pedido: Pedido): boolean {
  return pedido.estado !== "RECIBIDO" && pedido.estado !== "CANCELADO";
}

export function pedidosEnTransito(datos: DatosPedidos): number {
  return datos.pedidos.filter((p) => p.estado === "EN_TRANSITO" || p.estado === "ENVIADO").length;
}

export function entregasProximas(datos: DatosPedidos, dias = 7): number {
  const hoy = hoyIso();
  return datos.pedidos.filter(
    (p) => pedidoAbierto(p) && p.fechaEntrega >= hoy && p.fechaEntrega <= sumar(dias),
  ).length;
}

function sumar(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Biblioteca                                                          */
/* ------------------------------------------------------------------ */

export function addDocumento(datos: DatosBiblioteca, d: DocumentoBiblioteca): DatosBiblioteca {
  return { ...datos, documentos: [...datos.documentos, d] };
}

export function patchDocumento(datos: DatosBiblioteca, id: string, patch: Partial<DocumentoBiblioteca>): DatosBiblioteca {
  return {
    ...datos,
    documentos: datos.documentos.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  };
}

export function removeDocumento(datos: DatosBiblioteca, id: string): DatosBiblioteca {
  return { ...datos, documentos: datos.documentos.filter((d) => d.id !== id) };
}

/** Deriva el estado real: un documento con vencimiento pasado está vencido. */
export function estadoDocumento(d: DocumentoBiblioteca): EstadoDocumento {
  if (d.vence && d.vence < hoyIso()) return "VENCIDO";
  return d.estado;
}

export function documentoVencido(d: DocumentoBiblioteca): boolean {
  return estadoDocumento(d) === "VENCIDO";
}
