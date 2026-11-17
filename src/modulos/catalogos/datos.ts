'use client';

/** Catálogos y centros de costo: lectura con el gasto del mes y altas/ediciones (permiso «catalogos»). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type CatalogosPantalla = components['schemas']['CatalogosPantalla'];
export type CatalogoCategoria = components['schemas']['CatalogoCategoria'];
export type CatalogoCentro = components['schemas']['CatalogoCentroCosto'];
export type CuerpoCategoriaNueva = components['schemas']['CategoriaNuevaInput'];
export type CuerpoCategoriaEditada = components['schemas']['CategoriaEditadaInput'];
export type CuerpoCentroNuevo = components['schemas']['CentroCostoNuevoInput'];
export type CuerpoCentroEditado = components['schemas']['CentroCostoEditadoInput'];

export function useCatalogosPantalla(estacionId: string | undefined) {
  return useQuery({
    queryKey: ['catalogos', 'pantalla', estacionId ?? 'todas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/catalogos', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['catalogos'] }),
      // Los formularios de gastos usan las mismas categorías y centros
      qc.invalidateQueries({ queryKey: ['gastos', 'catalogos'] }),
    ]);
}

export function useGuardarCategoria() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { nueva: true; cuerpo: CuerpoCategoriaNueva } | { nueva: false; id: string; cuerpo: CuerpoCategoriaEditada }) =>
      v.nueva
        ? pedir(api.POST('/api/v1/catalogos/categorias', { body: v.cuerpo }))
        : pedir(api.PUT('/api/v1/catalogos/categorias/{id}', { params: { path: { id: v.id } }, body: v.cuerpo })),
    onSuccess: () => invalidar(),
  });
}

export function useGuardarCentro() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { nuevo: true; cuerpo: CuerpoCentroNuevo } | { nuevo: false; id: string; cuerpo: CuerpoCentroEditado }) =>
      v.nuevo
        ? pedir(api.POST('/api/v1/catalogos/centros', { body: v.cuerpo }))
        : pedir(api.PUT('/api/v1/catalogos/centros/{id}', { params: { path: { id: v.id } }, body: v.cuerpo })),
    onSuccess: () => invalidar(),
  });
}
