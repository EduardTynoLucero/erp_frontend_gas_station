'use client';

/** Indicadores gerenciales: todas las cifras las calcula el backend (GET /api/v1/indicadores). */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Indicadores = components['schemas']['Indicadores'];

export function useIndicadores(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['indicadores', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/indicadores', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
