/** Constantes de sesión compartidas por el proxy, las rutas de Next.js y los componentes de servidor. */
import type { Perfil } from '@/api/tipos';

/**
 * Direcciones públicas de producción: cada proyecto en su propio subdominio de belsoftinc.net, por HTTPS (las mismas de
 * URL_PRODUCCION en backend/src/config/entorno.ts y etl/src/config.ts).
 *   frontend  este ERP, el único sitio que abre el navegador (puerto interno 3000)
 *   backend   la API, a la que este frontend reenvía /api/v1 (puerto interno 4000)
 *   etl       el servicio ETL (puerto interno 5000)
 */
export const URL_PRODUCCION = {
  frontend: 'https://gasstationconcepcion.belsoftinc.net',
  backend: 'https://backend-gas-station.belsoftinc.net',
  etl: 'https://etl-gas-station.belsoftinc.net',
} as const;

/** Dirección pública del backend en producción: su propio subdominio. */
export const URL_BACKEND_PRODUCCION = URL_PRODUCCION.backend;

/**
 * URL del backend (solo del lado del servidor; el navegador usa /api/v1 en el mismo origen del frontend). Se lee de
 * API_URL en cada petición, no al compilar: la misma imagen de Docker sirve para cualquier backend. Sin API_URL, en
 * producción es el subdominio del backend (nunca localhost) y en desarrollo, el backend local. No puede ser la
 * dirección de este mismo frontend: proxy.ts lo detecta y corta el bucle.
 */
export function urlApi(): string {
  const url = process.env.API_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? URL_BACKEND_PRODUCCION : 'http://localhost:4000';
}

/** Cabeceras con las que el backend recibe la IP real del usuario (backend/src/compartido/http/ip-cliente.ts) */
export const CABECERA_IP_CLIENTE = 'x-erp-ip-cliente';
export const CABECERA_REENVIO = 'x-erp-reenvio';

/**
 * La IP real del usuario para el backend. Traefik deja en X-Forwarded-For la IP del navegador, pero al llamar al backend
 * por su subdominio público, el Traefik de ese salto la reemplaza por la del propio servidor, y el límite de inicios de
 * sesión sería uno solo para todos. Por eso va aparte, en X-Erp-Ip-Cliente, con SECRETO_REENVIO (el mismo valor en el
 * frontend y en el backend): sin ese secreto el backend no la cree. Sin SECRETO_REENVIO no se manda nada.
 */
export function cabecerasDeReenvio(entrantes: Headers): Record<string, string> {
  const secreto = process.env.SECRETO_REENVIO?.trim();
  const ip = entrantes.get('x-forwarded-for')?.split(',')[0]?.trim();
  return secreto && ip ? { [CABECERA_IP_CLIENTE]: ip, [CABECERA_REENVIO]: secreto } : {};
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
