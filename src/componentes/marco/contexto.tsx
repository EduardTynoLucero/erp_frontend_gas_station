'use client';

/** Contexto del ERP en el navegador: el perfil (de /auth/me, vía el proxy) y el filtro global de estación. */
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { Perfil } from '@/api/tipos';
import { usePreferencia } from './preferencias';

export const TODAS = 'ALL';

interface ValorErp {
  perfil: Perfil;
  /** Estaciones activas que el usuario ve */
  estaciones: Perfil['acceso']['alcance']['estaciones'];
  /** Id de la estación filtrada, o TODAS */
  estacionFiltro: string;
  fijarEstacionFiltro: (id: string) => void;
  /** Filtro listo para la API (undefined = todas) */
  estacionId: string | undefined;
}

const ContextoErp = createContext<ValorErp | null>(null);

export function ProveedorErp({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const estaciones = useMemo(() => perfil.acceso.alcance.estaciones.filter((e) => e.activa), [perfil]);
  // La estación elegida es una preferencia del usuario, guardada en la base (no en el navegador)
  const [elegida, fijarEstacionFiltro] = usePreferencia('estacion', TODAS);

  const valor = useMemo<ValorErp>(() => {
    // Si la estación guardada ya no está entre las del usuario (se la quitaron o se desactivó), vuelve a «Todas»
    const valida = elegida === TODAS || estaciones.some((e) => e.id === elegida);
    const estacionFiltro = estaciones.length === 1 ? estaciones[0]!.id : valida ? elegida : TODAS;
    return {
      perfil,
      estaciones,
      estacionFiltro,
      estacionId: estacionFiltro === TODAS ? undefined : estacionFiltro,
      fijarEstacionFiltro,
    };
  }, [perfil, estaciones, elegida, fijarEstacionFiltro]);

  return <ContextoErp.Provider value={valor}>{children}</ContextoErp.Provider>;
}

export function useErp(): ValorErp {
  const valor = useContext(ContextoErp);
  if (!valor) throw new Error('useErp se usa dentro de ProveedorErp');
  return valor;
}

export function useTienePermiso(permiso: string): boolean {
  return useErp().perfil.acceso.permisos.includes(permiso);
}

export function useTienePantalla(...codigos: string[]): boolean {
  return useErp().perfil.acceso.pantallas.some((p) => codigos.includes(p.codigo));
}
