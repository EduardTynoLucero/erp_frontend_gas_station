'use client';

/**
 * Cambio de tema claro/oscuro "fluido": si el navegador soporta la View Transitions API, el cambio se anima con
 * un fundido de toda la página; si no (o si el usuario prefiere menos movimiento), cambia al instante.
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Tema = 'light' | 'dark' | 'system';

export function useCambiarTema(): (tema: Tema) => void {
  const { setTheme } = useTheme();
  return (tema) => {
    const aplicar = () => flushSync(() => setTheme(tema));
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      aplicar();
      return;
    }
    doc.startViewTransition(aplicar);
  };
}

/** En el servidor no se conoce el tema: los componentes que dependen de él esperan a montarse. */
export function useMontado(): boolean {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado;
}

/** Botón de ícono del encabezado (como los de la barra superior de la plantilla): borde fino, rojo al pasar el ratón. */
export const BOTON_ENCABEZADO =
  'inline-flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-borde bg-superficie text-[#475569] transition-colors ' +
  'hover:border-primario hover:bg-primario-suave hover:text-primario-tinta focus:outline-none focus-visible:outline focus-visible:outline-1 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-primario dark:text-slate-300';

export function BotonTema() {
  const { resolvedTheme } = useTheme();
  const cambiar = useCambiarTema();
  const montado = useMontado();
  const oscuro = montado && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => cambiar(oscuro ? 'light' : 'dark')}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={BOTON_ENCABEZADO}
    >
      {montado ? oscuro ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" /> : <span className="block size-[15px]" />}
    </button>
  );
}
