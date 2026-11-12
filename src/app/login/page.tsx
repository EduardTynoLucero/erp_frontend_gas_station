import type { Metadata } from 'next';
import { FormularioIngreso } from './formulario-ingreso';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  return <FormularioIngreso destino={texto(p.destino)} motivo={texto(p.motivo)} />;
}
