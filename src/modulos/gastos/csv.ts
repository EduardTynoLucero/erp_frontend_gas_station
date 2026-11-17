'use client';

/** Exporta a CSV todos los gastos del filtro (no solo la página visible), como el diseño original. */
import { api, pedir } from '@/api/cliente';
import type { ConsultaGastos, GastoResumen } from '@/api/tipos';
import { ESTADOS } from '@/componentes/ui/insignia';
import { descargarCsv } from '@/lib/csv';
import { nombreProveedor, ORIGEN_CORTO } from './etiquetas';

export async function exportarCsv(consulta: Omit<ConsultaGastos, 'pagina' | 'porPagina'>): Promise<number> {
  const filas: GastoResumen[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await pedir(api.GET('/api/v1/gastos', { params: { query: { ...consulta, pagina, porPagina: 100 } } }));
    filas.push(...r.data);
    if (pagina >= r.paginacion.totalPaginas) break;
  }
  descargarCsv('gastos.csv', [
    ['Folio', 'Fecha', 'Estación', 'Centro de costo', 'Categoría', 'Subcategoría', 'Proveedor', 'Descripción', 'Documento', 'Estado', 'Origen', 'Moneda', 'Monto', 'IVA', 'Monto GTQ'],
    ...filas.map((g) => [
      g.folio,
      g.fecha,
      g.estacion.codigo,
      g.centroCosto.codigo,
      g.categoria.nombre,
      g.subcategoria,
      nombreProveedor(g.proveedor),
      g.descripcion,
      g.documento.tipo === 'Sin documento' ? 'Sin documento' : `${g.documento.tipo} ${g.documento.serie}-${g.documento.numero}`,
      ESTADOS[g.estado].texto,
      ORIGEN_CORTO[g.origen],
      g.moneda.codigo,
      g.monto,
      g.iva,
      g.montoFuncional,
    ]),
  ]);
  return filas.length;
}
