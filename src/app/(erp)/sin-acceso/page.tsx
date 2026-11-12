import Link from 'next/link';
import { Aviso } from '@/componentes/ui/aviso';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { inicioDe } from '@/lib/rutas';
import { perfilActual } from '@/lib/servidor/sesion';

export const metadata = { title: 'Sin acceso' };

export default async function PaginaSinAcceso({ searchParams }: { searchParams: Promise<{ denegado?: string }> }) {
  const perfil = await perfilActual();
  const { denegado } = await searchParams;
  const inicio = perfil ? inicioDe(perfil) : null;
  return (
    <>
      <EncabezadoPagina titulo="Sin acceso" />
      {inicio ? (
        <Aviso tono="amber">
          Su usuario ({perfil?.usuario.rol.nombre}) no tiene acceso a {denegado ? <code className="font-mono">{denegado}</code> : 'esta pantalla'}.{' '}
          <Link href={inicio} className="font-medium underline">
            Ir a mi inicio
          </Link>
        </Aviso>
      ) : (
        <Aviso tono="amber">Su usuario no tiene pantallas disponibles en este frontend todavía. Consulte al administrador.</Aviso>
      )}
    </>
  );
}
