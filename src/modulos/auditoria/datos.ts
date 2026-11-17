'use client';

/** Bitácora de operaciones (solo lectura), por páginas y con filtros; exportación a CSV recorriendo las páginas. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components, paths } from '@/api/tipos';
import { descargarCsv } from '@/lib/csv';
import { fechaHora } from '@/lib/formato';

export type Bitacora = components['schemas']['Bitacora'];
export type EventoBitacora = components['schemas']['EventoBitacora'];
export type ConsultaBitacora = NonNullable<paths['/api/v1/auditoria']['get']['parameters']['query']>;

export function useBitacora(consulta: ConsultaBitacora) {
  return useQuery({
    queryKey: ['auditoria', consulta],
    queryFn: async () => (await pedir(api.GET('/api/v1/auditoria', { params: { query: consulta } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

/** Exporta todos los eventos del filtro (no solo la página visible). Devuelve cuántos exportó. */
export async function exportarBitacora(consulta: Omit<ConsultaBitacora, 'pagina' | 'porPagina'>): Promise<number> {
  const filas: EventoBitacora[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await pedir(api.GET('/api/v1/auditoria', { params: { query: { ...consulta, pagina, porPagina: 200 } } }));
    filas.push(...r.data.eventos);
    if (pagina >= r.data.paginacion.totalPaginas) break;
  }
  descargarCsv('bitacora.csv', [
    ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Módulo', 'Detalle', 'Referencias'],
    ...filas.map((a) => [fechaHora(a.ocurridoEn), a.usuario.nombre, a.accion, a.entidad, a.modulo, a.detalle, a.referencias.join(' ')]),
  ]);
  return filas.length;
}
