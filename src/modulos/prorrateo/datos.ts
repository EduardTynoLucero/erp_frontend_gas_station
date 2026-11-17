'use client';

/** Prorrateo de los gastos de la oficina central: vista previa por criterio, aplicar y quitar el reparto de un mes. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Prorrateo = components['schemas']['Prorrateo'];
export type Criterio = Prorrateo['criterio'];

export function useProrrateo(periodo: string | undefined, criterio: Criterio | undefined) {
  return useQuery({
    queryKey: ['prorrateo', periodo ?? 'abierto', criterio ?? 'config'],
    queryFn: async () => {
      const query: { periodo?: string; criterio?: Criterio } = {};
      if (periodo) query.periodo = periodo;
      if (criterio) query.criterio = criterio;
      return (await pedir(api.GET('/api/v1/prorrateo', { params: { query } }))).data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

/** El reparto cambia gastos reales: se refrescan también gastos y contadores. */
function useInvalidar() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['prorrateo'] }),
      qc.invalidateQueries({ queryKey: ['presupuestos'] }),
      qc.invalidateQueries({ queryKey: ['gastos'] }),
      qc.invalidateQueries({ queryKey: ['contadores'] }),
    ]);
}

export function useAplicarProrrateo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (cuerpo: { periodo: string; criterio: Criterio }) => pedir(api.POST('/api/v1/prorrateo/aplicar', { body: cuerpo })),
    onSuccess: invalidar,
  });
}

export function useQuitarProrrateo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (periodo: string) => pedir(api.DELETE('/api/v1/prorrateo/{periodo}', { params: { path: { periodo } } })),
    onSuccess: invalidar,
  });
}
