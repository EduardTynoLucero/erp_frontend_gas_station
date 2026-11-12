/**
 * Proxy de Next.js 16 (el antiguo middleware.ts): reenvío de la API y protección estricta de rutas en el servidor.
 *
 * La API (/api/v1/*, salvo las rutas propias de Next.js) se reenvía al backend de API_URL. Se hace aquí y no con
 * rewrites de next.config.ts porque esos se fijan al compilar: así API_URL se lee al arrancar el contenedor y la misma
 * imagen sirve para cualquier backend. El navegador sigue hablando solo con Next.js (mismo origen, cookies httpOnly).
 *
 * En cada navegación a una página del ERP:
 *   1. Lee la cookie httpOnly erp_acceso y consulta GET /api/v1/auth/me en el backend.
 *   2. Sin sesión o con el token vencido → /api/v1/auth/renovar (renueva con la cookie erp_refresco y vuelve;
 *      si no se puede, lleva al inicio de sesión).
 *   3. Con sesión, revisa acceso.modulos y acceso.pantallas contra lo que exige la ruta: si el usuario no tiene
 *      el módulo (gastos o dashboards) o la pantalla, lo redirige a su inicio o a /sin-acceso.
 *   4. Deja el perfil en una cabecera interna para que los componentes de servidor no vuelvan a consultarlo.
 * El backend vuelve a verificar todo en cada llamada a la API: esto protege la navegación, no los datos.
 */
import { type NextRequest, NextResponse } from 'next/server';
import type { Perfil } from '@/api/tipos';
import { cumple, inicioDe, requisitoDe } from '@/lib/rutas';
import { CABECERA_PERFIL, codificarPerfil, urlApi } from '@/lib/servidor/constantes';

/** Rutas de /api/v1 que atiende el propio Next.js (src/app/api): no se reenvían al backend. */
const RUTAS_PROPIAS = new Set(['/api/v1/auth/renovar']);

/**
 * Lo que el proxy nunca protege ni redirige: el inicio de sesión, la API, los recursos de Next.js y los archivos
 * estáticos (favicon, imágenes…). El matcher de abajo ya los deja fuera; esto lo repite en el código para que un
 * cambio en el matcher no pueda mandar /login a /login.
 */
function esPublica(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/__nextjs') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function renovar(request: NextRequest, destino: string): NextResponse {
  return NextResponse.redirect(new URL(`/api/v1/auth/renovar?destino=${encodeURIComponent(destino)}`, request.url));
}

function aLogin(request: NextRequest, destino: string, motivo: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?motivo=${motivo}&destino=${encodeURIComponent(destino)}`, request.url));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  // La API va al backend con el cuerpo, las cookies y el Origin tal como llegaron (Set-Cookie vuelve igual)
  if (pathname.startsWith('/api/v1/') && !RUTAS_PROPIAS.has(pathname)) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, urlApi()));
  }
  if (esPublica(pathname)) return NextResponse.next();
  const destino = `${pathname}${search}`;

  const token = request.cookies.get('erp_acceso')?.value;
  if (!token) return renovar(request, destino);

  // Fuera del try: si falta API_URL en producción, el error se ve en el log en vez de parecer «sin conexión»
  const backend = urlApi();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${backend}/api/v1/auth/me`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  } catch {
    return aLogin(request, destino, 'sin-conexion');
  }
  if (respuesta.status === 401) return renovar(request, destino);
  if (!respuesta.ok) return aLogin(request, destino, 'error');
  const perfil = ((await respuesta.json()) as { data: Perfil }).data;

  if (pathname === '/') {
    return NextResponse.redirect(new URL(inicioDe(perfil) ?? '/sin-acceso', request.url));
  }

  const requisito = requisitoDe(pathname);
  if (requisito && !cumple(perfil, requisito)) {
    const inicio = inicioDe(perfil);
    const url = new URL(inicio && inicio !== pathname ? inicio : '/sin-acceso', request.url);
    url.searchParams.set('denegado', pathname);
    return NextResponse.redirect(url);
  }

  const cabeceras = new Headers(request.headers);
  cabeceras.set(CABECERA_PERFIL, codificarPerfil(perfil));
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: [
    // La API completa (aunque la ruta termine en algo que parezca una extensión), para reenviarla al backend
    '/api/v1/:ruta*',
    // Las páginas: todo menos la API, los recursos de Next.js, el inicio de sesión y los archivos estáticos
    '/((?!api/|_next/|login|favicon.ico|icon.svg|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
