'use client';

/** Reporte de gastos por eje y por mes: agrupaciones y totales los calcula el backend (GET /api/v1/reportes). */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components, paths } from '@/api/tipos';

export type Reporte = components['schemas']['ReporteDeGastos'];
export type Eje = Reporte['eje'];
export type EstadosReporte = Reporte['estados'];
type Consulta = NonNullable<paths['/api/v1/reportes']['get']['parameters']['query']>;

export function useReporte(filtro: { eje: Eje; periodo: string; estados: EstadosReporte; prorrateo: boolean; estacionId: string | undefined }) {
  const query: Consulta = {
    eje: filtro.eje,
    estados: filtro.estados,
    prorrateo: filtro.prorrateo ? 'true' : 'false',
    ...(filtro.periodo ? { periodo: filtro.periodo } : {}),
    ...(filtro.estacionId ? { estacionId: filtro.estacionId } : {}),
  };
  return useQuery({
    queryKey: ['reportes', query],
    queryFn: async () => (await pedir(api.GET('/api/v1/reportes', { params: { query } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
