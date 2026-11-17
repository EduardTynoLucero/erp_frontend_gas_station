'use client';

/** Proveedores con sus gastos, lo pagado y lo por pagar; alta, edición y activar/desactivar (permiso «catalogos»). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type ProveedoresPantalla = components['schemas']['ProveedoresPantalla'];
export type ProveedorDetalle = components['schemas']['ProveedorDetalle'];
export type CuerpoProveedor = components['schemas']['ProveedorDatosInput'];

export function useProveedoresPantalla(estacionId: string | undefined, buscar: string) {
  const query: { estacionId?: string; buscar?: string } = {};
  if (estacionId) query.estacionId = estacionId;
  if (buscar.trim()) query.buscar = buscar.trim();
  return useQuery({
    queryKey: ['proveedores', 'pantalla', query],
    queryFn: async () => (await pedir(api.GET('/api/v1/proveedores', { params: { query } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['proveedores'] }),
      // Los formularios de gastos, contratos y recurrentes ofrecen los proveedores activos
      qc.invalidateQueries({ queryKey: ['gastos', 'catalogos'] }),
      qc.invalidateQueries({ queryKey: ['contratos'] }),
      qc.invalidateQueries({ queryKey: ['recurrentes'] }),
    ]);
}

export function useGuardarProveedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string | null; cuerpo: CuerpoProveedor }) =>
      id
        ? pedir(api.PUT('/api/v1/proveedores/{id}', { params: { path: { id } }, body: cuerpo }))
        : pedir(api.POST('/api/v1/proveedores', { body: cuerpo })),
    onSuccess: () => invalidar(),
  });
}

export function useEstadoProveedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      pedir(api.POST('/api/v1/proveedores/{id}/estado', { params: { path: { id } }, body: { activo } })),
    onSuccess: () => invalidar(),
  });
}
