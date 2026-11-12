'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { iniciales } from '@/lib/utilidades';
import { useErp } from './contexto';
import { type Tema, useCambiarTema, useMontado } from './tema';

const TEMAS: { valor: Tema; etiqueta: string; icono: typeof Sun }[] = [
  { valor: 'light', etiqueta: 'Claro', icono: Sun },
  { valor: 'dark', etiqueta: 'Oscuro', icono: Moon },
  { valor: 'system', etiqueta: 'Según el sistema', icono: Monitor },
];

async function cerrarSesion(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    // Recarga completa: se descartan la caché de datos y el estado del navegador
    window.location.assign('/login');
  }
}

export function MenuUsuario() {
  const { perfil } = useErp();
  const { theme } = useTheme();
  const cambiarTema = useCambiarTema();
  const montado = useMontado();
  const [saliendo, setSaliendo] = useState(false);
  // Opción del menú, como las del menú de exportar de la plantilla: fila con línea abajo, roja suave al resaltarla
  const item =
    'flex min-h-[30px] w-full cursor-pointer select-none items-center gap-[7px] border-b border-borde-suave px-[9px] py-[5px] text-[12px] font-medium ' +
    'text-tinta outline-none data-[highlighted]:bg-primario-suave data-[highlighted]:text-primario-tinta';

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Menú de usuario"
        className="flex h-[32px] cursor-pointer items-center gap-[7px] rounded-[2px] border border-borde bg-superficie pl-[4px] pr-[7px] outline-none transition-colors hover:border-primario hover:bg-primario-suave focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primario"
      >
        <span className="grid size-[24px] place-items-center rounded-full bg-primario text-[10px] font-bold text-white">{iniciales(perfil.usuario.nombre)}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[11rem] truncate text-[12px] font-semibold leading-[1.15] text-tinta">{perfil.usuario.nombre}</span>
          <span className="block max-w-[11rem] truncate text-[10px] leading-[1.2] text-tenue">{perfil.usuario.rol.nombre}</span>
        </span>
        <ChevronDown className="hidden size-[13px] text-tenue sm:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={5} className="z-30 w-[240px] overflow-hidden rounded-[2px] border border-borde bg-superficie shadow-lg">
          <div className="border-b border-borde bg-barra px-[9px] py-[7px]">
            <div className="text-[12px] font-bold text-tinta">{perfil.usuario.nombre}</div>
            <div className="text-[10px] text-tenue">
              {perfil.usuario.usuario} · {perfil.usuario.rol.nombre}
            </div>
          </div>
          <Menu.Label className="border-b border-borde-suave px-[9px] pb-[3px] pt-[6px] text-[10px] font-bold uppercase tracking-[0.05em] text-tenue">Tema</Menu.Label>
          <Menu.RadioGroup value={montado ? (theme ?? 'system') : 'system'} onValueChange={(v) => cambiarTema(v as Tema)}>
            {TEMAS.map((t) => (
              <Menu.RadioItem key={t.valor} value={t.valor} className={item} onSelect={(e) => e.preventDefault()}>
                <t.icono className="size-[13px] opacity-70" />
                <span className="flex-1">{t.etiqueta}</span>
                <Menu.ItemIndicator>
                  <Check className="size-[13px] text-primario" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          <Menu.Item
            className={`${item} border-b-0 text-[#c20510] data-[highlighted]:bg-[#fef2f2] data-[highlighted]:text-[#c20510] dark:text-red-300 dark:data-[highlighted]:bg-red-500/10 dark:data-[highlighted]:text-red-300`}
            disabled={saliendo}
            onSelect={() => {
              setSaliendo(true);
              void cerrarSesion();
            }}
          >
            <LogOut className="size-[13px]" />
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
