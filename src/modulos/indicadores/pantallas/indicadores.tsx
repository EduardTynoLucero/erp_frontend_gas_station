'use client';

import Link from 'next/link';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto, Vacio } from '@/componentes/ui/aviso';
import { ListaBarras, SERIES } from '@/componentes/ui/barras';
import { Insignia } from '@/componentes/ui/insignia';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { pct, periodoLabel, q, qk } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type Indicadores, useIndicadores } from '../datos';

export function PantallaIndicadores() {
  const { estacionId } = useErp();
  const consulta = useIndicadores(estacionId);
  const d = consulta.data;

  return (
    <div>
      <EncabezadoPagina
        titulo="Indicadores gerenciales"
        descripcion={`Comparación entre estaciones, desviaciones de presupuesto y gastos fuera de lo normal.${
          d ? ` ${periodoLabel(d.periodo)} al corte del ${Number(d.fechaCorte.slice(8))}.` : ''
        }`}
      />
      {consulta.isPending ? (
        <div className="grid gap-[6px]">
          <Esqueleto className="h-[64px]" />
          <Esqueleto className="h-[220px]" />
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <Contenido d={consulta.data} />
      )}
    </div>
  );
}

/** "-1500.00" → true; para el color y el signo de la diferencia, sin aritmética */
const esPositivo = (v: string) => !v.startsWith('-') && /[1-9]/.test(v);

function Contenido({ d }: { d: Indicadores }) {
  const sv = d.gastoSobreVentas;
  return (
    <>
      <div className="mb-[6px] grid grid-cols-2 gap-[6px] lg:grid-cols-4">
        <Indicador etiqueta="Gasto sobre ventas" valor={sv.pct !== null ? pct(sv.pct, 2) : '—'} pista={`${qk(sv.gasto)} de ${qk(sv.ventas)} vendidos`} />
        <Indicador
          etiqueta="Pérdidas tomadas de reportes"
          valor={q(d.perdidas.monto)}
          pista="Merma, descuento a cuenta genérica y venta bajo costo"
          tono={d.perdidas.cantidad ? 'red' : undefined}
        />
        <Indicador etiqueta="Gastos fuera de lo normal" valor={d.inusuales.total} pista="Ver lista abajo" tono={d.inusuales.total ? 'amber' : undefined} />
        <Indicador etiqueta="Categorías sobre presupuesto" valor={d.categoriasSobrePresupuesto} tono={d.categoriasSobrePresupuesto ? 'red' : undefined} />
      </div>

      <div className="grid gap-[6px] lg:grid-cols-2">
        <Tarjeta titulo="Gasto sobre ventas por estación" subtitulo="Ventas de los cierres de caja">
          <ListaBarras
            formato={(n) => pct(n, 2)}
            color={SERIES[1]}
            elementos={d.porEstacion
              .filter((x) => x.ratioPct !== null)
              .map((x) => ({ clave: x.id, etiqueta: `${x.codigo} · ${x.nombre}`, valor: x.ratioPct ?? 0, sub: qk(x.gasto) }))}
            vacio="Se calcula cuando hay ventas del mes cargadas de los cierres de caja."
          />
        </Tarjeta>
        <Tarjeta titulo="Principales proveedores del mes">
          <ListaBarras
            formato={q}
            elementos={d.proveedores.map((p) => ({ clave: p.id, etiqueta: p.nombre, valor: p.monto }))}
            vacio="Todavía no hay gastos con proveedor en el mes."
          />
        </Tarjeta>
      </div>

      <Tarjeta
        className="mt-[6px]"
        titulo="Gasto por cada Q1,000 vendidos, por categoría"
        subtitulo="Permite comparar estaciones de distinto tamaño. Resaltado: la estación que más gasta en esa categoría."
      >
        {d.matriz.filas.length === 0 ? (
          <Vacio>Se calcula cuando hay gastos y ventas del periodo.</Vacio>
        ) : (
          <ContenedorTabla anchoMinimo={560}>
            <Cabecera>
              <th className={th}>Categoría</th>
              {d.matriz.estaciones.map((e) => (
                <th key={e.id} className={thR} title={e.nombre}>
                  {e.codigo}
                </th>
              ))}
            </Cabecera>
            <Cuerpo>
              {d.matriz.filas.map((f) => (
                <tr key={f.categoria.id}>
                  <td className={td}>{f.categoria.nombre}</td>
                  {f.valores.map((v, i) => (
                    <td key={i} className={cn(tdR, v.mayor && 'font-semibold text-[#9a6200] dark:text-amber-400')}>
                      {esPositivo(v.valor) ? q(v.valor) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </Cuerpo>
          </ContenedorTabla>
        )}
      </Tarjeta>

      <div className="mt-[6px] grid gap-[6px] lg:grid-cols-2">
        <Tarjeta titulo="Desviación contra presupuesto" subtitulo="Usado (ejecutado + por autorizar) menos presupuesto">
          {d.desviacion.length === 0 ? (
            <Vacio>Todavía no hay presupuestos ni gastos del periodo.</Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={460}>
              <Cabecera>
                <th className={th}>Categoría</th>
                <th className={thR}>Presupuesto</th>
                <th className={thR}>Usado</th>
                <th className={thR}>Diferencia</th>
              </Cabecera>
              <Cuerpo>
                {d.desviacion.map((x) => (
                  <tr key={x.categoria.id}>
                    <td className={td}>{x.categoria.nombre}</td>
                    <td className={tdR}>{esPositivo(x.presupuesto) ? q(x.presupuesto) : '—'}</td>
                    <td className={tdR}>{q(x.usado)}</td>
                    <td
                      className={cn(
                        tdR,
                        esPositivo(x.diferencia) ? 'font-semibold text-[#a51d17] dark:text-red-400' : 'text-[#007a3d] dark:text-emerald-400',
                      )}
                    >
                      {esPositivo(x.diferencia) ? '+' : ''}
                      {q(x.diferencia)}
                    </td>
                  </tr>
                ))}
              </Cuerpo>
            </ContenedorTabla>
          )}
        </Tarjeta>
        <Tarjeta titulo="Gastos fuera de lo normal" subtitulo="Pérdidas de los reportes y montos mayores al doble de lo habitual">
          {d.inusuales.lista.length === 0 ? (
            <Vacio>Ningún gasto fuera de lo normal.</Vacio>
          ) : (
            <ul className="divide-y divide-borde-suave">
              {d.inusuales.lista.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-[8px] py-[6px] first:pt-0">
                  <div className="min-w-0">
                    <Link href={`/gastos/${g.id}`} className="block truncate text-[12px] font-semibold text-tinta hover:underline">
                      {g.folio} · {g.descripcion}
                    </Link>
                    <p className="text-[11px] text-tenue">
                      {g.estacion.codigo} · {g.motivo}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-semibold tabular-nums">{q(g.monto)}</p>
                    {g.origen === 'reporte' && <Insignia tono="violet">Reporte</Insignia>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {d.inusuales.total > d.inusuales.lista.length && (
            <p className="mt-[6px] text-[11px] text-tenue">
              Se muestran {d.inusuales.lista.length} de {d.inusuales.total}.
            </p>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
