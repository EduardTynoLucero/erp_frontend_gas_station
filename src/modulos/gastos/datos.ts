'use client';

/**
 * Acceso a la API de gastos con TanStack Query. Las listas se refrescan solas cada 30 s y al volver a la
 * ventana; cada acción invalida la caché de gastos, así los botones (que dependen de `acciones`) se actualizan
 * enseguida con lo que diga el backend.
 */
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { ConsultaGastos, CuerpoActualizarGasto, CuerpoGasto, CuerpoPago, GastoDetalle } from '@/api/tipos';

export const clavesGastos = {
  todo: ['gastos'] as const,
  lista: (q: ConsultaGastos) => ['gastos', 'lista', q] as const,
  paginada: (q: ConsultaGastos) => ['gastos', 'paginada', q] as const,
  detalle: (id: string) => ['gastos', 'detalle', id] as const,
  catalogos: ['gastos', 'catalogos'] as const,
};

const REFRESCO_LISTAS = 30_000;

export function useCatalogos(habilitado = true) {
  return useQuery({
    queryKey: clavesGastos.catalogos,
    queryFn: async () => (await pedir(api.GET('/api/v1/gastos/catalogos'))).data,
    staleTime: 5 * 60_000,
    enabled: habilitado,
  });
}

export function useListaGastos(q: ConsultaGastos, opciones: { habilitado?: boolean; refresco?: number } = {}) {
  return useQuery({
    queryKey: clavesGastos.lista(q),
    queryFn: () => pedir(api.GET('/api/v1/gastos', { params: { query: q } })),
    placeholderData: keepPreviousData,
    refetchInterval: opciones.refresco ?? REFRESCO_LISTAS,
    enabled: opciones.habilitado ?? true,
  });
}

/** Lista con "Mostrar más": páginas de 50 que se van acumulando. */
export function useGastosPaginados(q: Omit<ConsultaGastos, 'pagina'>) {
  return useInfiniteQuery({
    queryKey: clavesGastos.paginada(q),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => pedir(api.GET('/api/v1/gastos', { params: { query: { ...q, pagina: pageParam } } })),
    getNextPageParam: (ultima) => (ultima.paginacion.pagina < ultima.paginacion.totalPaginas ? ultima.paginacion.pagina + 1 : undefined),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESCO_LISTAS,
  });
}

export function useGasto(id: string, habilitado = true) {
  return useQuery({
    queryKey: clavesGastos.detalle(id),
    queryFn: async () => (await pedir(api.GET('/api/v1/gastos/{id}', { params: { path: { id } } }))).data,
    refetchInterval: 15_000,
    enabled: habilitado && id !== '',
  });
}

function useInvalidarGastos() {
  const qc = useQueryClient();
  return (detalle?: GastoDetalle) => {
    if (detalle) qc.setQueryData(clavesGastos.detalle(detalle.id), detalle);
    return qc.invalidateQueries({ queryKey: clavesGastos.todo });
  };
}

/** Crea un gasto. `clave` es la Idempotency-Key: la misma en todos los reintentos de este formulario. */
export function useCrearGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: ({ cuerpo, clave }: { cuerpo: CuerpoGasto; clave: string }) =>
      pedir(api.POST('/api/v1/gastos', { body: cuerpo, params: { header: { 'idempotency-key': clave } } })),
    onSuccess: (r) => invalidar(r.data),
  });
}

export function useActualizarGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: CuerpoActualizarGasto }) =>
      pedir(api.PUT('/api/v1/gastos/{id}', { params: { path: { id } }, body: cuerpo })),
    onSuccess: (r) => invalidar(r.data),
  });
}

export function useEliminarGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: (id: string) => pedir(api.DELETE('/api/v1/gastos/{id}', { params: { path: { id } } })),
    onSuccess: () => invalidar(),
  });
}

export type AccionFlujo =
  | { tipo: 'enviar'; id: string }
  | { tipo: 'reabrir'; id: string }
  | { tipo: 'aprobar'; id: string; comentario?: string }
  | { tipo: 'rechazar'; id: string; comentario: string }
  | { tipo: 'pagar'; id: string; pago: CuerpoPago };

/** Acciones del flujo de autorización y pago. Devuelve el gasto actualizado y el mensaje del backend. */
export function useAccionGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: (a: AccionFlujo) => {
      const path = { id: a.id };
      switch (a.tipo) {
        case 'enviar':
          return pedir(api.POST('/api/v1/gastos/{id}/enviar', { params: { path } }));
        case 'reabrir':
          return pedir(api.POST('/api/v1/gastos/{id}/reabrir', { params: { path } }));
        case 'aprobar':
          return pedir(api.POST('/api/v1/gastos/{id}/aprobar', { params: { path }, body: { comentario: a.comentario ?? '' } }));
        case 'rechazar':
          return pedir(api.POST('/api/v1/gastos/{id}/rechazar', { params: { path }, body: { comentario: a.comentario } }));
        case 'pagar':
          return pedir(api.POST('/api/v1/gastos/{id}/pagar', { params: { path }, body: a.pago }));
      }
    },
    onSuccess: (r) => invalidar(r.data),
  });
}
