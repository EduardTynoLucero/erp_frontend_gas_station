'use client';

/** Solicitudes y autorizaciones (/autorizaciones). El botón "Aprobar" de cada fila sigue a acciones.aprobar. */
import { Decimal } from 'decimal.js';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import type { GastoResumen } from '@/api/tipos';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { BotonAccion } from '@/componentes/ui/boton';
import { Insignia, InsigniaEstado } from '@/componentes/ui/insignia';
import { Pestanas } from '@/componentes/ui/pestanas';
import { Cabecera, ContenedorTabla, Cuerpo, filaClic, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { diasEntre, fecha, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { useAccionGasto, useCatalogos, useListaGastos } from '../datos';
import { CeldaMonto } from '../etiquetas';

type Pestana = 'mias' | 'otras' | 'solicitudes' | 'rechazados';
const DIAS_ALERTA_PENDIENTE = 3;

export function PantallaAutorizaciones() {
  const router = useRouter();
  const { estacionId } = useErp();
  const catalogos = useCatalogos();
  const accion = useAccionGasto();
  const [pestana, setPestana] = useState<Pestana>('mias');
  const [aprobando, setAprobando] = useState<string | null>(null);

  const base = { porPagina: 100, orden: 'fecha' as const, ...(estacionId ? { estacionId } : {}) };
  const pendientes = useListaGastos({ ...base, estado: 'pendiente' });
  const solicitudes = useListaGastos({ ...base, soloMios: 'true' });
  const rechazados = useListaGastos({ ...base, estado: 'rechazado' });

  const listaPendientes = pendientes.data?.data ?? [];
  const conjuntos: Record<Pestana, GastoResumen[]> = {
    mias: listaPendientes.filter((g) => g.acciones.aprobar.ok),
    otras: listaPendientes.filter((g) => !g.acciones.aprobar.ok),
    solicitudes: solicitudes.data?.data ?? [],
    rechazados: rechazados.data?.data ?? [],
  };
  const activa = conjuntos[pestana];
  const cargando = pendientes.isPending || (pestana === 'solicitudes' && solicitudes.isPending) || (pestana === 'rechazados' && rechazados.isPending);
  const hoy = catalogos.data?.parametros.hoy;
  const niveles = catalogos.data?.niveles ?? [];

  async function aprobar(g: GastoResumen) {
    setAprobando(g.id);
    try {
      const r = await accion.mutateAsync({ tipo: 'aprobar', id: g.id });
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setAprobando(null);
    }
  }

  function rango(i: number): string {
    const nivel = niveles[i]!;
    const previo = niveles[i - 1];
    if (nivel.hasta === null) return previo?.hasta ? `Más de ${q(previo.hasta)}` : 'Sin límite';
    if (!previo?.hasta) return `Hasta ${q(nivel.hasta)}`;
    return `De ${q(new Decimal(previo.hasta).plus('0.01').toFixed(2))} a ${q(nivel.hasta)}`;
  }

  const quinta = { mias: 'Antigüedad', otras: 'Lo autoriza', solicitudes: 'Estado', rechazados: 'Estado' }[pestana];

  return (
    <>
      <EncabezadoPagina
        titulo="Solicitudes y autorizaciones"
        descripcion="Cada gasto lo autoriza el nivel que corresponde a su monto. Quien solicita no puede autorizar su propio gasto."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {niveles.map((n, i) => (
          <div key={n.orden} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Nivel {i + 1}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{n.etiqueta}</div>
            <div className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{rango(i)}</div>
          </div>
        ))}
      </div>

      <Tarjeta>
        <Pestanas
          valor={pestana}
          alCambiar={setPestana}
          pestanas={[
            { valor: 'mias', etiqueta: `Me toca autorizar (${conjuntos.mias.length})` },
            { valor: 'otras', etiqueta: `Otros pendientes (${conjuntos.otras.length})` },
            { valor: 'solicitudes', etiqueta: `Mis solicitudes (${conjuntos.solicitudes.length})` },
            { valor: 'rechazados', etiqueta: `Rechazados (${conjuntos.rechazados.length})` },
          ]}
        />
        {pendientes.isError ? (
          <Aviso tono="red">{mensajeDeError(pendientes.error)}</Aviso>
        ) : cargando ? (
          <EsqueletoTabla filas={4} />
        ) : activa.length === 0 ? (
          <Vacio>{pestana === 'mias' ? 'No tiene gastos por autorizar con este usuario.' : 'Nada en esta lista.'}</Vacio>
        ) : (
          <ContenedorTabla anchoMinimo={900}>
            <Cabecera>
              <th className={th}>Folio</th>
              <th className={th}>Fecha</th>
              <th className={th}>Estación</th>
              <th className={th}>Descripción</th>
              <th className={th}>{quinta}</th>
              <th className={thR}>Monto</th>
              {pestana === 'mias' && <th className={th} aria-label="Acción" />}
            </Cabecera>
            <Cuerpo>
              {activa.map((g) => {
                const edad = hoy ? diasEntre(g.fecha, hoy) : 0;
                return (
                  <tr key={g.id} className={filaClic} onClick={() => router.push(`/gastos/${g.id}`)}>
                    <td className={cn(td, 'whitespace-nowrap font-medium text-brand-700 dark:text-brand-300')}>{g.folio}</td>
                    <td className={`${td} whitespace-nowrap`}>{fecha(g.fecha)}</td>
                    <td className={td}>{g.estacion.codigo}</td>
                    <td className={`${td} max-w-sm`}>
                      <span className="block truncate">{g.descripcion}</span>
                      <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        {g.categoria.nombre} · solicitó {g.solicitante.nombre}
                        {g.faltaComprobante && <Insignia tono="red">Sin comprobante</Insignia>}
                        {g.origen === 'reporte' && <Insignia tono="violet">Desde reportes</Insignia>}
                      </span>
                    </td>
                    <td className={td}>
                      {pestana === 'mias' ? (
                        <Insignia tono={edad > DIAS_ALERTA_PENDIENTE ? 'amber' : 'gray'}>{edad} días</Insignia>
                      ) : pestana === 'otras' ? (
                        <span className="text-xs">{g.nivelRequerido}</span>
                      ) : (
                        <InsigniaEstado estado={g.estado} />
                      )}
                    </td>
                    <td className={tdR}>
                      <CeldaMonto g={g} />
                    </td>
                    {pestana === 'mias' && (
                      <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                        <BotonAccion verificacion={g.acciones.aprobar} variante="success" tamano="sm" cargando={aprobando === g.id} onClick={() => void aprobar(g)}>
                          Aprobar
                        </BotonAccion>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Cuerpo>
          </ContenedorTabla>
        )}
        {pestana === 'mias' && conjuntos.mias.length > 0 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Para rechazar, abra el gasto: el rechazo exige escribir el motivo.</p>
        )}
      </Tarjeta>
    </>
  );
}
