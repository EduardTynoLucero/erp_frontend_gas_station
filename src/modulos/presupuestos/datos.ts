'use client';

/** Presupuestos por estación y categoría: lectura de la ejecución del mes, asignar un monto y copiar al mes siguiente. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type Presupuestos = components['schemas']['Presupuestos'];
export type FilaPresupuesto = Presupuestos['filas'][number];
export type LineaPresupuesto = components['schemas']['LineaPresupuestoInput'];

export function usePresupuestos(periodo: string | undefined, estacionId: string | undefined) {
  return useQuery({
    queryKey: ['presupuestos', periodo ?? 'abierto', estacionId ?? 'todas'],
    queryFn: async () => {
      const query: { periodo?: string; estacionId?: string } = {};
      if (periodo) query.periodo = periodo;
      if (estacionId) query.estacionId = estacionId;
      return (await pedir(api.GET('/api/v1/presupuestos', { params: { query } }))).data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

/** El presupuesto mueve las alertas de consumo: se refrescan también los contadores. */
export function useGuardarPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: LineaPresupuesto) => pedir(api.PUT('/api/v1/presupuestos', { body: cuerpo })),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['presupuestos'] }), qc.invalidateQueries({ queryKey: ['contadores'] })]),
  });
}

export function useCopiarPresupuestos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: { desde: string; hacia: string }) => pedir(api.POST('/api/v1/presupuestos/copiar', { body: cuerpo })),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['presupuestos'] }), qc.invalidateQueries({ queryKey: ['contadores'] })]),
  });
}
