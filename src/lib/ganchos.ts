'use client';

import { useEffect, useState } from 'react';

/** Devuelve el valor después de `ms` sin cambios (para no consultar la API en cada tecla). */
export function useRetardo<T>(valor: T, ms = 300): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retardado;
}
