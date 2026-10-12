/**
 * Exportación a CSV e impresión.
 *
 * Sin backend, la única salida "oficial" de la app hacia un tercero es el
 * archivo y el papel. Este módulo centraliza esas dos salidas para que cada
 * pantalla solo declare sus columnas.
 *
 * El CSV se separa con punto y coma y lleva BOM: así Excel en español lo abre
 * en columnas sin pedir el asistente de importación.
 */

import { hoyIso } from "@/dominio/formato";

/** Escapa un valor para CSV: comillas dobles si trae separador o salto. */
function escapar(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Arma el contenido CSV (con BOM) a partir de cabeceras y filas. */
export function generarCsv(
  cabeceras: string[],
  filas: (string | number | null | undefined)[][],
): string {
  const lineas = [cabeceras, ...filas].map((fila) => fila.map(escapar).join(";"));
  return `\uFEFF${lineas.join("\r\n")}`;
}

/** Dispara la descarga de un archivo de texto en el navegador. */
export function descargarArchivo(
  nombre: string,
  contenido: string,
  tipo = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga un CSV fechado: `<nombre>-YYYY-MM-DD.csv`. */
export function descargarCsv(
  nombre: string,
  cabeceras: string[],
  filas: (string | number | null | undefined)[][],
): void {
  descargarArchivo(`${nombre}-${hoyIso()}.csv`, generarCsv(cabeceras, filas));
}

/** Abre el diálogo de impresión del navegador (y su "Guardar como PDF"). */
export function imprimir(): void {
  window.print();
}
