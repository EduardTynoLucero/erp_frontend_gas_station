'use client';

/**
 * Datos de inventario, tanques, tomas físicas e historial de cargas (/api/v1/dashboards). Las opciones se vuelven a
 * leer cada 30 s con la pestaña visible: cuando el servicio ETL publica una carga cambia `ultimaCarga`, y como entra en
 * la clave de las consultas, el inventario y los tanques se renuevan solos.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { paths } from '@/api/tipos';

export const REVISAR_MS = 30_000;

type Respuesta<P extends keyof paths, M extends 'get' | 'post' | 'put'> = paths[P][M] extends {
  responses: { 200: { content: { 'application/json': { data: infer T } } } };
}
  ? T
  : never;

export type OpcionesOperacion = Respuesta<'/api/v1/dashboards/inventario/opciones', 'get'>;
export type Inventario = Respuesta<'/api/v1/dashboards/inventario', 'get'>;
export type NivelTanques = Respuesta<'/api/v1/dashboards/tanques', 'get'>;
export type Tanque = NivelTanques['tanques'][number];
export type ParametrosTanque = NonNullable<Tanque['parametros']>;
export type TomaFisica = Respuesta<'/api/v1/dashboards/tomas', 'get'>[number];
export type CambioBitacora = Respuesta<'/api/v1/dashboards/tomas/{id}/historial', 'get'>[number];
export type CargaEtl = Respuesta<'/api/v1/dashboards/cargas', 'get'>[number];
export type DetalleCarga = Respuesta<'/api/v1/dashboards/cargas/{id}', 'get'>;
export type FiltrosTomas = NonNullable<paths['/api/v1/dashboards/tomas']['get']['parameters']['query']>;
export type CuerpoToma = paths['/api/v1/dashboards/tomas']['post']['requestBody']['content']['application/json'];
export type CuerpoEditarToma = paths['/api/v1/dashboards/tomas/{id}']['put']['requestBody']['content']['application/json'];
export type CuerpoTanque = paths['/api/v1/dashboards/tanques']['put']['requestBody']['content']['application/json'];

const CLAVE = ['operacion'] as const;

export function useOpcionesOperacion() {
  return useQuery({
    queryKey: [...CLAVE, 'opciones'],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/inventario/opciones'))).data,
    staleTime: REVISAR_MS,
    refetchInterval: REVISAR_MS,
  });
}

export function useInventario(f: { estacion: string; desde: string; hasta: string } | null, ultimaCarga: number | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, 'inventario', f, ultimaCarga],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/inventario', { params: { query: f! } }))).data,
    enabled: f !== null,
    placeholderData: keepPreviousData,
  });
}

export function useTanques(estacion: string | null, ultimaCarga: number | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, 'tanques', estacion, ultimaCarga],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/tanques', { params: { query: { estacion: estacion! } } }))).data,
    enabled: estacion !== null,
    placeholderData: keepPreviousData,
  });
}

export function useTomas(f: FiltrosTomas | null) {
  return useQuery({
    queryKey: [...CLAVE, 'tomas', f],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/tomas', { params: { query: f! } }))).data,
    enabled: f !== null,
    placeholderData: keepPreviousData,
  });
}

export function useBitacoraToma(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE, 'bitacora', id],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/tomas/{id}/historial', { params: { path: { id: id! } } }))).data,
    enabled: id !== null,
  });
}

export function useCargas() {
  return useQuery({
    queryKey: [...CLAVE, 'cargas'],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/cargas'))).data,
    refetchInterval: REVISAR_MS,
  });
}

export function useDetalleCarga(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE, 'carga', id],
    queryFn: async () => (await pedir(api.GET('/api/v1/dashboards/cargas/{id}', { params: { path: { id: id! } } }))).data,
    enabled: id !== null,
  });
}

/** Cualquier cambio de tomas o tanques mueve el inventario, el nivel de los tanques y la lista de tomas */
function useRefrescar() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: CLAVE });
}

export function useRegistrarToma() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async (cuerpo: CuerpoToma) => (await pedir(api.POST('/api/v1/dashboards/tomas', { body: cuerpo }))).data,
    onSuccess: refrescar,
  });
}

export function useEditarToma() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ id, cuerpo }: { id: number; cuerpo: CuerpoEditarToma }) =>
      pedir(api.PUT('/api/v1/dashboards/tomas/{id}', { params: { path: { id } }, body: cuerpo })),
    onSuccess: refrescar,
  });
}

export function useAnularToma() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ id, anular }: { id: number; anular: boolean }) =>
      anular
        ? pedir(api.POST('/api/v1/dashboards/tomas/{id}/anular', { params: { path: { id } } }))
        : pedir(api.POST('/api/v1/dashboards/tomas/{id}/restaurar', { params: { path: { id } } })),
    onSuccess: refrescar,
  });
}

export function useGuardarTanques() {
  const refrescar = useRefrescar();
  return useMutation({
    // Uno por combustible, en orden: si uno falla, los anteriores ya quedaron guardados (igual que el panel)
    mutationFn: async (cambios: CuerpoTanque[]) => {
      for (const c of cambios) await pedir(api.PUT('/api/v1/dashboards/tanques', { body: c }));
    },
    onSettled: refrescar,
  });
}

// ---------------------------------------------------------------------------------------------
// Fechas

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const masDias = (t: string, n: number) => iso(new Date(new Date(`${t}T00:00:00Z`).getTime() + n * 86_400_000));

/** Hoy en la hora de esta PC, aaaa-mm-dd */
export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type RapidoInventario = '' | '7' | '30' | 'mes';
export const RAPIDOS_INVENTARIO: { valor: Exclude<RapidoInventario, ''>; texto: string }[] = [
  { valor: '7', texto: 'Últimos 7 días' },
  { valor: '30', texto: 'Últimos 30 días' },
  { valor: 'mes', texto: 'Este mes' },
];

/** Rangos rápidos, relativos al último día con datos (o a hoy si todavía no hay nada) */
export function rangoRapido(max: string, tipo: Exclude<RapidoInventario, ''>): { desde: string; hasta: string } {
  if (tipo === '30') return { desde: masDias(max, -29), hasta: max };
  if (tipo === 'mes') return { desde: `${max.slice(0, 7)}-01`, hasta: max };
  return { desde: masDias(max, -6), hasta: max };
}

/** Recordar la estación elegida en este navegador (si no se puede, no pasa nada) */
export const preferencia = {
  leer(clave: string): string | null {
    try {
      return localStorage.getItem(`erp:operacion:${clave}`);
    } catch {
      return null;
    }
  },
  guardar(clave: string, valor: string) {
    try {
      localStorage.setItem(`erp:operacion:${clave}`, valor);
    } catch {
      // sin almacenamiento
    }
  },
};
