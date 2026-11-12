'use client';

/**
 * Carga de reportes al ETL (/api/v1/ingesta). Mientras el servicio ETL revisa o carga un archivo, la pantalla
 * pregunta cada 2 segundos; sin nada en curso, cada 30.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi, type ErrorCampo, irAlInicioDeSesion, pedir, renovarSesion } from '@/api/cliente';
import type { components, paths, ResumenIngesta, SubidaIngesta } from '@/api/tipos';

export const clavesIngesta = {
  todo: ['ingesta'] as const,
  resumen: ['ingesta', 'resumen'] as const,
  subida: (id: string) => ['ingesta', 'subida', id] as const,
};

/** El servicio ETL todavía trabaja en la subida (revisándola o cargándola) */
export function enCurso(s: Pick<SubidaIngesta, 'estado' | 'carga'>): boolean {
  const activo = (e: string) => e === 'PENDIENTE' || e === 'EN_PROCESO';
  return activo(s.estado) || (s.carga !== null && activo(s.carga.estado));
}

export function useResumenIngesta() {
  return useQuery({
    queryKey: clavesIngesta.resumen,
    queryFn: async () => (await pedir(api.GET('/api/v1/ingesta/'))).data,
    refetchInterval: (q) => (q.state.data?.subidas.some(enCurso) ? 2_000 : 30_000),
  });
}

/** La subida con su vista previa completa (incidencias, cuadre, productos) */
export function useSubida(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: clavesIngesta.subida(id),
    queryFn: async () => (await pedir(api.GET('/api/v1/ingesta/subidas/{id}', { params: { path: { id } } }))).data,
    enabled: habilitado,
    refetchInterval: (q) => (q.state.data && enCurso(q.state.data) ? 2_000 : false),
  });
}

export type TicketsDePrevia = components['schemas']['TicketsDePrevia'];
export type TicketDePrevia = components['schemas']['TicketDePrevia'];
export type ConsultaTickets = NonNullable<paths['/api/v1/ingesta/subidas/{id}/tickets']['get']['parameters']['query']>;
export type FiltroTickets = NonNullable<ConsultaTickets['filtro']>;

/**
 * Los tickets del archivo comparados con la base (la tabla del panel del ETL), paginados en el servidor. Lo anterior se
 * queda a la vista mientras llega otra página o cambia un filtro. `version` cambia cuando el servicio ETL vuelve a
 * comparar el archivo o lo carga: así la tabla se vuelve a pedir sola.
 */
export function useTicketsDePrevia(id: string, consulta: ConsultaTickets, version: string, habilitado: boolean) {
  return useQuery({
    queryKey: [...clavesIngesta.subida(id), 'tickets', version, consulta],
    queryFn: async () => (await pedir(api.GET('/api/v1/ingesta/subidas/{id}/tickets', { params: { path: { id }, query: consulta } }))).data,
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useAccionSubida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: 'cargar' | 'descartar' }) =>
      accion === 'cargar'
        ? pedir(api.POST('/api/v1/ingesta/subidas/{id}/cargar', { params: { path: { id } } }))
        : pedir(api.POST('/api/v1/ingesta/subidas/{id}/descartar', { params: { path: { id } } })),
    onSuccess: (r) => {
      qc.setQueryData(clavesIngesta.subida(r.data.id), r.data);
      void qc.invalidateQueries({ queryKey: clavesIngesta.todo });
    },
  });
}

interface Problema {
  detail?: string;
  codigo?: string;
  errores?: ErrorCampo[];
  solicitudId?: string;
}

function enviar(archivo: File, url: string, alProgreso: (pct: number) => void): Promise<XMLHttpRequest> {
  return new Promise((listo, falla) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Archivo-Nombre', encodeURIComponent(archivo.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && alProgreso(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => listo(xhr);
    xhr.onerror = () => falla(new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revise que el backend esté encendido (npm run dev en backend/).'));
    xhr.send(archivo);
  });
}

/**
 * Sube el archivo tal cual (con XMLHttpRequest para mostrar el avance). Si el token de acceso venció, renueva la
 * sesión una vez y repite, igual que el cliente de la API.
 */
export async function subirArchivo(archivo: File, estacion: string | undefined, alProgreso: (pct: number) => void): Promise<SubidaIngesta> {
  const url = `/api/v1/ingesta/subidas${estacion ? `?estacion=${encodeURIComponent(estacion)}` : ''}`;
  let xhr = await enviar(archivo, url, alProgreso);
  if (xhr.status === 401) {
    if (!(await renovarSesion())) {
      irAlInicioDeSesion();
      throw new ErrorApi(401, 'SESION_VENCIDA', 'Su sesión terminó. Inicie sesión de nuevo.');
    }
    xhr = await enviar(archivo, url, alProgreso);
  }
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(xhr.responseText);
  } catch {
    // respuesta sin JSON
  }
  if (xhr.status >= 200 && xhr.status < 300) return (cuerpo as { data: SubidaIngesta }).data;
  const p = (cuerpo ?? {}) as Problema;
  throw new ErrorApi(xhr.status, p.codigo ?? 'ERROR', p.detail ?? `No se pudo subir el archivo (HTTP ${xhr.status}).`, p.errores ?? [], p.solicitudId);
}

export type { ResumenIngesta, SubidaIngesta };
