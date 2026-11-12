import { redirect } from 'next/navigation';
import { perfilActual } from '@/lib/servidor/sesion';

export const metadata = { title: 'Nuevo gasto' };

/**
 * «Nuevo gasto» es un modal sobre el listado (como en la plantilla, lo que se crea va en un modal). Esta ruta se
 * conserva para los enlaces: lleva al Registro de gastos, o a Mis solicitudes si el usuario no ve el registro, con el
 * modal abierto.
 */
export default async function PaginaNuevoGasto() {
  const perfil = await perfilActual();
  const veRegistro = perfil?.acceso.pantallas.some((p) => p.codigo === 'gastos') ?? false;
  redirect(veRegistro ? '/gastos?nuevo=1' : '/mis-solicitudes?nuevo=1');
}