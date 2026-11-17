'use client';

/**
 * Tema claro/oscuro. La elección se guarda en una cookie (lib/tema): el guion de <head> ya dejó la clase `dark` en
 * <html> antes de pintar; aquí se lee al montar y se cambia cuando el usuario lo pide.
 *
 * El cambio es "fluido": si el navegador soporta la View Transitions API, se anima con un fundido de toda la página;
 * si no (o si el usuario prefiere menos movimiento), cambia al instante.
 */
import { Moon, Sun } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { COOKIE_TEMA, type Tema } from '@/lib/tema';

export type { Tema };

/** El tema que se ve: «según el sistema» ya resuelto a claro u oscuro */
type TemaResuelto = 'light' | 'dark';

interface ValorTema {
  /** Lo que eligió el usuario */
  tema: Tema;
  resuelto: TemaResuelto;
  fijar: (tema: Tema) => void;
}

const ContextoTema = createContext<ValorTema | null>(null);

const SISTEMA_OSCURO = '(prefers-color-scheme: dark)';
const UN_ANIO = 365 * 24 * 60 * 60;

function temaGuardado(): Tema {
  const coincide = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_TEMA}=(light|dark|system)`));
  return (coincide?.[1] as Tema | undefined) ?? 'system';
}

function guardarTema(tema: Tema): void {
  const segura = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_TEMA}=${tema}; Path=/; Max-Age=${UN_ANIO}; SameSite=Lax${segura}`;
}

/** Pone o quita la clase `dark` de <html> (la que activa las clases dark: de Tailwind) y dice qué tema quedó */
function aplicarTema(tema: Tema): TemaResuelto {
  const oscuro = tema === 'dark' || (tema === 'system' && window.matchMedia(SISTEMA_OSCURO).matches);
  const raiz = document.documentElement;
  raiz.classList.toggle('dark', oscuro);
  raiz.style.colorScheme = oscuro ? 'dark' : 'light';
  return oscuro ? 'dark' : 'light';
}

/** Apaga las transiciones de CSS mientras cambia el tema, para que los colores no se crucen a medio camino */
function sinTransiciones(): () => void {
  const estilo = document.createElement('style');
  estilo.appendChild(document.createTextNode('*,*::before,*::after{transition:none!important}'));
  document.head.appendChild(estilo);
  return () => {
    // Fuerza a aplicar los estilos nuevos antes de volver a encender las transiciones
    void window.getComputedStyle(document.body).opacity;
    setTimeout(() => estilo.remove(), 1);
  };
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  // En el servidor no se conoce el tema: empieza en «según el sistema» y se corrige al montar
  const [tema, setTema] = useState<Tema>('system');
  const [resuelto, setResuelto] = useState<TemaResuelto>('light');

  useEffect(() => {
    const guardado = temaGuardado();
    setTema(guardado);
    setResuelto(aplicarTema(guardado));
  }, []);

  // «Según el sistema»: sigue al sistema si cambia con la página abierta
  useEffect(() => {
    if (tema !== 'system') return;
    const consulta = window.matchMedia(SISTEMA_OSCURO);
    const alCambiar = () => setResuelto(aplicarTema('system'));
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, [tema]);

  const fijar = useCallback((nuevo: Tema) => {
    guardarTema(nuevo);
    const encender = sinTransiciones();
    setTema(nuevo);
    setResuelto(aplicarTema(nuevo));
    encender();
  }, []);

  const valor = useMemo<ValorTema>(() => ({ tema, resuelto, fijar }), [tema, resuelto, fijar]);
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error('useTema se usa dentro de ProveedorTema');
  return valor;
}

export function useCambiarTema(): (tema: Tema) => void {
  const { fijar } = useTema();
  return (tema) => {
    const aplicar = () => flushSync(() => fijar(tema));
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
  const { resuelto } = useTema();
  const cambiar = useCambiarTema();
  const montado = useMontado();
  const oscuro = montado && resuelto === 'dark';
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
