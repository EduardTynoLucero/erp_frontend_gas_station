/**
 * GET /api/v1/auth/renovar?destino=/ruta · renovación silenciosa de la sesión durante la navegación.
 *
 * La cookie erp_refresco solo viaja a /api/v1/auth/* (Path restringido): por eso el proxy redirige aquí cuando
 * el token de acceso venció. Esta ruta de Next.js (que tiene prioridad sobre el rewrite al backend) llama a
 * POST /api/v1/auth/refresh del backend con esa cookie, reenvía al navegador las cookies nuevas y vuelve a la
 * página pedida. Si no hay forma de renovar, lleva al inicio de sesión.
 *
 * Las redirecciones van con una ruta relativa: en el contenedor (salida standalone) request.url trae la dirección
 * interna del servidor (http://0.0.0.0:3000), no el dominio que abrió el usuario, y lo mandaría a una dirección que no
 * existe. El navegador resuelve la ruta contra la página en la que está.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { destinoSeguro } from '@/lib/rutas';
import { urlApi } from '@/lib/servidor/constantes';

const redirigir = (ruta: string) => new NextResponse(null, { status: 307, headers: { location: ruta } });

export async function GET(request: NextRequest): Promise<NextResponse> {
  const destino = destinoSeguro(request.nextUrl.searchParams.get('destino')) ?? '/';
  const aLogin = () => redirigir(`/login?destino=${encodeURIComponent(destino)}`);

  const refresco = request.cookies.get('erp_refresco')?.value;
  if (!refresco) return aLogin();

  // Fuera del try: si falta API_URL en producción, el error se ve en el log en vez de mandar al inicio de sesión
  const backend = urlApi();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${backend}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `erp_refresco=${refresco}` },
      cache: 'no-store',
    });
  } catch {
    return aLogin();
  }

  const salida = respuesta.ok ? redirigir(destino) : aLogin();
  // Cookies nuevas (o borradas si la sesión ya no vale), tal como las emitió el backend
  for (const cookie of respuesta.headers.getSetCookie()) salida.headers.append('set-cookie', cookie);
  return salida;
}
