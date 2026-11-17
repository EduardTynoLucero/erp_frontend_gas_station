'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { BarrasAgrupadas } from '@/componentes/ui/barras';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { claseFiltro } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Segmentado } from '@/componentes/ui/segmentado';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fechaHora, pct, periodoLabel, q, qk } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type Criterio, useAplicarProrrateo, useProrrateo, useQuitarProrrateo } from '../datos';

const CRITERIOS: { valor: Criterio; texto: string }[] = [
  { valor: 'ventas', texto: 'Según ventas del mes' },
  { valor: 'partes_iguales', texto: 'Partes iguales' },
];

export function PantallaProrrateo() {
  const [periodo, setPeriodo] = useState<string | undefined>(undefined);
  const [criterio, setCriterio] = useState<Criterio | undefined>(undefined);
  const consulta = useProrrateo(periodo, criterio);
  const aplicar = useAplicarProrrateo();
  const quitar = useQuitarProrrateo();
  const d = consulta.data;

  async function ejecutar(accion: () => Promise<{ mensaje: string }>) {
    try {
      const r = await accion();
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Prorrateo de gastos compartidos"
        descripcion="Reparte los gastos de oficina central (contabilidad, sistema administrativo) entre las estaciones que se benefician, según sus ventas o en partes iguales."
        acciones={
          d && (
            <div className="flex items-center px-[6px] py-[4px]">
              <select className={cn(claseFiltro(), 'w-44')} value={d.periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
                {d.periodos.map((p) => (
                  <option key={p} value={p}>
                    {periodoLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          <div className="grid gap-[6px] lg:grid-cols-3">
            <Tarjeta
              titulo="Gastos de oficina central"
              subtitulo={`${consulta.data.centrales.length} gastos · ${q(consulta.data.total)}`}
              acciones={consulta.data.aplicado ? <Insignia tono="green">Prorrateo aplicado</Insignia> : <Insignia>Sin aplicar</Insignia>}
            >
              {consulta.data.centrales.length === 0 ? (
                <Vacio>No hay gastos de oficina central en {periodoLabel(consulta.data.periodo).toLowerCase()}. Cuando se registren, aquí podrá repartirlos.</Vacio>
              ) : (
                <ul className="divide-y divide-borde-suave text-[12px]">
                  {consulta.data.centrales.map((g) => (
                    <li key={g.id} className="flex justify-between gap-2 py-[5px] first:pt-0">
                      <Link href={`/gastos/${g.id}`} className="min-w-0 truncate text-tinta hover:underline" title={g.folio}>
                        {g.descripcion}
                      </Link>
                      <span className="shrink-0 tabular-nums">{q(g.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {consulta.data.aplicacion && (
                <p className="mt-[8px] text-[11px] text-tenue">
                  Aplicado {consulta.data.aplicacion.criterio === 'ventas' ? 'según ventas' : 'en partes iguales'} el {fechaHora(consulta.data.aplicacion.aplicadoEn)} por{' '}
                  {consulta.data.aplicacion.aplicadoPor} · {q(consulta.data.aplicacion.total)}
                </p>
              )}
            </Tarjeta>

            <Tarjeta className="lg:col-span-2" titulo="Criterio de reparto">
              <Segmentado className="mb-[10px]" etiqueta="Criterio de reparto" opciones={CRITERIOS} valor={consulta.data.criterio} alCambiar={setCriterio} />
              {consulta.data.sinVentas && (
                <Aviso tono="amber" className="mb-[8px]">
                  No hay ventas importadas para {periodoLabel(consulta.data.periodo).toLowerCase()}; se reparte en partes iguales.
                </Aviso>
              )}
              {consulta.data.impacto.length === 0 ? (
                <Vacio>No hay estaciones activas entre las que repartir.</Vacio>
              ) : (
                <ContenedorTabla anchoMinimo={620}>
                  <Cabecera>
                    <th className={th}>Estación</th>
                    <th className={thR}>Ventas</th>
                    <th className={thR}>Peso</th>
                    <th className={thR}>Asignado</th>
                    <th className={thR}>Gasto propio</th>
                    <th className={thR}>Gasto total / ventas</th>
                  </Cabecera>
                  <Cuerpo>
                    {consulta.data.impacto.map((x) => (
                      <tr key={x.estacion.id}>
                        <td className={td}>
                          {x.estacion.codigo} <span className="text-[11px] text-tenue">{x.estacion.nombre}</span>
                        </td>
                        <td className={tdR}>{Number(x.ventas) ? qk(x.ventas) : '—'}</td>
                        <td className={tdR}>{pct(x.pct)}</td>
                        <td className={cn(tdR, 'font-medium')}>{q(x.asignado)}</td>
                        <td className={tdR}>{q(x.propio)}</td>
                        <td className={tdR}>{x.ratioPct === null ? '—' : pct(x.ratioPct, 2)}</td>
                      </tr>
                    ))}
                  </Cuerpo>
                </ContenedorTabla>
              )}
              <div className="mt-[10px] flex flex-wrap justify-end gap-2">
                {consulta.data.aplicado && (
                  <BotonAccion
                    variante="ghost"
                    verificacion={consulta.data.puedeAplicar}
                    cargando={quitar.isPending}
                    onClick={() => ejecutar(() => quitar.mutateAsync(consulta.data.periodo))}
                  >
                    Quitar prorrateo
                  </BotonAccion>
                )}
                {consulta.data.puedeAplicar.ok ? (
                  <Boton
                    disabled={!consulta.data.centrales.length}
                    cargando={aplicar.isPending}
                    onClick={() => ejecutar(() => aplicar.mutateAsync({ periodo: consulta.data.periodo, criterio: consulta.data.criterio }))}
                  >
                    {consulta.data.aplicado ? 'Volver a aplicar' : 'Aplicar prorrateo'}
                  </Boton>
                ) : (
                  <BotonAccion verificacion={consulta.data.puedeAplicar}>{consulta.data.aplicado ? 'Volver a aplicar' : 'Aplicar prorrateo'}</BotonAccion>
                )}
              </div>
            </Tarjeta>
          </div>

          <Tarjeta className="mt-[6px]" titulo="Gasto por estación con y sin prorrateo" subtitulo="El reporte por estación puede incluir o no la parte de oficina central">
            <BarrasAgrupadas
              series={['Gasto propio', 'Con oficina central']}
              formato={qk}
              vacio="Sin estaciones para comparar."
              filas={consulta.data.impacto.map((x) => ({
                clave: x.estacion.id,
                etiqueta: `${x.estacion.codigo} · ${x.estacion.nombre}`,
                valores: [x.propio, x.conCentral],
              }))}
            />
          </Tarjeta>
        </>
      )}
    </div>
  );
}
