/** Área privada del ERP: el proxy ya validó la sesión y el acceso; aquí se arma el marco con el perfil. */
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Marco } from '@/componentes/marco/marco';
import { perfilActual } from '@/lib/servidor/sesion';

export default async function LayoutErp({ children }: { children: ReactNode }) {
  const perfil = await perfilActual();
  if (!perfil) redirect('/login');
  return <Marco perfil={perfil}>{children}</Marco>;
}
