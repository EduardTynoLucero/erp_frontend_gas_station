'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { FiltrosVentas } from '@/api/tipos';

/** Cada cuánto se pregunta si el servicio ETL publicó una carga nueva (solo con la pestaña visible) */
export const REVISAR_CARGAS_MS = 30_000;

/**
 * Opciones del filtro. Se vuelven a leer cada 30 s mientras la pestaña está visible (y al enfocar la ventana): cuando el
 * servicio ETL publica una carga, cambia `ultimaCarga` y el dashboard se renueva solo, sin recargar la página.
 */
export function useOpcionesVentas() {
  return useQuery({
    queryKey: ['dashboards', 'ventas', 'opciones'],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/ventas/opciones'))).data,
    staleTime: REVISAR_CARGAS_MS,
    refetchInterval: REVISAR_CARGAS_MS,
  });
}

/** El número de la última carga entra en la clave: cuando el ETL publica una carga, la consulta se repite sola. */
export function useDashboardVentas(filtros: FiltrosVentas | null, ultimaCarga: number | null | undefined) {
  return useQuery({
    queryKey: ['dashboards', 'ventas', filtros, ultimaCarga],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/ventas', { params: { query: filtros ?? {} } }))).data,
    enabled: filtros !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
