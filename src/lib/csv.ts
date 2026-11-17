/**
 * Descarga de un CSV desde el navegador (descargarCSV del diseño original): separado por comas, UTF-8 con BOM para que Excel
 * lea bien los acentos. Las celdas con coma, comillas o salto de línea van entre comillas.
 */
export type CeldaCsv = string | number | null | undefined;

function celda(valor: CeldaCsv): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function descargarCsv(nombre: string, filas: CeldaCsv[][]): void {
  const contenido = `﻿${filas.map((f) => f.map(celda).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
