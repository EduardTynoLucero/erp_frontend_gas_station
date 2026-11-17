'use client';

/** Plantillas de gastos recurrentes: lectura con el horizonte, alta, edición, pausar/activar y generar gastos. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type RecurrentesPantalla = components['schemas']['RecurrentesPantalla'];
export type RecurrenteDetalle = components['schemas']['RecurrenteDetalle'];
export type CuerpoRecurrente = components['schemas']['RecurrenteDatosInput'];
export type Frecuencia = CuerpoRecurrente['frecuencia'];

export function useRecurrentesPantalla(estacionId: string | undefined, horizonte: number) {
  return useQuery({
    queryKey: ['recurrentes', 'pantalla', estacionId ?? 'todas', horizonte],
    queryFn: async () =>
      (await pedir(api.GET('/api/v1/recurrentes', { params: { query: estacionId ? { estacionId, horizonte } : { horizonte } } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useGuardarRecurrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string | null; cuerpo: CuerpoRecurrente }) =>
      id ? pedir(api.PUT('/api/v1/recurrentes/{id}', { params: { path: { id } }, body: cuerpo })) : pedir(api.POST('/api/v1/recurrentes', { body: cuerpo })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurrentes'] }),
  });
}

export function useEstadoRecurrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      pedir(api.POST('/api/v1/recurrentes/{id}/estado', { params: { path: { id } }, body: { activo } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurrentes'] }),
  });
}

/** Los gastos generados quedan en autorización: se refrescan también gastos y contadores. */
export function useGenerarRecurrentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => pedir(api.POST('/api/v1/recurrentes/generar', { body: { ids } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['recurrentes'] }),
        qc.invalidateQueries({ queryKey: ['gastos'] }),
        qc.invalidateQueries({ queryKey: ['contadores'] }),
      ]),
  });
}
