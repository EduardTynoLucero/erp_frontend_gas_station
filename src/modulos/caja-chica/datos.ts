'use client';

/** Caja chica: cajas con saldo y movimientos, abrir y editar un fondo, desembolsos y liquidación con reposición. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type CajasChicas = components['schemas']['CajasChicas'];
export type CajaChica = components['schemas']['CajaChica'];
export type MovimientoCaja = CajaChica['movimientos'][number];
export type CuerpoAbrirCaja = components['schemas']['AbrirCajaChicaInput'];
export type CuerpoEditarCaja = components['schemas']['EditarCajaChicaInput'];
export type CuerpoDesembolso = components['schemas']['DesembolsoCajaInput'];

export function useCajasChicas(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['caja-chica', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/caja-chica', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useGuardarCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: null; cuerpo: CuerpoAbrirCaja } | { id: string; cuerpo: CuerpoEditarCaja }) =>
      p.id === null
        ? pedir(api.POST('/api/v1/caja-chica', { body: p.cuerpo }))
        : pedir(api.PUT('/api/v1/caja-chica/{id}', { params: { path: { id: p.id } }, body: p.cuerpo })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-chica'] }),
  });
}

/** Desembolsos y liquidaciones son gastos reales: se refrescan también gastos y contadores. */
function useInvalidar() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['caja-chica'] }),
      qc.invalidateQueries({ queryKey: ['gastos'] }),
      qc.invalidateQueries({ queryKey: ['contadores'] }),
      qc.invalidateQueries({ queryKey: ['presupuestos'] }),
    ]);
}

export function useDesembolso() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: CuerpoDesembolso }) =>
      pedir(api.POST('/api/v1/caja-chica/{id}/desembolsos', { params: { path: { id } }, body: cuerpo })),
    onSuccess: invalidar,
  });
}

export function useLiquidarCaja() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => pedir(api.POST('/api/v1/caja-chica/{id}/liquidar', { params: { path: { id } } })),
    onSuccess: invalidar,
  });
}
