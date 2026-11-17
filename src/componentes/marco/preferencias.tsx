'use client';

/**
 * Preferencias de interfaz del usuario: qué módulos del menú tiene abiertos, si los filtros de un listado están a la
 * vista, la estación del filtro global. Se guardan en la base (iam.usuario_preferencia, por /api/v1/preferencias), no
 * en el navegador: acompañan al usuario a cualquier equipo y nada del ERP queda en el almacenamiento del navegador.
 *
 * El servidor las entrega al armar la página (así el menú y los filtros salen ya como el usuario los dejó, sin
 * parpadeo). Al cambiar una, la pantalla responde al instante y el guardado va en segundo plano: si falla, la
 * preferencia vale hasta recargar, sin molestar a la persona con un error.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, pedir } from '@/api/cliente';

type Preferencias = Record<string, string>;

interface ValorPreferencias {
  valores: Preferencias;
  fijar: (clave: string, valor: string) => void;
}

const ContextoPreferencias = createContext<ValorPreferencias | null>(null);

export function ProveedorPreferencias({ iniciales, children }: { iniciales: Preferencias | null; children: ReactNode }) {
  const [valores, setValores] = useState<Preferencias>(iniciales ?? {});

  // Si el servidor no pudo leerlas al armar la página, se piden aquí. Lo que la persona ya cambió mientras tanto manda
  useEffect(() => {
    if (iniciales) return;
    let vigente = true;
    pedir(api.GET('/api/v1/preferencias'))
      .then((r) => {
        if (vigente) setValores((actuales) => ({ ...r.data, ...actuales }));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [iniciales]);

  const fijar = useCallback((clave: string, valor: string) => {
    setValores((actuales) => (actuales[clave] === valor ? actuales : { ...actuales, [clave]: valor }));
    void pedir(api.PUT('/api/v1/preferencias', { body: { clave, valor } })).catch(() => undefined);
  }, []);

  const valor = useMemo<ValorPreferencias>(() => ({ valores, fijar }), [valores, fijar]);
  return <ContextoPreferencias.Provider value={valor}>{children}</ContextoPreferencias.Provider>;
}

/**
 * Una preferencia del usuario, como un useState que se guarda en la base. `clave` sigue el patrón del backend:
 * «menu», «estacion», «filtros:<pantalla>», «operacion:<filtro>» (minúsculas, dígitos y guiones).
 * Fuera del área privada (sin proveedor) se comporta como un estado normal, sin guardar.
 */
export function usePreferencia(clave: string, porDefecto: string): [string, (valor: string) => void] {
  const contexto = useContext(ContextoPreferencias);
  const [local, setLocal] = useState(porDefecto);
  const fijarEnBase = contexto?.fijar;
  const fijar = useCallback(
    (valor: string) => {
      if (fijarEnBase) fijarEnBase(clave, valor);
      else setLocal(valor);
    },
    [fijarEnBase, clave],
  );
  return [contexto ? (contexto.valores[clave] ?? porDefecto) : local, fijar];
}
