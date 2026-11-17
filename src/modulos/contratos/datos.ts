'use client';

/** Contratos y servicios por estación: lectura con vencimientos, alta, edición y renovación. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type ContratosPantalla = components['schemas']['ContratosPantalla'];
export type ContratoDetalle = components['schemas']['ContratoDetalle'];
export type CuerpoContrato = components['schemas']['ContratoDatosInput'];

export function useContratosPantalla(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['contratos', 'pantalla', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/contratos', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  // Los contratos por vencer también cuentan en las alertas
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['contratos'] }), qc.invalidateQueries({ queryKey: ['contadores'] })]);
}

export function useGuardarContrato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string | null; cuerpo: CuerpoContrato }) =>
      id ? pedir(api.PUT('/api/v1/contratos/{id}', { params: { path: { id } }, body: cuerpo })) : pedir(api.POST('/api/v1/contratos', { body: cuerpo })),
    onSuccess: () => invalidar(),
  });
}

export function useRenovarContrato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, meses }: { id: string; meses: number }) => pedir(api.POST('/api/v1/contratos/{id}/renovar', { params: { path: { id } }, body: { meses } })),
    onSuccess: () => invalidar(),
  });
}
