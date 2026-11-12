/**
 * Sesión en componentes de servidor. El proxy ya consultó GET /api/v1/auth/me y deja el perfil en una cabecera
 * interna de la petición (así no se consulta dos veces). Si faltara, se consulta aquí con la cookie httpOnly.
 */
import { cookies, headers } from 'next/headers';
import type { Perfil } from '@/api/tipos';
import { CABECERA_PERFIL, decodificarPerfil, urlApi } from './constantes';

export async function perfilActual(): Promise<Perfil | null> {
  const crudo = (await headers()).get(CABECERA_PERFIL);
  const delProxy = crudo ? decodificarPerfil(crudo) : null;
  if (delProxy) return delProxy;
  const token = (await cookies()).get('erp_acceso')?.value;
  if (!token) return null;
  const respuesta = await fetch(`${urlApi()}/api/v1/auth/me`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!respuesta.ok) return null;
  return ((await respuesta.json()) as { data: Perfil }).data;
}
