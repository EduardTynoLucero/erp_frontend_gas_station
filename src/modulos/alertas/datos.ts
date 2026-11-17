'use client';

/** Alertas del control de gastos: avisos que el backend calcula al momento con los parámetros de Configuración. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Alertas = components['schemas']['Alertas'];
export type Alerta = components['schemas']['Alerta'];
export type TipoAlerta = Alerta['tipo'];

export function useAlertas(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['alertas', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/alertas', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
