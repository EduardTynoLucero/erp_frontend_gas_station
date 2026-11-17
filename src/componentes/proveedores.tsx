'use client';

/** Proveedores globales: tema claro/oscuro, caché de datos (TanStack Query), tooltips y notificaciones. */
import * as Tooltip from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { ErrorApi } from '@/api/cliente';
import { ProveedorTema, useTema } from '@/componentes/marco/tema';

function Notificaciones() {
  const { resuelto } = useTema();
  return (
    <Toaster
      position="bottom-right"
      theme={resuelto}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-xl! text-sm! shadow-lg!',
          success: 'bg-slate-900! text-white! border-slate-900! dark:bg-slate-100! dark:text-slate-900!',
          error: 'bg-red-50! text-red-800! border-red-200! dark:bg-red-950! dark:text-red-200! dark:border-red-900!',
        },
      }}
    />
  );
}

export function Proveedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            // Un 4xx no se arregla reintentando (permiso, validación, no existe)
            retry: (intentos, error) => !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 2,
          },
        },
      }),
  );
  return (
    <ProveedorTema>
      <QueryClientProvider client={cliente}>
        <Tooltip.Provider delayDuration={150}>
          {children}
          <Notificaciones />
        </Tooltip.Provider>
      </QueryClientProvider>
    </ProveedorTema>
  );
}
