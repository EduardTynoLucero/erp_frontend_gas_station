import { PantallaMisSolicitudes } from '@/modulos/gastos/pantallas/mis-solicitudes';

export const metadata = { title: 'Mis solicitudes' };

export default async function PaginaMisSolicitudes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?nuevo=1 abre el modal «Nuevo gasto o solicitud» (a donde lleva /gastos/nuevo si el usuario no ve el registro)
  return <PantallaMisSolicitudes nuevo={(await searchParams).nuevo === '1'} />;
}