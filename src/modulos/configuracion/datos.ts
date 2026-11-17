'use client';

/** Configuración: fecha y periodo, control documental, caja chica, alertas, prorrateo y niveles de autorización. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Configuracion = components['schemas']['Configuracion'];
export type CuerpoConfiguracion = components['schemas']['ConfiguracionEntradaInput'];

export function useConfiguracion() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: async () => (await pedir(api.GET('/api/v1/configuracion'))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useGuardarConfiguracion() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (cuerpo: CuerpoConfiguracion) => pedir(api.PUT('/api/v1/configuracion', { body: cuerpo })),
    onSuccess: async () => {
      // La fecha, el periodo y los topes los usan todas las pantallas; los niveles cambian el límite de los roles.
      await qc.invalidateQueries();
      router.refresh();
    },
  });
}
