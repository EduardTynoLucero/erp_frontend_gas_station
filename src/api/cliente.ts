'use client';

/**
 * Cliente HTTP tipado (openapi-fetch + tipos generados del backend) para los componentes del navegador.
 *
 * - Llama a /api/v1/* en el mismo origen: Next.js lo reenvía al backend y las cookies httpOnly viajan solas.
 * - Si la API responde 401 (token de acceso vencido), renueva la sesión una sola vez con /auth/refresh (aunque
 *   haya varias peticiones a la vez) y repite la petición. Si no se puede renovar, lleva al inicio de sesión.
 * - Los errores application/problem+json se convierten en ErrorApi con `codigo` y `errores` por campo.
 */
import createClient from 'openapi-fetch';
import type { paths } from './esquema';

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly errores: ErrorCampo[] = [],
    readonly solicitudId?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

let renovacion: Promise<boolean> | null = null;

/** Renueva la sesión una sola vez aunque la pidan varias peticiones a la vez. */
export function renovarSesion(): Promise<boolean> {
  renovacion ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => {
        renovacion = null;
      }, 0);
    });
  return renovacion;
}

let yendoAlInicio = false;

/**
 * Lleva al inicio de sesión una sola vez: si varias consultas (o el refresco periódico) fallan juntas, no se repite la
 * navegación. En /login no hace nada: ahí ya está el formulario.
 */
export function irAlInicioDeSesion(): void {
  if (yendoAlInicio || typeof window === 'undefined' || window.location.pathname.startsWith('/login')) return;
  yendoAlInicio = true;
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?destino=${encodeURIComponent(destino)}&motivo=sesion`);
}

async function fetchConSesion(peticion: Request): Promise<Response> {
  // Sin sesión ya no sale ninguna consulta (tampoco los refrescos periódicos) mientras se va al inicio de sesión
  if (yendoAlInicio) return new Response(null, { status: 401 });
  const respaldo = peticion.clone();
  const respuesta = await fetch(peticion);
  if (respuesta.status !== 401 || new URL(peticion.url).pathname.startsWith('/api/v1/auth/')) return respuesta;
  if (await renovarSesion()) return fetch(respaldo);
  irAlInicioDeSesion();
  return respuesta;
}

export const api = createClient<paths>({ baseUrl: '', fetch: fetchConSesion, credentials: 'same-origin' });

interface Problema {
  detail?: string;
  codigo?: string;
  errores?: ErrorCampo[];
  solicitudId?: string;
}

/**
 * Espera una llamada de `api` y devuelve sus datos, o lanza ErrorApi. Uso:
 *   const { data } = await pedir(api.GET('/api/v1/gastos', { params: { query } }))
 */
export async function pedir<T>(llamada: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let resultado: { data?: T; error?: unknown; response: Response };
  try {
    resultado = await llamada;
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revise que el backend esté encendido (npm run dev en backend/).');
  }
  const { data, error, response } = resultado;
  if (!response.ok || error !== undefined) {
    const p = (error ?? {}) as Problema;
    throw new ErrorApi(
      response.status,
      p.codigo ?? 'ERROR',
      p.detail ?? `La operación no se pudo completar (HTTP ${response.status}).`,
      p.errores ?? [],
      p.solicitudId,
    );
  }
  return data as T;
}

export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
