'use client';

/** Compras administrativas: requerimiento, cotizaciones, emisión de la orden, recepción con factura y cancelación. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Compras = components['schemas']['Compras'];
export type OrdenCompra = components['schemas']['OrdenCompra'];
export type EstadoOrden = OrdenCompra['estado'];
export type CuerpoRequerimiento = components['schemas']['RequerimientoCompraInput'];
export type CuerpoCotizacion = components['schemas']['CotizacionCompraInput'];
export type CuerpoRecepcion = components['schemas']['RecepcionCompraInput'];

export function useCompras(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['compras', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/compras', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useInvalidarCompras() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['compras'] });
}

export function useCrearRequerimiento() {
  const invalidar = useInvalidarCompras();
  return useMutation({
    mutationFn: (cuerpo: CuerpoRequerimiento) => pedir(api.POST('/api/v1/compras', { body: cuerpo })),
    onSuccess: invalidar,
  });
}

export function useAgregarCotizacion() {
  const invalidar = useInvalidarCompras();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: CuerpoCotizacion }) =>
      pedir(api.POST('/api/v1/compras/{id}/cotizaciones', { params: { path: { id } }, body: cuerpo })),
    onSuccess: invalidar,
  });
}

export function useEmitirOrden() {
  const invalidar = useInvalidarCompras();
  return useMutation({
    mutationFn: ({ id, cotizacionId }: { id: string; cotizacionId: string }) =>
      pedir(api.POST('/api/v1/compras/{id}/cotizaciones/{cotizacionId}/emitir', { params: { path: { id, cotizacionId } } })),
    onSuccess: invalidar,
  });
}

export function useCancelarCompra() {
  const invalidar = useInvalidarCompras();
  return useMutation({
    mutationFn: (id: string) => pedir(api.POST('/api/v1/compras/{id}/cancelar', { params: { path: { id } } })),
    onSuccess: invalidar,
  });
}

/** La recepción genera un gasto aprobado (cuentas por pagar): se refrescan también gastos y contadores. */
export function useRecibirCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: CuerpoRecepcion }) =>
      pedir(api.POST('/api/v1/compras/{id}/recibir', { params: { path: { id } }, body: cuerpo })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['compras'] }),
        qc.invalidateQueries({ queryKey: ['gastos'] }),
        qc.invalidateQueries({ queryKey: ['contadores'] }),
        qc.invalidateQueries({ queryKey: ['presupuestos'] }),
      ]),
  });
}
