import { redirect } from 'next/navigation';

export const metadata = { title: 'Editar gasto' };

/** La edición de un borrador es un modal sobre el detalle del gasto: esta ruta se conserva para los enlaces. */
export default async function PaginaEditarGasto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/gastos/${encodeURIComponent(id)}?editar=1`);
}