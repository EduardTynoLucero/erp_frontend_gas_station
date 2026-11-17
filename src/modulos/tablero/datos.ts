'use client';

/** Tablero de gastos del mes abierto: todas las cifras las calcula el backend (GET /api/v1/tablero). */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Tablero = components['schemas']['Tablero'];

export function useTablero(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['tablero', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/tablero', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
