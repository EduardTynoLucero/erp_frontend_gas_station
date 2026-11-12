/** Constantes de sesión compartidas por el proxy, las rutas de Next.js y los componentes de servidor. */
import type { Perfil } from '@/api/tipos';

/**
 * URL del backend (solo del lado del servidor; el navegador usa /api/v1 en el mismo origen). Se lee de API_URL en cada
 * petición, no al compilar: la misma imagen de Docker sirve para cualquier backend. Sin API_URL, en desarrollo es el
 * backend local; en producción es un error (no se puede adivinar dónde está el backend).
 */
export function urlApi(): string {
  const url = process.env.API_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta la variable de entorno API_URL: la URL del backend (por ejemplo http://erp-backend:4000).');
  }
  return 'http://localhost:4000';
}

/** Cabecera interna con el perfil que el proxy ya consultó. */
export const CABECERA_PERFIL = 'x-erp-perfil';

export function codificarPerfil(perfil: Perfil): string {
  return Buffer.from(JSON.stringify(perfil), 'utf8').toString('base64');
}

export function decodificarPerfil(crudo: string): Perfil | null {
  try {
    return JSON.parse(Buffer.from(crudo, 'base64').toString('utf8')) as Perfil;
  } catch {
    return null;
  }
}
