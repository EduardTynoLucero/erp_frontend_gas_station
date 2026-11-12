'use client';

/** Marco del ERP: barra lateral (fija en escritorio, cajón en móvil), encabezado, línea de contexto y contenido. */
import * as Dialog from '@radix-ui/react-dialog';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { Menu as IconoMenu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Perfil } from '@/api/tipos';
import { claseEntrada } from '@/componentes/ui/campos';
import { EMPRESA } from '@/lib/marca';
import { BarraLateral } from './barra-lateral';
import { ProveedorErp, TODAS, useErp } from './contexto';
import { MenuUsuario } from './menu-usuario';
import { BOTON_ENCABEZADO, BotonTema } from './tema';

function BarraCarga() {
  // Solo cargas iniciales y acciones (no los refrescos automáticos en segundo plano)
  const cargando = useIsFetching({ predicate: (q) => q.state.status === 'pending' });
  const guardando = useIsMutating();
  if (!cargando && !guardando) return null;
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden bg-primario-suave-2">
      <div className="h-full w-1/3 animate-barra bg-primario" />
    </div>
  );
}

function FiltroEstacion() {
  const { estaciones, estacionFiltro, fijarEstacionFiltro } = useErp();
  const ruta = usePathname();
  // El dashboard trae su propia barra de filtros (con estación), igual que el panel del ETL
  if (estaciones.length <= 1 || ruta.startsWith('/dashboard')) return null;
  return (
    <select
      aria-label="Filtrar por estación"
      value={estacionFiltro}
      onChange={(e) => fijarEstacionFiltro(e.target.value)}
      className={claseEntrada(false, 'order-last h-[32px] w-full sm:order-none sm:w-[230px]')}
    >
      <option value={TODAS}>Todas las estaciones</option>
      {estaciones.map((e) => (
        <option key={e.id} value={e.id}>
          {e.codigo} · {e.nombre}
        </option>
      ))}
    </select>
  );
}

/** "Karla Méndez · Gerente de estación · autoriza hasta Q1,000 · Gasolinera Concepción Las Minas" */
function LineaContexto() {
  const { perfil, estaciones } = useErp();
  const limite = perfil.acceso.limiteAutorizacion;
  const partes: string[] = [perfil.usuario.rol.nombre];
  if (limite === null) partes.push('autoriza sin límite');
  else if (Number(limite) > 0) partes.push(`autoriza hasta Q${Math.trunc(Number(limite)).toLocaleString('en-US')}`);
  if (estaciones.length === 1) partes.push(estaciones[0]!.nombre);
  return (
    <p className="mb-[6px] px-[2px] text-[11px] leading-[1.3] text-tenue">
      <span className="font-semibold text-tinta-suave">{perfil.usuario.nombre}</span> · {partes.join(' · ')}
    </p>
  );
}

/**
 * El proxy manda al inicio del usuario con ?denegado=<ruta> cuando pide una pantalla sin permiso: aquí se le avisa
 * y se limpia la URL. En /sin-acceso el aviso ya está en la página.
 */
function useAvisoDenegado(ruta: string) {
  useEffect(() => {
    if (ruta === '/sin-acceso') return;
    const url = new URL(window.location.href);
    const denegado = url.searchParams.get('denegado');
    if (!denegado) return;
    toast.warning(`Su usuario no tiene acceso a ${denegado}. Lo llevamos a su pantalla de inicio.`);
    url.searchParams.delete('denegado');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [ruta]);
}

function Contenido({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  useEffect(() => {
    setAbierto(false);
    window.scrollTo(0, 0);
  }, [ruta]);
  useAvisoDenegado(ruta);

  return (
    <div className="min-h-screen bg-fondo">
      <BarraCarga />
      {/* Barra lateral blanca con borde, como la de la plantilla */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] border-r border-borde bg-superficie lg:block">
        <BarraLateral />
      </aside>

      <Dialog.Root open={abierto} onOpenChange={setAbierto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(15_23_42/0.35)] lg:hidden dark:bg-black/60" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-40 w-[260px] max-w-[85vw] border-r border-borde bg-superficie shadow-xl focus:outline-none lg:hidden">
            <Dialog.Title className="sr-only">Menú</Dialog.Title>
            <Dialog.Description className="sr-only">Pantallas disponibles para su usuario</Dialog.Description>
            <BarraLateral />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-[212px]">
        {/* Encabezado blanco, plano, con la línea roja abajo (la barra de módulos de la plantilla) */}
        <header className="sticky top-0 z-20 border-b-2 border-primario bg-superficie">
          <div className="flex min-h-[46px] flex-wrap items-center gap-[8px] px-[10px] py-[6px]">
            <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" className={`${BOTON_ENCABEZADO} lg:hidden`}>
              <IconoMenu className="size-[16px]" />
            </button>
            <div className="mr-auto min-w-0 truncate text-[13px] font-semibold text-tinta">{EMPRESA}</div>
            <FiltroEstacion />
            <BotonTema />
            <MenuUsuario />
          </div>
        </header>
        <main className="px-[10px] py-[8px]">
          <LineaContexto />
          {children}
        </main>
      </div>
    </div>
  );
}

export function Marco({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  return (
    <ProveedorErp perfil={perfil}>
      <Contenido>{children}</Contenido>
    </ProveedorErp>
  );
}
