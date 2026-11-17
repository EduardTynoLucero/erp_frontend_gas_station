'use client';

/**
 * Hallazgos de los reportes: riesgos registrados a mano o generados al analizar los reportes del ETL ya cargados.
 * Cambian de estado y su pérdida se puede registrar como gasto por autorizar.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Hallazgos = components['schemas']['Hallazgos'];
export type Hallazgo = components['schemas']['Hallazgo'];
export type EstadoHallazgo = Hallazgo['estado'];
export type CuerpoNuevoHallazgo = components['schemas']['NuevoHallazgoInput'];
export type CuerpoGastoDeHallazgo = components['schemas']['GastoDeHallazgoInput'];
export type AnalisisDeReportes = components['schemas']['AnalisisDeReportes'];

export function useHallazgos(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['hallazgos', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/hallazgos', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useInvalidar(conGastos = false) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['hallazgos'] }),
      qc.invalidateQueries({ queryKey: ['contadores'] }),
      ...(conGastos ? [qc.invalidateQueries({ queryKey: ['gastos'] }), qc.invalidateQueries({ queryKey: ['presupuestos'] })] : []),
    ]);
}

export function useRegistrarHallazgo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (cuerpo: CuerpoNuevoHallazgo) => pedir(api.POST('/api/v1/hallazgos', { body: cuerpo })),
    onSuccess: invalidar,
  });
}

export function useAnalizarReportes() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (periodo: string) => pedir(api.POST('/api/v1/hallazgos/analizar', { body: periodo ? { periodo } : {} })),
    onSuccess: invalidar,
  });
}

export function useEstadoHallazgo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoHallazgo }) =>
      pedir(api.POST('/api/v1/hallazgos/{id}/estado', { params: { path: { id } }, body: { estado } })),
    onSuccess: invalidar,
  });
}

export function useGastoDeHallazgo() {
  const invalidar = useInvalidar(true);
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: CuerpoGastoDeHallazgo }) =>
      pedir(api.POST('/api/v1/hallazgos/{id}/gasto', { params: { path: { id } }, body: cuerpo })),
    onSuccess: invalidar,
  });
}
