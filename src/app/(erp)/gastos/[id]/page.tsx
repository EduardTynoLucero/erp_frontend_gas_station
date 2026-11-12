import { PantallaDetalleGasto } from '@/modulos/gastos/pantallas/detalle';

export const metadata = { title: 'Detalle del gasto' };

export default async function PaginaDetalleGasto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // ?editar=1 abre el modal del borrador (a donde lleva /gastos/:id/editar)
  return <PantallaDetalleGasto id={id} editar={(await searchParams).editar === '1'} />;
}