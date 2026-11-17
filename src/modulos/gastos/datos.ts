'use client';

/**
 * Acceso a la API de gastos con TanStack Query. Las listas se refrescan solas cada 30 s y al volver a la
 * ventana; cada acción invalida la caché de gastos, así los botones (que dependen de `acciones`) se actualizan
 * enseguida con lo que diga el backend.
 */
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi, type ErrorCampo, irAlInicioDeSesion, MENSAJE_SIN_CONEXION, pedir, renovarSesion } from '@/api/cliente';
import type { components, ConsultaGastos, CuerpoActualizarGasto, CuerpoGasto, CuerpoPago, GastoDetalle, paths } from '@/api/tipos';

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

export type CuerpoComprobante = paths['/api/v1/gastos/{id}/comprobante']['post']['requestBody']['content']['application/json'];
export type Adjunto = components['schemas']['Adjunto'];

export type AccionFlujo =
  | { tipo: 'enviar'; id: string }
  | { tipo: 'reabrir'; id: string }
  | { tipo: 'aprobar'; id: string; comentario?: string }
  | { tipo: 'rechazar'; id: string; comentario: string }
  | { tipo: 'pagar'; id: string; pago: CuerpoPago }
  | { tipo: 'comprobante'; id: string; comprobante: CuerpoComprobante }
  | { tipo: 'verificar'; id: string };

/** Dirección del archivo de un comprobante (lo sirve el backend; el navegador lo abre con su sesión) */
export const urlAdjunto = (id: string) => `/api/v1/gastos/adjuntos/${encodeURIComponent(id)}`;

/** Tipos de archivo que acepta un comprobante, y su tope (los mismos del backend) */
export const TIPOS_ADJUNTO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024;

interface Problema {
  detail?: string;
  codigo?: string;
  errores?: ErrorCampo[];
  solicitudId?: string;
}

/** fetch con la misma renovación de sesión del cliente de la API: si el token venció, renueva una vez y repite */
async function conSesion(pedido: () => Promise<Response>): Promise<Response> {
  let respuesta: Response;
  try {
    respuesta = await pedido();
    if (respuesta.status === 401 && (await renovarSesion())) respuesta = await pedido();
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', MENSAJE_SIN_CONEXION);
  }
  if (respuesta.status === 401) {
    irAlInicioDeSesion();
    throw new ErrorApi(401, 'SESION_VENCIDA', 'Su sesión terminó. Inicie sesión de nuevo.');
  }
  return respuesta;
}

async function problema(respuesta: Response, porDefecto: string): Promise<ErrorApi> {
  const p = ((await respuesta.json().catch(() => null)) ?? {}) as Problema;
  return new ErrorApi(respuesta.status, p.codigo ?? 'ERROR', p.detail ?? `${porDefecto} (HTTP ${respuesta.status}).`, p.errores ?? [], p.solicitudId);
}

/**
 * Sube la foto o el PDF de un comprobante: el archivo va tal cual en el cuerpo, con su tipo y su nombre. Se guarda en
 * la base y devuelve su ficha; el id se manda después con el comprobante del gasto.
 */
export async function subirAdjunto(archivo: File): Promise<Adjunto> {
  if (!TIPOS_ADJUNTO.includes(archivo.type)) throw new ErrorApi(422, 'ADJUNTO_INVALIDO', 'Solo se aceptan fotos (JPG, PNG, WEBP, GIF, HEIC) o PDF.');
  if (archivo.size > MAX_BYTES_ADJUNTO) throw new ErrorApi(422, 'ADJUNTO_INVALIDO', 'El adjunto no puede pasar de 5 MB.');
  const respuesta = await conSesion(() =>
    fetch('/api/v1/gastos/adjuntos', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': archivo.type, 'x-archivo-nombre': encodeURIComponent(archivo.name) },
      body: archivo,
    }),
  );
  if (!respuesta.ok) throw await problema(respuesta, 'No se pudo subir el archivo');
  return ((await respuesta.json()) as { data: Adjunto }).data;
}

/** Quita un archivo que se subió y al final no se usó (se cerró el diálogo o se eligió otro) */
export async function quitarAdjunto(id: string): Promise<void> {
  await pedir(api.DELETE('/api/v1/gastos/adjuntos/{adjuntoId}', { params: { path: { adjuntoId: id } } })).catch(() => undefined);
}

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
        case 'comprobante':
          return pedir(api.POST('/api/v1/gastos/{id}/comprobante', { params: { path }, body: a.comprobante }));
        case 'verificar':
          return pedir(api.POST('/api/v1/gastos/{id}/verificar', { params: { path } }));
      }
    },
    onSuccess: (r) => invalidar(r.data),
  });
}
