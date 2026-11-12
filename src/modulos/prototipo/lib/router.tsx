'use client';

/**
 * Lo que las pantallas del prototipo usaban de react-router-dom, sobre el enrutador de Next.js. Así las pantallas
 * restauradas conservan su código: <Link to="/caja-chica"> y nav('/gastos?categoria=SP').
 */
import NextLink from 'next/link';
import { useParams as useParamsNext, useRouter } from 'next/navigation';
import { type ComponentProps, useCallback } from 'react';

export { rutaGasto } from './rutas';

export function Link({ to, ...props }: Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string }) {
  return <NextLink href={to} {...props} />;
}

export function useNavigate(): (to: string) => void {
  const router = useRouter();
  return useCallback((to: string) => router.push(to), [router]);
}

export function useParams(): Record<string, string | undefined> {
  const params = useParamsNext();
  return Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/** Regresa a la pantalla anterior; si el detalle se abrió directo (sin historial), va al inicio. */
export function useVolver(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }, [router]);
}
