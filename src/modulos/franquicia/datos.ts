'use client';

/** Gastos de franquicia: todas las cifras las calcula el backend (GET /api/v1/franquicia). */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Franquicia = components['schemas']['GastosDeFranquicia'];

export function useFranquicia(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['franquicia', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/franquicia', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
