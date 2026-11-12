'use client';

/** Contexto del ERP en el navegador: el perfil (de /auth/me, vía el proxy) y el filtro global de estación. */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { Perfil } from '@/api/tipos';

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
  const clave = `erp:estacion:${perfil.usuario.id}`;
  const [elegida, setElegida] = useState<string>(TODAS);

  // El filtro dura lo que la pestaña (como en el prototipo, vuelve a "Todas" en cada sesión nueva)
  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(clave);
      if (guardada) setElegida(guardada);
    } catch {
      // almacenamiento no disponible: se queda en "Todas"
    }
  }, [clave]);

  const valor = useMemo<ValorErp>(() => {
    const valida = elegida === TODAS || estaciones.some((e) => e.id === elegida);
    const estacionFiltro = estaciones.length === 1 ? estaciones[0]!.id : valida ? elegida : TODAS;
    return {
      perfil,
      estaciones,
      estacionFiltro,
      estacionId: estacionFiltro === TODAS ? undefined : estacionFiltro,
      fijarEstacionFiltro: (id: string) => {
        setElegida(id);
        try {
          sessionStorage.setItem(clave, id);
        } catch {
          // sin almacenamiento: el filtro vale hasta recargar
        }
      },
    };
  }, [perfil, estaciones, elegida, clave]);

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
