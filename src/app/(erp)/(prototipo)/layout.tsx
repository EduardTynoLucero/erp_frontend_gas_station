/**
 * Pantallas del prototipo de gastos (Expenses_project) que todavía no tienen tablas conectadas en el backend: trabajan
 * con los datos simulados del prototipo, guardados en este navegador (modulos/prototipo). El proxy ya validó la sesión
 * y la pantalla; aquí solo se cargan esos datos y el usuario simulado de la sesión real.
 */
import type { ReactNode } from 'react';
import { StoreProvider } from '@/modulos/prototipo/lib/store';

export default function LayoutPrototipo({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
