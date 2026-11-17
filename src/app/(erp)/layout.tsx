/**
 * Área privada del ERP: el proxy ya validó la sesión y el acceso; aquí se arma el marco con el perfil y con las
 * preferencias de interfaz del usuario (que viven en la base), para que el menú y los filtros salgan como los dejó.
 */
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Marco } from '@/componentes/marco/marco';
import { perfilActual, preferenciasActuales } from '@/lib/servidor/sesion';

export default async function LayoutErp({ children }: { children: ReactNode }) {
  const [perfil, preferencias] = await Promise.all([perfilActual(), preferenciasActuales()]);
  if (!perfil) redirect('/login');
  return (
    <Marco perfil={perfil} preferencias={preferencias}>
      {children}
    </Marco>
  );
}
