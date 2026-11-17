'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { aNumero, SERIES } from '@/componentes/ui/barras';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Seleccion } from '@/componentes/ui/campos';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { descargarCsv } from '@/lib/csv';
import { fecha, pct, periodoLabel, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type Eje, type EstadosReporte, useReporte } from '../datos';

export function PantallaReportes() {
  const { estacionId } = useErp();
  const [eje, setEje] = useState<Eje>('categoria');
  const [periodo, setPeriodo] = useState('');
  const [estados, setEstados] = useState<EstadosReporte>('vigentes');
  const [prorrateo, setProrrateo] = useState(false);
  const consulta = useReporte({ eje, periodo, estados, prorrateo, estacionId });
  const d = consulta.data;

  const ejeLabel = d?.ejes.find((x) => x.clave === eje)?.etiqueta ?? d?.etiquetaEje ?? '';
  const cols = d?.columnas ?? [];
  const maximo = Math.max(1, ...(d?.filas ?? []).map((f) => aNumero(f.total)));

  const exportar = () => {
    if (!d) return;
    descargarCsv(`reporte-gastos-por-${d.eje}.csv`, [
      [d.etiquetaEje, ...d.columnas.map(periodoLabel), 'Total', '% del total', 'Registros'],
      ...d.filas.map((f) => [f.etiqueta, ...d.columnas.map((p) => f.porMes[p] ?? '0.00'), f.total, f.pct.toFixed(1), f.registros]),
      ['Total', ...d.columnas.map((p) => d.totales.porMes[p] ?? '0.00'), d.totales.total, d.filas.length ? '100' : '0', d.registros],
    ]);
  };

  return (
    <div>
      <EncabezadoPagina
        titulo="Reportes de gastos"
        descripcion="Consulte los gastos por fecha, categoría, estación, proveedor, centro de costo o unidad de negocio y expórtelos a Excel (CSV)."
        acciones={
          <Boton variante="secondary" icono={<Download aria-hidden />} onClick={exportar} disabled={!d}>
            Exportar CSV
          </Boton>
        }
      />
      <Tarjeta>
        <div className="grid gap-[8px] sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Agrupar por" htmlFor="rep-eje">
            <Seleccion id="rep-eje" value={eje} onChange={(e) => setEje(e.target.value as Eje)}>
              {(d?.ejes ?? [{ clave: eje, etiqueta: ejeLabel || '…' }]).map((x) => (
                <option key={x.clave} value={x.clave}>
                  {x.etiqueta}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Mes" htmlFor="rep-mes">
            <Seleccion id="rep-mes" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="">Comparar meses</option>
              {(d?.periodos ?? []).map((p) => (
                <option key={p} value={p}>
                  {periodoLabel(p)}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Incluir" htmlFor="rep-estados">
            <Seleccion id="rep-estados" value={estados} onChange={(e) => setEstados(e.target.value as EstadosReporte)}>
              <option value="vigentes">Por autorizar, aprobados y pagados</option>
              <option value="ejecutados">Aprobados y pagados</option>
              <option value="pagados">Solo pagados</option>
            </Seleccion>
          </Campo>
          <label className="flex items-end gap-[6px] pb-[6px] text-[12px] text-tinta-suave">
            <input type="checkbox" checked={prorrateo} onChange={(e) => setProrrateo(e.target.checked)} className="accent-[var(--acento)]" />
            Repartir gastos de oficina central (prorrateo aplicado)
          </label>
        </div>
      </Tarjeta>

      {consulta.isPending ? (
        <div className="mt-[6px]">
          <EsqueletoTabla />
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red" className="mt-[6px]">
          {mensajeDeError(consulta.error)}
        </Aviso>
      ) : (
        <Tarjeta
          className="mt-[6px]"
          titulo={`Gastos por ${ejeLabel.toLowerCase()}`}
          subtitulo={`${consulta.data.registros} registros · ${q(consulta.data.totales.total)}`}
        >
          {consulta.data.filas.length === 0 ? (
            <Vacio>
              {consulta.data.periodos.length === 0
                ? 'Todavía no hay gastos registrados: el reporte se llena al registrar el primero.'
                : 'Ningún gasto coincide con estos filtros.'}
            </Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={720}>
              <Cabecera>
                <th className={th}>{ejeLabel}</th>
                {cols.map((p) => (
                  <th key={p} className={thR}>
                    {periodoLabel(p)}
                  </th>
                ))}
                {cols.length > 1 && <th className={thR}>Total</th>}
                <th className={cn(th, 'w-48')}>% del total</th>
              </Cabecera>
              <Cuerpo>
                {consulta.data.filas.map((f) => (
                  <tr key={f.clave}>
                    <td className={cn(td, 'max-w-xs truncate')}>{f.etiqueta}</td>
                    {cols.map((p) => (
                      <td key={p} className={tdR}>
                        {f.porMes[p] ? q(f.porMes[p]) : '—'}
                      </td>
                    ))}
                    {cols.length > 1 && <td className={cn(tdR, 'font-semibold')}>{q(f.total)}</td>}
                    <td className={td}>
                      <div className="flex items-center gap-[6px]">
                        <div className="h-[8px] flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(0, (aNumero(f.total) / maximo) * 100)}%`, background: SERIES[0] }} />
                        </div>
                        <span className="w-14 shrink-0 whitespace-nowrap text-right text-[10.5px] tabular-nums text-tinta-suave">{pct(f.pct)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </Cuerpo>
              <tfoot>
                <tr className="border-t-2 border-borde font-semibold">
                  <td className={cn(td, 'font-semibold')}>Total</td>
                  {cols.map((p) => (
                    <td key={p} className={cn(tdR, 'font-semibold')}>
                      {q(consulta.data.totales.porMes[p] ?? '0.00')}
                    </td>
                  ))}
                  {cols.length > 1 && <td className={cn(tdR, 'font-semibold')}>{q(consulta.data.totales.total)}</td>}
                  <td className={td}></td>
                </tr>
              </tfoot>
            </ContenedorTabla>
          )}
          {cols.length > 1 && consulta.data.filas.length > 0 && (
            <p className="mt-[6px] text-[11px] text-tenue">
              {periodoLabel(cols[cols.length - 1]!)} llega solo hasta el corte del {fecha(consulta.data.fechaCorte)}, así que todavía no es comparable con un mes completo.
            </p>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
