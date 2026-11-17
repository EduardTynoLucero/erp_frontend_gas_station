'use client';

/** Empresas y estaciones: la empresa, cada estación con su gasto, ventas y turnos, y sus altas y ediciones. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type EmpresaYEstaciones = components['schemas']['EmpresaYEstaciones'];
export type EstacionAdministrada = components['schemas']['EstacionAdministrada'];
export type CuerpoEstacionNueva = components['schemas']['NuevaEstacionInput'];
export type CuerpoEstacionEditada = components['schemas']['EditarEstacionInput'];
export type CuerpoEmpresa = components['schemas']['EmpresaEntradaInput'];

export function useEmpresaYEstaciones() {
  return useQuery({
    queryKey: ['estaciones'],
    queryFn: async () => (await pedir(api.GET('/api/v1/estaciones'))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

/** Las estaciones y la empresa salen en el encabezado, el menú y los catálogos de otras pantallas. */
function useInvalidar() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['estaciones'] }),
      qc.invalidateQueries({ queryKey: ['usuarios'] }),
      qc.invalidateQueries({ queryKey: ['catalogos'] }),
      qc.invalidateQueries({ queryKey: ['gastos'] }),
      qc.invalidateQueries({ queryKey: ['contadores'] }),
    ]);
    router.refresh();
  };
}

export function useGuardarEstacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { nueva: true; cuerpo: CuerpoEstacionNueva } | { nueva: false; id: string; cuerpo: CuerpoEstacionEditada }) =>
      v.nueva
        ? pedir(api.POST('/api/v1/estaciones', { body: v.cuerpo }))
        : pedir(api.PUT('/api/v1/estaciones/{id}', { params: { path: { id: v.id } }, body: v.cuerpo })),
    onSuccess: () => invalidar(),
  });
}

export function useGuardarEmpresa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (cuerpo: CuerpoEmpresa) => pedir(api.PUT('/api/v1/estaciones/empresa', { body: cuerpo })),
    onSuccess: () => invalidar(),
  });
}
